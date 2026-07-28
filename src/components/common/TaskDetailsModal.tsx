import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import {
  X,
  CheckSquare,
  User,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  Lock,
  UserPlus,
  Send,
  Trash2,
  Users,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { TaskPlaceholder, UserProfile, TaskCoAssignee, IssueType } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { respondToInvite, softDeleteTask } from '../../services/taskService';
import { sendNotification } from '../../services/notificationService';

interface TaskDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskPlaceholder;
  onTaskUpdated?: (updatedTask: TaskPlaceholder) => void;
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  isOpen,
  onClose,
  task,
  onTaskUpdated,
}) => {
  const { user, profile, userRole } = useAuth();
  const [currentStatus, setCurrentStatus] = useState(task?.status || 'Todo');
  const [currentPriority, setCurrentPriority] = useState(task?.priority || 'Medium');
  const [description, setDescription] = useState(task?.description || '');
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<any[]>(task?.comments || []);
  const [coAssignees, setCoAssignees] = useState<TaskCoAssignee[]>(task?.coAssignees || []);
  const [subtasks, setSubtasks] = useState(task?.subtasks || []);
  const [activityLog, setActivityLog] = useState(task?.activityLog || []);

  // Co-assignee modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [availableMembers, setAvailableMembers] = useState<UserProfile[]>([]);
  const [selectedInviteUser, setSelectedInviteUser] = useState<UserProfile | null>(null);

  const [successMsg, setSuccessMsg] = useState('');

  const isManagerOrAdmin = userRole === 'Admin' || userRole === 'Manager';

  const loadAvailableMembers = async () => {
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('full_name', { ascending: true });

        if (!error && data) {
          const members: UserProfile[] = data.map((d: any) => ({
            id: d.id,
            full_name: d.full_name,
            role: d.role,
            status: d.status,
            avatar_url: d.avatar_url,
          }));
          setAvailableMembers(members);
          if (members.length > 0) setSelectedInviteUser(members[0]);
          return;
        }
      }
    } catch (err) {
      console.warn('Could not load profiles:', err);
    }

    if (user) {
      setAvailableMembers([
        {
          id: user.id,
          full_name: profile?.full_name || 'Current User',
          role: profile?.role || 'Member',
          status: 'Approved',
        },
      ]);
    }
  };

  useEffect(() => {
    if (task) {
      setCurrentStatus(task.status);
      setCurrentPriority(task.priority);
      setDescription(task.description || '');
      setCoAssignees(task.coAssignees || []);
      setSubtasks(task.subtasks || []);
      setActivityLog(task.activityLog || []);
      setSuccessMsg('');

      if (Array.isArray(task.comments) && task.comments.length > 0) {
        setComments(task.comments);
      }
    }
    loadAvailableMembers();
  }, [task, isOpen]);

  useEffect(() => {
    if (showInviteModal) {
      loadAvailableMembers();
    }
  }, [showInviteModal]);

  if (!isOpen || !task) return null;

  const handleStatusChange = async (newStatus: any) => {
    setCurrentStatus(newStatus);
    const updated = { ...task, status: newStatus };
    if (onTaskUpdated) onTaskUpdated(updated);

    if (isSupabaseConfigured) {
      await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
    }
  };

  const handleAddCoAssignee = async () => {
    if (!selectedInviteUser) return;

    // Check if already added
    if (coAssignees.some((ca) => ca.id === selectedInviteUser.id || ca.name === selectedInviteUser.full_name)) {
      setSuccessMsg(`${selectedInviteUser.full_name} is already assigned to this task.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      setShowInviteModal(false);
      return;
    }

    const newCo: TaskCoAssignee = {
      id: selectedInviteUser.id,
      name: selectedInviteUser.full_name,
      avatar: selectedInviteUser.avatar_url,
      role: selectedInviteUser.role,
    };

    const updatedCoAssignees = [...coAssignees, newCo];
    setCoAssignees(updatedCoAssignees);

    // Add activity log
    const newLog = {
      id: `log-${Date.now()}`,
      userName: profile?.full_name || 'Member',
      action: `added ${selectedInviteUser.full_name} as a co-assignee.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    const updatedLogs = [newLog, ...activityLog];
    setActivityLog(updatedLogs);

    if (isSupabaseConfigured) {
      await supabase
        .from('tasks')
        .update({
          co_assignees: updatedCoAssignees,
          activity_log: updatedLogs,
        })
        .eq('id', task.id);

      // Send in-app notification to invited user
      await sendNotification({
        recipientEmail: selectedInviteUser.full_name,
        senderName: profile?.full_name || 'Workspace Member',
        title: `Co-Assigned to Task ${task.code}`,
        message: `${profile?.full_name || 'A team member'} added you as a co-assignee on "${task.title}".`,
        taskCode: task.code,
        type: 'collab_request',
      });
    }

    setSuccessMsg(`Successfully co-assigned ${selectedInviteUser.full_name}!`);
    setTimeout(() => setSuccessMsg(''), 3500);
    setShowInviteModal(false);
    if (onTaskUpdated) onTaskUpdated({ ...task, coAssignees: updatedCoAssignees });
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const commentObj = {
      id: `comment-${Date.now()}`,
      authorName: profile?.full_name || 'Workspace Member',
      authorAvatar: profile?.avatar_url,
      text: newComment.trim(),
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedComments = [commentObj, ...comments];
    setComments(updatedComments);
    setNewComment('');

    if (isSupabaseConfigured) {
      await supabase.from('tasks').update({ comments: updatedComments }).eq('id', task.id);
    }
    if (onTaskUpdated) onTaskUpdated({ ...task, comments: updatedComments });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200/60">
                {task.code}
              </span>
              <Badge variant={currentPriority === 'Urgent' ? 'danger' : 'warning'}>
                {currentPriority} Priority
              </Badge>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-semibold text-slate-500">{task.project || 'General'}</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">{task.title}</h2>
          </div>

          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMsg && (
          <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')}>✕</button>
          </div>
        )}

        {/* Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Status:</span>
            <select
              value={currentStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="rounded-lg border border-slate-300 p-1.5 text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-brand-500"
            >
              <option value="Todo">Todo</option>
              <option value="In Progress">In Progress</option>
              <option value="In Review">In Review</option>
              <option value="Done">Done</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Primary Assignee:</span>
            <span className="text-xs font-bold text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              {task.assignee?.name || 'Unassigned'}
            </span>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Description & Notes</h3>
          <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
            {description || 'No additional instructions provided for this task.'}
          </p>
        </div>

        {/* Co-Assignees Section */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-600" />
              Assigned Members & Co-Assignees ({coAssignees.length + 1})
            </h3>
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-semibold text-brand-600 border-brand-200 hover:bg-brand-50"
              leftIcon={<UserPlus className="w-3.5 h-3.5" />}
              onClick={() => {
                loadAvailableMembers();
                setShowInviteModal(true);
              }}
            >
              + Add Co-Assignee
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Primary Assignee Badge */}
            <div className="flex items-center gap-2 p-2 bg-brand-50 border border-brand-200 rounded-xl">
              <Avatar name={task.assignee?.name || 'Assignee'} size="xs" />
              <div>
                <span className="text-xs font-bold text-brand-900 block leading-none">{task.assignee?.name || 'Primary'}</span>
                <span className="text-[10px] text-brand-600 font-semibold">Primary Lead</span>
              </div>
            </div>

            {/* Co-Assignees */}
            {coAssignees.map((ca, idx) => (
              <div key={ca.id || idx} className="flex items-center gap-2 p-2 bg-slate-100 border border-slate-200 rounded-xl">
                <Avatar name={ca.name} src={ca.avatar} size="xs" />
                <div>
                  <span className="text-xs font-bold text-slate-800 block leading-none">{ca.name}</span>
                  <span className="text-[10px] text-slate-500 font-medium">Co-Assignee ({ca.role || 'Member'})</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Log & Discussion */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <h3 className="text-xs font-bold text-slate-800 uppercase">Comments & Collaboration</h3>

          <form onSubmit={handleAddComment} className="flex items-center gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment or status update..."
              className="flex-1 rounded-xl border border-slate-200 p-2.5 text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
            <Button type="submit" variant="primary" size="sm" leftIcon={<Send className="w-3.5 h-3.5" />}>
              Post
            </Button>
          </form>

          <div className="space-y-2 max-h-40 overflow-y-auto pt-1">
            {comments.map((c) => (
              <div key={c.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-800">{c.authorName}</span>
                  <span className="text-slate-400">{c.createdAt}</span>
                </div>
                <p className="text-xs text-slate-600">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Co-Assignee Sub-Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-brand-600" />
                Add Co-Assignee for Assistance
              </h4>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase">Select Employee *</label>
              <select
                value={selectedInviteUser?.id || ''}
                onChange={(e) => {
                  const found = availableMembers.find((m) => m.id === e.target.value);
                  if (found) setSelectedInviteUser(found);
                }}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                {availableMembers.length === 0 ? (
                  <option value="">Loading members...</option>
                ) : (
                  availableMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.role})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowInviteModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleAddCoAssignee}>
                Add Co-Assignee
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
