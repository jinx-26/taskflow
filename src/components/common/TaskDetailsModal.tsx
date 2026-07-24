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
} from 'lucide-react';
import { TaskPlaceholder, UserProfile, SubtaskItem, TaskActivityLog, TaskCoAssignee } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { formatDisplayDate, softDeleteTask, inviteCoAssignee } from '../../services/taskService';
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
  const { user, profile } = useAuth();
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

  // Deletion Modal State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Invite Co-Assignee State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [availableMembers, setAvailableMembers] = useState<UserProfile[]>([]);
  const [selectedInviteUser, setSelectedInviteUser] = useState<UserProfile | null>(null);
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  const [successMsg, setSuccessMsg] = useState('');

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
      } else {
        const stored = localStorage.getItem(`taskflow_comments_${task.id}`);
        if (stored) {
          try {
            setComments(JSON.parse(stored));
          } catch (e) {
            setComments([]);
          }
        } else {
          setComments([]);
        }
      }
    }
  }, [task]);

  const loadWorkspaceMembers = async () => {
    try {
      if (isSupabaseConfigured) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .in('role', ['Manager', 'Lead', 'Member', 'Viewer']);

        if (data) {
          const filterables = (data as UserProfile[]).filter(
            (m) =>
              m.id !== task?.assignee?.id &&
              !coAssignees.some((c) => c.name === m.full_name) &&
              m.role !== 'SuperAdmin' &&
              m.role !== 'Admin'
          );
          setAvailableMembers(filterables);
          if (filterables.length > 0) {
            setSelectedInviteUser(filterables[0]);
          }
        }
      }
    } catch (e) {
      console.warn('Error loading available members:', e);
    }
  };

  if (!isOpen || !task) return null;

  const addActivityEntry = (action: string): TaskActivityLog[] => {
    const userName = profile?.full_name || user?.email?.split('@')[0] || 'Team Member';
    const entry: TaskActivityLog = {
      id: `act-${Date.now()}`,
      userName,
      userAvatar: profile?.avatar_url,
      action,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    const updated = [entry, ...activityLog];
    setActivityLog(updated);
    return updated;
  };

  const handleStatusChange = async (newStatus: 'Backlog' | 'Todo' | 'In Progress' | 'In Review' | 'Done') => {
    setCurrentStatus(newStatus);
    const updatedLogs = addActivityEntry(`changed status to "${newStatus}"`);

    const updatedTask: TaskPlaceholder = {
      ...task,
      status: newStatus,
      activityLog: updatedLogs,
    };

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('tasks')
          .update({ status: newStatus, activity_log: updatedLogs })
          .eq('id', task.id);
      } catch (err) {
        console.warn('Supabase status update:', err);
      }
    }

    setSuccessMsg(`Status updated to "${newStatus}"!`);
    if (onTaskUpdated) onTaskUpdated(updatedTask);
    setTimeout(() => setSuccessMsg(''), 2000);
  };

  const handleSaveDescription = async () => {
    const updatedLogs = addActivityEntry(`updated task detailed description box`);
    const updatedTask: TaskPlaceholder = {
      ...task,
      description,
      activityLog: updatedLogs,
    };

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('tasks')
          .update({ description, activity_log: updatedLogs })
          .eq('id', task.id);
      } catch (err) {
        console.warn('Description save error:', err);
      }
    }

    setSuccessMsg('Task description saved!');
    if (onTaskUpdated) onTaskUpdated(updatedTask);
    setTimeout(() => setSuccessMsg(''), 2000);
  };

  // Subtask Checkbox Toggle
  const handleToggleSubtask = async (subtaskId: string) => {
    const updatedSubtasks = subtasks.map((st) =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    setSubtasks(updatedSubtasks);

    const updatedTask: TaskPlaceholder = {
      ...task,
      subtasks: updatedSubtasks,
    };

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('tasks')
          .update({ subtasks: updatedSubtasks })
          .eq('id', task.id);
      } catch (e) {}
    }

    if (onTaskUpdated) onTaskUpdated(updatedTask);
  };

  // Add Subtask Item
  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

    const newItem: SubtaskItem = {
      id: `st-${Date.now()}`,
      title: newSubtaskTitle.trim(),
      completed: false,
    };

    const updatedSubtasks = [...subtasks, newItem];
    setSubtasks(updatedSubtasks);
    setNewSubtaskTitle('');

    const updatedTask: TaskPlaceholder = {
      ...task,
      subtasks: updatedSubtasks,
    };

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('tasks')
          .update({ subtasks: updatedSubtasks })
          .eq('id', task.id);
      } catch (e) {}
    }

    if (onTaskUpdated) onTaskUpdated(updatedTask);
  };

  // Send Collaboration Request
  const handleSendInvite = async () => {
    if (!selectedInviteUser || !profile) return;
    setIsSendingInvite(true);

    const success = await inviteCoAssignee(task, profile, selectedInviteUser);
    setIsSendingInvite(false);

    if (success) {
      setSuccessMsg(`Collaboration request sent to ${selectedInviteUser.full_name}!`);
      setShowInviteModal(false);
      setTimeout(() => setSuccessMsg(''), 2500);
    }
  };

  // Execute Audited Soft Delete Task
  const handleSoftDelete = async () => {
    setIsDeleting(true);
    const success = await softDeleteTask(task.id, user?.id, profile?.full_name);
    setIsDeleting(false);

    if (success) {
      setShowDeleteConfirm(false);
      onClose();
      if (onTaskDeleted) {
        onTaskDeleted(task.id);
      }
    }
  };

  const completedSubtasksCount = subtasks.filter((st) => st.completed).length;
  const subtasksPercent = subtasks.length > 0 ? Math.round((completedSubtasksCount / subtasks.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in-50 duration-150">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-soft-lg border border-slate-200/90 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                {task.code}
              </span>
              <span className="text-xs text-slate-400 font-mono">• {task.project}</span>
              {task.issueType && (
                <Badge variant={task.issueType === 'Bug' ? 'danger' : task.issueType === 'Feature' ? 'success' : 'neutral'}>
                  {task.issueType}
                </Badge>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              {task.title}
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Invite Co-Assignee Button */}
            <Button
              variant="outline"
              size="sm"
              className="text-xs text-brand-700 border-brand-200 hover:bg-brand-50"
              leftIcon={<UserPlus className="w-3.5 h-3.5 text-brand-600" />}
              onClick={() => {
                loadWorkspaceMembers();
                setShowInviteModal(true);
              }}
            >
              Share / Invite Member
            </Button>

            {/* Audited Soft Delete Task Button */}
            <Button
              variant="outline"
              size="sm"
              className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
              leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete
            </Button>

            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-slate-100 bg-slate-50 px-6">
          <button
            onClick={() => setActiveTab('details')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'details'
                ? 'border-brand-600 text-brand-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Task Info
          </button>

          <button
            onClick={() => setActiveTab('subtasks')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'subtasks'
                ? 'border-brand-600 text-brand-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" />
            Subtasks ({completedSubtasksCount}/{subtasks.length})
          </button>

          <button
            onClick={() => setActiveTab('comments')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'comments'
                ? 'border-brand-600 text-brand-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Comments ({comments.length})
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-brand-600 text-brand-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Audit Stream
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: Task Details & Information Box */}
          {activeTab === 'details' && (
            <div className="space-y-5">
              {/* Status & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Status
                  </label>
                  <select
                    value={currentStatus}
                    onChange={(e) => handleStatusChange(e.target.value as any)}
                    className="w-full bg-white text-slate-900 text-xs rounded-xl border border-slate-200 px-3 py-2.5 h-10 font-bold focus:outline-none focus:border-brand-500"
                  >
                    <option value="Todo">Todo</option>
                    <option value="In Progress">In Progress</option>
                    <option value="In Review">In Review</option>
                    <option value="Done">Done (Completed ✅)</option>
                    <option value="Backlog">Backlog</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Priority
                  </label>
                  <select
                    value={currentPriority}
                    onChange={(e) => setCurrentPriority(e.target.value as any)}
                    className="w-full bg-white text-slate-900 text-xs rounded-xl border border-slate-200 px-3 py-2.5 h-10 font-medium focus:outline-none focus:border-brand-500"
                  >
                    <option value="Urgent">🔴 Urgent</option>
                    <option value="High">🟠 High</option>
                    <option value="Medium">🟡 Medium</option>
                    <option value="Low">🔵 Low</option>
                  </select>
                </div>
              </div>

              {/* Assignees & Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-soft-xs space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                    Primary Assignee
                  </span>
                  <div className="flex items-center gap-2">
                    <Avatar src={task.assignee?.avatar} name={task.assignee?.name} size="xs" />
                    <span className="font-bold text-slate-900 truncate">{task.assignee?.name}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-soft-xs space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                    Co-Assignees ({coAssignees.length})
                  </span>
                  {coAssignees.length === 0 ? (
                    <span className="text-slate-400 italic">None added</span>
                  ) : (
                    <div className="flex items-center gap-1 overflow-x-auto">
                      {coAssignees.map((c, idx) => (
                        <Avatar key={idx} src={c.avatar} name={c.name} size="xs" />
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-soft-xs space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                    Due Date
                  </span>
                  <span className="font-bold text-slate-900 block">{formatDisplayDate(task.dueDate)}</span>
                </div>
              </div>

              {/* Detailed Description / Information Box */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-brand-600" />
                    Task Information Box & Technical Instructions
                  </label>
                  <Button variant="outline" size="sm" className="text-[11px] h-7" onClick={handleSaveDescription}>
                    Save Description
                  </Button>
                </div>

                <textarea
                  rows={5}
                  placeholder="Provide detailed instructions, specifications, technical criteria, or expected output for this task..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-medium text-slate-900 leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* TAB 2: Subtasks Checklist */}
          {activeTab === 'subtasks' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>Subtasks Progress</span>
                  <span className="text-brand-600">{subtasksPercent}% Complete</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-600 transition-all duration-300 rounded-full"
                    style={{ width: `${subtasksPercent}%` }}
                  />
                </div>
              </div>

              <form onSubmit={handleAddSubtask} className="flex gap-2 pt-2">
                <Input
                  placeholder="Add a new subtask action item..."
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  className="text-xs"
                />
                <Button type="submit" variant="primary" size="md" className="shrink-0 text-xs">
                  Add Item
                </Button>
              </form>

              <div className="space-y-2 pt-2">
                {subtasks.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No subtasks added yet.</p>
                ) : (
                  subtasks.map((st) => (
                    <div
                      key={st.id}
                      onClick={() => handleToggleSubtask(st.id)}
                      className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                        st.completed
                          ? 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                          : 'bg-white border-slate-200/80 text-slate-900 hover:border-brand-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={st.completed}
                        onChange={() => {}}
                        className="w-4 h-4 text-brand-600 rounded cursor-pointer"
                      />
                      <span className="text-xs font-medium flex-1">{st.title}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Comments */}
          {activeTab === 'comments' && (
            <div className="space-y-4">
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!newComment.trim()) return;
                const commentObj: CommentItem = {
                  id: `c-${Date.now()}`,
                  author: profile?.full_name || user?.email?.split('@')[0] || 'Team Member',
                  avatar: profile?.avatar_url,
                  text: newComment.trim(),
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                };
                const updated = [commentObj, ...comments];
                setComments(updated);
                if (isSupabaseConfigured) {
                  await supabase.from('tasks').update({ comments: updated }).eq('id', task.id);
                }
                setNewComment('');
              }} className="flex gap-2">
                <Input
                  placeholder="Post a comment or update..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="text-xs"
                />
                <Button type="submit" variant="primary" size="md" className="shrink-0 text-xs" leftIcon={<Send className="w-3.5 h-3.5" />}>
                  Post
                </Button>
              </form>

              <div className="space-y-2 pt-2">
                {comments.map((c) => (
                  <div key={c.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2.5">
                    <Avatar src={c.avatar} name={c.author} size="xs" />
                    <div className="flex-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{c.author}</span>
                        <span className="text-[10px] text-slate-400">{c.timestamp}</span>
                      </div>
                      <p className="text-slate-600 mt-0.5">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: Activity Log Audit Stream */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Historical Activity & Audit Stream
              </h4>
              {activityLog.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No activity logged for this task yet.</p>
              ) : (
                <div className="space-y-2">
                  {activityLog.map((act) => (
                    <div key={act.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Avatar src={act.userAvatar} name={act.userName} size="xs" />
                        <span>
                          <strong className="font-semibold text-slate-900">{act.userName}</strong> {act.action}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">{act.timestamp}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Share / Invite Co-Assignee Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand-600" />
                Invite Co-Assignee / Collaborator
              </h3>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              If you cannot complete this task alone, select another workspace member to invite them as a co-assignee. A **Collaboration Request** will be sent for their approval.
            </p>

            <div className="space-y-1.5 pt-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Select Team Member to Invite
              </label>
              {availableMembers.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No additional workspace members available to invite.</p>
              ) : (
                <select
                  value={selectedInviteUser?.id || ''}
                  onChange={(e) => {
                    const found = availableMembers.find((m) => m.id === e.target.value);
                    if (found) setSelectedInviteUser(found);
                  }}
                  className="w-full bg-white text-slate-900 text-xs rounded-xl border border-slate-200 px-3 py-2.5 h-10 font-medium focus:outline-none focus:border-brand-500"
                >
                  {availableMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.role})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-2 pt-3">
              <Button variant="outline" size="md" className="flex-1 text-xs" onClick={() => setShowInviteModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                className="flex-1 text-xs font-semibold shadow-soft"
                onClick={handleSendInvite}
                isLoading={isSendingInvite}
                disabled={availableMembers.length === 0}
              >
                Send Request
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Audited Soft Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                Confirm Task Soft Deletion
              </h3>
              <button onClick={() => setShowDeleteConfirm(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Task <strong className="text-slate-900 font-semibold">{task.code}</strong> will be removed from your active Kanban board. The data will be safely soft-deleted and retained in the database for complete historical audit compliance.
            </p>

            <div className="flex items-center gap-2 pt-3">
              <Button variant="outline" size="md" className="flex-1 text-xs" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                className="flex-1 text-xs font-semibold bg-rose-600 hover:bg-rose-700"
                onClick={handleSoftDelete}
                isLoading={isDeleting}
              >
                Soft Delete Task
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
