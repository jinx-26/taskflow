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
          .select('*, teams(name)')
          .eq('status', 'Approved')
          .order('full_name', { ascending: true });

        if (!error && data) {
          const members: UserProfile[] = data.map((d: any) => ({
            id: d.id,
            full_name: d.full_name,
            role: d.role,
            status: d.status,
            avatar_url: d.avatar_url,
            team_name: d.teams?.name || undefined,
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

  const filteredMembers = workspaceMembers.filter((m) =>
    m.full_name.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);

    const primaryAssignee = workspaceMembers.find((m) => m.id === selectedAssigneeIds[0]) || {
      id: user?.id || 'self',
      full_name: profile?.full_name || user?.email?.split('@')[0] || 'Employee',
      avatar_url: '',
    };

    const coAssignees = workspaceMembers
      .filter((m) => selectedAssigneeIds.slice(1).includes(m.id))
      .map((m) => ({
        id: m.id,
        name: m.full_name,
        avatar: m.avatar_url,
        role: m.role,
        teamName: m.team_name,
      }));

    const formattedDate = dueDate
      ? new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Aug 15, 2026';

    const creatorName = profile?.full_name || user?.email?.split('@')[0] || 'Employee';

    const newTask = {
      id: `task-${Date.now()}`,
      code: `TSK-${Math.floor(100 + Math.random() * 900)}`,
      title: title.trim(),
      description: description.trim(),
      issueType,
      project: isStandalone ? 'Standalone Task' : project,
      priority,
      status: 'Todo',
      assignee: {
        id: primaryAssignee.id,
        name: primaryAssignee.full_name,
        avatar: primaryAssignee.avatar_url,
      },
      coAssignees: assignAll ? workspaceMembers.map((m) => ({ id: m.id, name: m.full_name })) : coAssignees,
      createdBy: creatorName,
      dueDate: formattedDate,
      partNumber,
      hardwareRev,
      subtasks: [],
      activityLog: [
        {
          id: `log-${Date.now()}`,
          userName: creatorName,
          action: 'created task',
          timestamp: 'Just now',
        },
      ],
    };

    if (isSupabaseConfigured) {
      try {
        await supabase.from('tasks').insert([
          {
            code: newTask.code,
            title: newTask.title,
            description: newTask.description,
            issue_type: newTask.issueType,
            project: newTask.project,
            priority: newTask.priority,
            status: 'Todo',
            assignee_name: primaryAssignee.full_name,
            assignee_id: primaryAssignee.id,
            assignee_avatar: primaryAssignee.avatar_url,
            co_assignees: newTask.coAssignees,
            created_by: user?.id,
            due_date: newTask.dueDate,
            part_number: partNumber,
            hardware_rev: hardwareRev,
            activity_log: newTask.activityLog,
          },
        ]);
      } catch (err) {
        console.error('Failed to insert task to Supabase:', err);
      }
    }

    setIsSubmitting(false);
    setSuccessMsg('Task created successfully!');

    setTimeout(() => {
      setSuccessMsg('');
      if (onTaskCreated) onTaskCreated(newTask);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-brand-600" />
            <h3 className="text-lg font-extrabold text-slate-900">Create Task / Work Order</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMsg && (
          <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Task Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Task Title *</label>
            <Input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. PCB Component Soldering & Thermal Test"
            />
          </div>

          {/* Standalone vs Project Toggle */}
          <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-700">Task Context:</span>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="radio"
                checked={isStandalone}
                onChange={() => setIsStandalone(true)}
                className="text-brand-600 focus:ring-brand-500"
              />
              Standalone Task (Individual Work)
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="radio"
                checked={!isStandalone}
                onChange={() => setIsStandalone(false)}
                className="text-brand-600 focus:ring-brand-500"
              />
              Belongs to Project
            </label>
          </div>

          {!isStandalone && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Project</label>
              <Input
                value={project}
                onChange={(e) => setProject(e.target.value)}
                placeholder="e.g. WSS 5G Outdoor Unit Development"
              />
            </div>
          )}

          {/* Issue Type & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Issue Category</label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value as IssueType)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                {[
                  'PCB Layout',
                  'Hardware Design',
                  'Mechanical CAD',
                  'Firmware Flash',
                  'QA & Compliance',
                  'Component Procurement',
                  'Field Issue',
                  'General Task',
                ].map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="Urgent">🔴 Urgent</option>
                <option value="High">🟠 High</option>
                <option value="Medium">🟡 Medium</option>
                <option value="Low">🟢 Low</option>
              </select>
            </div>
          </div>

          {/* Dynamic Assignees Selector (Zero Hardcoded Names) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Assignees & Co-Assignees
              </label>
              <label className="flex items-center gap-1.5 text-xs font-bold text-brand-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignAll}
                  onChange={(e) => {
                    setAssignAll(e.target.checked);
                    if (e.target.checked) setSelectedAssigneeIds(workspaceMembers.map((m) => m.id));
                  }}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                Assign to All Employees
              </label>
            </div>

            {!assignAll && (
              <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50/50 max-h-48 overflow-y-auto">
                <Input
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Search employee name or team..."
                  className="text-xs mb-2"
                />

                {filteredMembers.map((m) => {
                  const isSelected = selectedAssigneeIds.includes(m.id);
                  const displayBadge = m.role === 'Manager' ? 'Manager' : m.team_name || m.role;

                  return (
                    <div
                      key={m.id}
                      onClick={() => toggleUserSelection(m.id)}
                      className={`flex items-center justify-between p-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                        isSelected ? 'bg-brand-50 text-brand-900 border border-brand-200' : 'bg-white hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{m.full_name}</span>
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          ({displayBadge})
                        </span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-brand-600" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Description & Requirements</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter work details, hardware specifications, component IDs..."
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Create Task
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
