import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { X, CheckSquare, User, Calendar, Tag, AlertCircle, FileText, Clock, Layers } from 'lucide-react';
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
  const [issueType, setIssueType] = useState<IssueType>('Task');
  const [project, setProject] = useState('Hardware Architecture');
  const [assigneeName, setAssigneeName] = useState('');
  const [priority, setPriority] = useState<'Urgent' | 'High' | 'Medium' | 'Low'>('High');
  const [dueDate, setDueDate] = useState('2026-07-30');
  const [estimatedHours, setEstimatedHours] = useState<number>(8);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [workspaceMembers, setWorkspaceMembers] = useState<UserProfile[]>([]);

  // Load real workspace accounts from public.profiles (Excluding SuperAdmin & Admin)
  const loadWorkspaceMembers = async () => {
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .in('role', ['Manager', 'Lead', 'Member', 'Viewer'])
          .order('full_name', { ascending: true });

        if (!error && data) {
          const assignable = (data as UserProfile[]).filter(
            (m) => m.role !== 'SuperAdmin' && m.role !== 'Admin' && !m.is_superadmin
          );
          setWorkspaceMembers(assignable);
          if (assignable.length > 0 && !assigneeName) {
            setAssigneeName(assignable[0].full_name);
          }
          return;
        }
      }
    } catch (err) {
      console.warn('Could not load profiles for task modal:', err);
    }

    // Default fallback
    if (user) {
      const selfName = profile?.full_name || user.email?.split('@')[0] || 'Workspace Member';
      setWorkspaceMembers([
        {
          id: user.id,
          full_name: selfName,
          role: profile?.role === 'Manager' || profile?.role === 'Lead' ? profile.role : 'Member',
          status: 'Approved',
        },
      ]);
      if (!assigneeName) {
        setAssigneeName(selfName);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadWorkspaceMembers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);

    const selectedAssignee = workspaceMembers.find((m) => m.full_name === assigneeName) || {
      id: user?.id || 'self',
      full_name: assigneeName || 'Workspace Member',
      role: 'Member',
      avatar_url: '',
    };

    const formattedDate = dueDate
      ? new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Jul 30, 2026';

    const creatorName = profile?.full_name || user?.email?.split('@')[0] || 'Workspace Manager';

    const newTask = {
      id: `task-${Date.now()}`,
      code: `TSK-${Math.floor(100 + Math.random() * 900)}`,
      title: title.trim(),
      description: description.trim(),
      issueType,
      project,
      priority,
      status: 'In Progress',
      assignee: {
        name: selectedAssignee.full_name,
        avatar: selectedAssignee.avatar_url,
      },
      createdBy: creatorName,
      dueDate: formattedDate,
      estimatedHours,
      coAssignees: [],
      subtasks: [],
      activityLog: [
        {
          id: `log-${Date.now()}`,
          userName: creatorName,
          action: `created task and assigned to ${selectedAssignee.full_name}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
            status: 'In Progress',
            assignee_name: selectedAssignee.full_name,
            assignee_avatar: selectedAssignee.avatar_url || '',
            assignee_id: selectedAssignee.id,
            due_date: formattedDate,
            created_by: user?.id,
            estimated_hours: estimatedHours,
            co_assignees: [],
            pending_invitations: [],
            subtasks: [],
            activity_log: newTask.activityLog,
            comments: [],
          },
        ]);
      } catch (err) {
        console.warn('Supabase task insert notice:', err);
      }
    }

    // Trigger Notification to Assigned Member
    try {
      await sendNotification({
        recipientEmail: 'jignesh.giri2005@gmail.com',
        senderName: creatorName,
        senderAvatar: profile?.avatar_url,
        title: `New Task Assigned: ${newTask.code}`,
        message: `Task "${newTask.title}" was assigned to ${selectedAssignee.full_name} by ${creatorName}.`,
        taskCode: newTask.code,
        type: 'assignment',
      });
    } catch (e) {
      console.warn('Notification trigger notice:', e);
    }

    setIsSubmitting(false);
    setSuccessMsg(`Task "${newTask.code}" assigned to ${selectedAssignee.full_name} successfully!`);
    if (onTaskCreated) {
      onTaskCreated(newTask);
    }
    setTimeout(() => {
      setSuccessMsg('');
      setTitle('');
      setDescription('');
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in-50 duration-150">
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-soft-lg border border-slate-200/90 overflow-hidden space-y-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Create & Assign Task</h2>
              <p className="text-xs text-slate-500">Assign work & specify detailed instructions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMsg ? (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold text-center">
            {successMsg}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Issue Type */}
              <div className="space-y-1.5 sm:col-span-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Issue Type
                </label>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value as IssueType)}
                  className="w-full bg-white text-slate-900 text-xs rounded-xl border border-slate-200 px-3 py-2.5 h-10 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 font-medium"
                >
                  <option value="Task">📌 Task</option>
                  <option value="Bug">🐛 Bug</option>
                  <option value="Feature">✨ Feature</option>
                  <option value="Improvement">⚡ Improvement</option>
                </select>
              </div>

              {/* Task Title */}
              <div className="space-y-1.5 sm:col-span-2">
                <Input
                  label="Task Title"
                  placeholder="e.g. Implement Hardware Circuitry Testing"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Detailed Information Box / Description */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center justify-between">
                <span>Task Information & Detailed Description</span>
                <span className="text-[10px] text-slate-400 font-normal">Markdown Supported</span>
              </label>
              <textarea
                rows={4}
                placeholder="Provide detailed instructions, specifications, technical criteria, or expected output for this task..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-medium text-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Project Select */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Project Track
                </label>
                <select
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  className="w-full bg-white text-slate-900 text-xs rounded-xl border border-slate-200 px-3 py-2.5 h-10 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 font-medium"
                >
                  <option value="Hardware Architecture">Hardware Architecture</option>
                  <option value="Mechanical Design & CAD">Mechanical Design & CAD</option>
                  <option value="Embedded Firmware & RTOS">Embedded Firmware & RTOS</option>
                  <option value="Telecom Solutions">Telecom Solutions</option>
                  <option value="QA & Compliance Testing">QA & Compliance Testing</option>
                </select>
              </div>

              {/* Assignee Select dynamically populated from Database */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Assign To Member
                </label>
                <select
                  value={assigneeName}
                  onChange={(e) => setAssigneeName(e.target.value)}
                  className="w-full bg-white text-slate-900 text-xs rounded-xl border border-slate-200 px-3 py-2.5 h-10 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 font-medium"
                >
                  {workspaceMembers.map((member) => (
                    <option key={member.id} value={member.full_name}>
                      {member.full_name} ({member.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Priority Select */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full bg-white text-slate-900 text-xs rounded-xl border border-slate-200 px-3 py-2.5 h-10 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 font-medium"
                >
                  <option value="Urgent">🔴 Urgent</option>
                  <option value="High">🟠 High</option>
                  <option value="Medium">🟡 Medium</option>
                  <option value="Low">🔵 Low</option>
                </select>
              </div>

              {/* Due Date Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-white text-slate-900 text-xs rounded-xl border border-slate-200 px-3 py-2.5 h-10 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 font-medium cursor-pointer"
                  required
                />
              </div>

              {/* Estimated Hours */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Est. Hours
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(parseInt(e.target.value) || 0)}
                  className="w-full bg-white text-slate-900 text-xs rounded-xl border border-slate-200 px-3 py-2.5 h-10 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 font-medium"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <Button variant="outline" size="md" onClick={onClose} className="text-xs">
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="text-xs font-semibold shadow-soft"
                isLoading={isSubmitting}
              >
                Create & Assign Task
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
