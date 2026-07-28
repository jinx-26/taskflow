import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { X, CheckSquare, User, Calendar, Tag, AlertCircle, FileText, Clock, Layers, Users, Check } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { sendNotification } from '../../services/notificationService';
import { UserProfile, IssueType } from '../../types';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated?: (newTask: any) => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onTaskCreated,
}) => {
  const { user, profile } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [issueType, setIssueType] = useState<IssueType>('General Task');
  const [isStandalone, setIsStandalone] = useState(true);
  const [project, setProject] = useState('General Task Hub');
  const [priority, setPriority] = useState<'Urgent' | 'High' | 'Medium' | 'Low'>('High');
  const [dueDate, setDueDate] = useState('2026-08-15');
  const [partNumber, setPartNumber] = useState('');
  const [hardwareRev, setHardwareRev] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  const [workspaceMembers, setWorkspaceMembers] = useState<UserProfile[]>([]);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [assignAll, setAssignAll] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  const loadWorkspaceMembers = async () => {
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('status', 'Approved')
          .order('full_name', { ascending: true });

        if (!error && data) {
          const members: UserProfile[] = data.map((d: any) => ({
            id: d.id,
            full_name: d.full_name,
            role: d.role,
            status: d.status,
            avatar_url: d.avatar_url,
          }));
          setWorkspaceMembers(members);
          if (members.length > 0 && selectedAssigneeIds.length === 0) {
            setSelectedAssigneeIds([members[0].id]);
          }
          return;
        }
      }
    } catch (err) {
      console.warn('Could not load profiles for task modal:', err);
    }

    if (user) {
      const selfName = profile?.full_name || user.email?.split('@')[0] || 'Employee';
      const selfMember: UserProfile = {
        id: user.id,
        full_name: selfName,
        role: profile?.role || 'Member',
        status: 'Approved',
      };
      setWorkspaceMembers([selfMember]);
      setSelectedAssigneeIds([user.id]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadWorkspaceMembers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleUserSelection = (userId: string) => {
    if (assignAll) setAssignAll(false);
    setSelectedAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    setAssignAll(true);
    setSelectedAssigneeIds(workspaceMembers.map((m) => m.id));
  };

  const handleDeselectAll = () => {
    setAssignAll(false);
    setSelectedAssigneeIds([]);
  };

  const filteredMembers = workspaceMembers.filter((m) =>
    m.full_name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    m.role.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;

    if (selectedAssigneeIds.length === 0 && !assignAll) {
      alert('Please select at least one assignee for this task.');
      return;
    }

    setIsSubmitting(true);
    const taskCode = `TSK-${Math.floor(1000 + Math.random() * 9000)}`;

    const primaryAssigneeObj = workspaceMembers.find((m) => m.id === selectedAssigneeIds[0]) || {
      id: user.id,
      full_name: profile?.full_name || 'Assigned Member',
      avatar_url: profile?.avatar_url,
    };

    const coAssigneesList = workspaceMembers
      .filter((m) => selectedAssigneeIds.includes(m.id) && m.id !== primaryAssigneeObj.id)
      .map((m) => ({
        id: m.id,
        name: m.full_name,
        avatar: m.avatar_url,
        role: m.role,
      }));

    const newTaskData = {
      code: taskCode,
      title: title.trim(),
      description: description.trim(),
      issue_type: issueType,
      project: isStandalone ? 'Standalone Task' : project.trim(),
      priority,
      status: 'Todo',
      assignee_id: primaryAssigneeObj.id,
      assignee_name: primaryAssigneeObj.full_name,
      assignee_avatar: primaryAssigneeObj.avatar_url || '',
      co_assignees: coAssigneesList,
      part_number: partNumber.trim() || null,
      hardware_rev: hardwareRev.trim() || null,
      created_by: user.id,
      due_date: dueDate,
      activity_log: [
        {
          id: `log-${Date.now()}`,
          userName: profile?.full_name || 'Member',
          action: `created task ${taskCode}.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('tasks').insert([newTaskData]).select().single();

        if (error) throw error;

        // Notify assignees
        selectedAssigneeIds.forEach(async (targetId) => {
          const targetMem = workspaceMembers.find((m) => m.id === targetId);
          if (targetMem) {
            await sendNotification({
              recipientEmail: targetMem.full_name,
              senderName: profile?.full_name || 'Member',
              title: `New Task Assignment: ${taskCode}`,
              message: `You were assigned to task "${title.trim()}".`,
              taskCode,
              type: 'assignment',
            });
          }
        });

        if (onTaskCreated && data) onTaskCreated(data);
      } catch (err) {
        console.error('Error inserting task:', err);
      }
    } else {
      if (onTaskCreated) onTaskCreated(newTaskData);
    }

    setSuccessMsg(`Task ${taskCode} created successfully!`);
    setIsSubmitting(false);

    setTimeout(() => {
      setSuccessMsg('');
      setTitle('');
      setDescription('');
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600 font-bold">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 leading-tight">Create & Assign New Task</h3>
              <p className="text-xs text-slate-500">Assign to single or multiple team members</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMsg && (
          <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Task Type Toggle */}
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setIsStandalone(true)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isStandalone ? 'bg-white text-brand-700 shadow-soft-xs' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Standalone Task
            </button>
            <button
              type="button"
              onClick={() => setIsStandalone(false)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                !isStandalone ? 'bg-white text-brand-700 shadow-soft-xs' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Project Task
            </button>
          </div>

          {!isStandalone && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Project Name *</label>
              <Input
                required
                value={project}
                onChange={(e) => setProject(e.target.value)}
                placeholder="e.g. WSS 5G Outdoor Unit Development"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Task Title *</label>
            <Input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. PCB Schematics & RF Layout Review"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Category / Issue Type</label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value as IssueType)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-brand-500"
              >
                <option value="General Task">General Task</option>
                <option value="PCB Layout">PCB Layout</option>
                <option value="Hardware Design">Hardware Design</option>
                <option value="Mechanical CAD">Mechanical CAD</option>
                <option value="Firmware Flash">Firmware Flash</option>
                <option value="QA & Compliance">QA & Compliance</option>
                <option value="Component Procurement">Component Procurement</option>
                <option value="Field Issue">Field Issue</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-brand-500"
              >
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          {/* Searchable Multi-Assignee Selection List with Select All */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase">
                Assign to Employees ({selectedAssigneeIds.length} Selected)
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[11px] font-bold text-brand-600 hover:text-brand-800 bg-brand-50 px-2 py-0.5 rounded border border-brand-200"
                >
                  Assign to All
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 bg-slate-100 px-2 py-0.5 rounded"
                >
                  Clear
                </button>
              </div>
            </div>

            <Input
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              placeholder="Search member name or team role..."
              className="py-1.5 text-xs"
            />

            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 divide-y divide-slate-100 space-y-1 bg-slate-50/50">
              {filteredMembers.length === 0 ? (
                <p className="text-[11px] text-slate-400 p-2 text-center">No approved members found.</p>
              ) : (
                filteredMembers.map((m) => {
                  const isChecked = selectedAssigneeIds.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className="flex items-center justify-between p-1.5 hover:bg-white rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleUserSelection(m.id)}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4"
                        />
                        <span className="text-xs font-bold text-slate-800">{m.full_name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {m.role}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Description & Instructions</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed work breakdown, PCB requirements, component part numbers..."
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Create & Assign Task
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
