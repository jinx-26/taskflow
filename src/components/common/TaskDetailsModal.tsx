import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { Input } from '../ui/Input';
import {
  X,
  CheckCircle2,
  Clock,
  MessageSquare,
  Send,
  User,
  Sparkles,
  Trash2,
  UserPlus,
  CheckSquare,
  ListTodo,
  History,
  FileText,
  AlertTriangle,
  ShieldCheck,
  Plus,
} from 'lucide-react';
import { TaskPlaceholder, UserProfile, SubtaskItem, TaskActivityLog, TaskCoAssignee } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { softDeleteTask, inviteCoAssignee } from '../../services/taskService';
import { sendNotification } from '../../services/notificationService';

interface CommentItem {
  id: string;
  author: string;
  avatar?: string;
  text: string;
  timestamp: string;
}

interface TaskDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskPlaceholder | null;
  onTaskUpdated?: (updatedTask: TaskPlaceholder) => void;
  onTaskDeleted?: (deletedTaskId: string) => void;
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  isOpen,
  onClose,
  task,
  onTaskUpdated,
  onTaskDeleted,
}) => {
  const { user, profile, userRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'details' | 'subtasks' | 'comments' | 'history'>('details');

  const [currentStatus, setCurrentStatus] = useState<'Backlog' | 'Todo' | 'In Progress' | 'In Review' | 'Done'>('In Progress');
  const [currentPriority, setCurrentPriority] = useState<'Urgent' | 'High' | 'Medium' | 'Low'>('High');
  const [description, setDescription] = useState('');
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState('');
  const [subtasks, setSubtasks] = useState<SubtaskItem[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [coAssignees, setCoAssignees] = useState<TaskCoAssignee[]>([]);
  const [activityLog, setActivityLog] = useState<TaskActivityLog[]>([]);

  // Co-assignee modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [availableMembers, setAvailableMembers] = useState<UserProfile[]>([]);
  const [selectedInviteUser, setSelectedInviteUser] = useState<UserProfile | null>(null);

  const [successMsg, setSuccessMsg] = useState('');

  const isManagerOrAdmin = userRole === 'Admin' || userRole === 'Manager';

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
  }, [task]);

  const loadAvailableMembers = async () => {
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*, teams(name)')
          .eq('status', 'Approved');

        if (!error && data) {
          const members: UserProfile[] = data.map((d: any) => ({
            id: d.id,
            full_name: d.full_name,
            role: d.role,
            status: d.status,
            avatar_url: d.avatar_url,
            team_name: d.teams?.name || undefined,
          }));
          setAvailableMembers(members);
          if (members.length > 0) setSelectedInviteUser(members[0]);
        }
      }
    } catch (err) {
      console.warn('Could not load profiles:', err);
    }
  };

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

    const newCo: TaskCoAssignee = {
      id: selectedInviteUser.id,
      name: selectedInviteUser.full_name,
      avatar: selectedInviteUser.avatar_url,
      role: selectedInviteUser.role,
      teamName: selectedInviteUser.team_name,
    };

    const updatedList = [...coAssignees, newCo];
    setCoAssignees(updatedList);
    const updated = { ...task, coAssignees: updatedList };
    if (onTaskUpdated) onTaskUpdated(updated);

    if (isSupabaseConfigured) {
      await supabase.from('tasks').update({ co_assignees: updatedList }).eq('id', task.id);
    }

    setShowInviteModal(false);
    setSuccessMsg(`Added ${selectedInviteUser.full_name} as co-assignee!`);
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

    const newItem: SubtaskItem = {
      id: `sub-${Date.now()}`,
      title: newSubtaskTitle.trim(),
      completed: false,
    };

    const updated = [...subtasks, newItem];
    setSubtasks(updated);
    setNewSubtaskTitle('');

    const updatedTask = { ...task, subtasks: updated };
    if (onTaskUpdated) onTaskUpdated(updatedTask);
  };

  const toggleSubtask = (id: string) => {
    const updated = subtasks.map((st) => (st.id === id ? { ...st, completed: !st.completed } : st));
    setSubtasks(updated);
    const updatedTask = { ...task, subtasks: updated };
    if (onTaskUpdated) onTaskUpdated(updatedTask);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const commentObj: CommentItem = {
      id: `comment-${Date.now()}`,
      author: profile?.full_name || user?.email?.split('@')[0] || 'Team Member',
      avatar: profile?.avatar_url,
      text: newComment.trim(),
      timestamp: 'Just now',
    };

    const updated = [...comments, commentObj];
    setComments(updated);
    setNewComment('');

    const updatedTask = { ...task, comments: updated };
    if (onTaskUpdated) onTaskUpdated(updatedTask);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200/60">
                {task.code}
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-semibold text-slate-500">{task.project || 'Standalone Task'}</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 leading-tight">{task.title}</h2>
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

        {/* Tab Selection */}
        <div className="flex items-center gap-2 border-b border-slate-200">
          {[
            { id: 'details', label: 'Details', icon: FileText },
            { id: 'subtasks', label: `Subtasks (${subtasks.length})`, icon: CheckSquare },
            { id: 'comments', label: `Comments (${comments.length})`, icon: MessageSquare },
            { id: 'history', label: 'Activity Log', icon: History },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`pb-2 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === t.id ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Details Tab */}
        {activeTab === 'details' && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs">
              <div>
                <span className="text-slate-400 font-bold uppercase block text-[10px]">Current Status</span>
                <select
                  value={currentStatus}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="mt-1 font-bold text-slate-800 bg-white border border-slate-200 rounded-lg p-1.5 focus:ring-2 focus:ring-brand-500"
                >
                  {['Backlog', 'Todo', 'In Progress', 'In Review', 'Done'].map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="text-slate-400 font-bold uppercase block text-[10px]">Priority</span>
                <span className="font-bold text-slate-800 block mt-1">{currentPriority}</span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 uppercase">Task Description</label>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                {description || 'No detailed description provided.'}
              </p>
            </div>

            {/* Assignee & Co-Assignees Section */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase">Assignee & Co-Assignees</label>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  leftIcon={<UserPlus className="w-3.5 h-3.5 text-brand-600" />}
                  onClick={() => {
                    loadAvailableMembers();
                    setShowInviteModal(true);
                  }}
                >
                  Add Co-Assignee for Help
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Primary Assignee */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-50 rounded-xl border border-brand-200 text-xs">
                  <Avatar name={task.assignee?.name || 'Assignee'} size="xs" />
                  <div>
                    <span className="font-bold text-brand-900 block leading-tight">{task.assignee?.name}</span>
                    <span className="text-[9px] text-brand-600 uppercase font-semibold">Primary Lead</span>
                  </div>
                </div>

                {/* Co-Assignees */}
                {coAssignees.map((ca, i) => {
                  const badge = ca.role === 'Manager' ? 'Manager' : ca.teamName || 'Co-Assignee';
                  return (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                      <Avatar name={ca.name} size="xs" />
                      <div>
                        <span className="font-bold text-slate-800 block leading-tight">{ca.name}</span>
                        <span className="text-[9px] text-slate-500 uppercase font-semibold">({badge})</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Subtasks Tab */}
        {activeTab === 'subtasks' && (
          <div className="space-y-4 pt-2">
            <form onSubmit={handleAddSubtask} className="flex gap-2">
              <Input
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="Add hardware inspection or task item..."
                className="text-xs flex-1"
              />
              <Button type="submit" variant="primary" size="sm">
                Add Item
              </Button>
            </form>

            <div className="space-y-2">
              {subtasks.map((st) => (
                <div
                  key={st.id}
                  onClick={() => toggleSubtask(st.id)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100/80 cursor-pointer text-xs font-semibold"
                >
                  <input type="checkbox" checked={st.completed} onChange={() => {}} className="rounded text-brand-600" />
                  <span className={st.completed ? 'line-through text-slate-400' : 'text-slate-800'}>{st.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments Tab */}
        {activeTab === 'comments' && (
          <div className="space-y-4 pt-2">
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {comments.map((c) => (
                <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{c.author}</span>
                    <span className="text-[10px] text-slate-400">{c.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{c.text}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddComment} className="flex gap-2">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment or share update..."
                className="text-xs flex-1"
              />
              <Button type="submit" variant="primary" size="sm" leftIcon={<Send className="w-3.5 h-3.5" />}>
                Post
              </Button>
            </form>
          </div>
        )}

        {/* Co-Assignee Invitation Sub-Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-sm font-bold text-slate-900">Add Co-Assignee for Assistance</h4>
                <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600">
                  ✕
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Select Employee</label>
                <select
                  value={selectedInviteUser?.id || ''}
                  onChange={(e) => {
                    const found = availableMembers.find((m) => m.id === e.target.value);
                    if (found) setSelectedInviteUser(found);
                  }}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs font-medium focus:ring-2 focus:ring-brand-500"
                >
                  {availableMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.role === 'Manager' ? 'Manager' : m.team_name || m.role})
                    </option>
                  ))}
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
    </div>
  );
};
