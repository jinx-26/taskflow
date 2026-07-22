import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { Input } from '../ui/Input';
import { X, CheckCircle2, Clock, MessageSquare, Send, Tag, User, Sparkles } from 'lucide-react';
import { TaskPlaceholder } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

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
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  isOpen,
  onClose,
  task,
  onTaskUpdated,
}) => {
  const { user } = useAuth();
  const [currentStatus, setCurrentStatus] = useState<'Backlog' | 'Todo' | 'In Progress' | 'In Review' | 'Done'>('In Progress');
  const [currentPriority, setCurrentPriority] = useState<'Urgent' | 'High' | 'Medium' | 'Low'>('High');
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (task) {
      setCurrentStatus(task.status);
      setCurrentPriority(task.priority);
      setSuccessMsg('');

      // Prefer live Supabase comments
      if (Array.isArray((task as any).comments) && (task as any).comments.length > 0) {
        setComments((task as any).comments);
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

  if (!isOpen || !task) return null;

  const handleStatusChange = async (newStatus: 'Backlog' | 'Todo' | 'In Progress' | 'In Review' | 'Done') => {
    setCurrentStatus(newStatus);
    setIsUpdating(true);

    const updatedTask: TaskPlaceholder = {
      ...task,
      status: newStatus,
    };

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('tasks')
          .update({ status: newStatus })
          .eq('id', task.id);
      } catch (err) {
        console.warn('Supabase status update:', err);
      }
    }

    setIsUpdating(false);
    setSuccessMsg(`Status updated to "${newStatus}"!`);
    if (onTaskUpdated) {
      onTaskUpdated(updatedTask);
    }

    setTimeout(() => setSuccessMsg(''), 2000);
  };

  const handlePriorityChange = async (newPriority: 'Urgent' | 'High' | 'Medium' | 'Low') => {
    setCurrentPriority(newPriority);
    const updatedTask: TaskPlaceholder = {
      ...task,
      priority: newPriority,
    };

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('tasks')
          .update({ priority: newPriority })
          .eq('id', task.id);
      } catch (err) {
        console.warn('Supabase priority update:', err);
      }
    }

    if (onTaskUpdated) {
      onTaskUpdated(updatedTask);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !task) return;

    const commentObj: CommentItem = {
      id: `c-${Date.now()}`,
      author: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Team Member',
      avatar: user?.user_metadata?.avatar_url,
      text: newComment.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updated = [commentObj, ...comments];
    setComments(updated);

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('tasks')
          .update({ comments: updated })
          .eq('id', task.id);
      } catch (err) {
        console.warn('Supabase comment sync error:', err);
      }
    }

    localStorage.setItem(`taskflow_comments_${task.id}`, JSON.stringify(updated));
    setNewComment('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in-50 duration-150">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-soft-lg border border-slate-200/90 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Banner Header */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                {task.code}
              </span>
              <span className="text-xs text-slate-400 font-mono">• {task.project}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              {task.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Status & Controls Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            {/* Change Status */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Update Status
              </label>
              <select
                value={currentStatus}
                onChange={(e) => handleStatusChange(e.target.value as any)}
                className="w-full bg-white text-slate-900 text-xs rounded-xl border border-slate-200 px-3 py-2.5 h-10 font-bold focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="Todo">Todo</option>
                <option value="In Progress">In Progress</option>
                <option value="In Review">In Review</option>
                <option value="Done">Done (Completed ✅)</option>
                <option value="Backlog">Backlog</option>
              </select>
            </div>

            {/* Change Priority */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Update Priority
              </label>
              <select
                value={currentPriority}
                onChange={(e) => handlePriorityChange(e.target.value as any)}
                className="w-full bg-white text-slate-900 text-xs rounded-xl border border-slate-200 px-3 py-2.5 h-10 font-medium focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          {/* Details Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-slate-200/80 shadow-soft-xs">
              <Avatar src={task.assignee?.avatar} name={task.assignee?.name} size="xs" />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Assigned To</span>
                <span className="font-bold text-slate-900 truncate block">{task.assignee?.name}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-slate-200/80 shadow-soft-xs">
              <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                ✍️
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Assigned By</span>
                <span className="font-bold text-slate-900 truncate block">{(task as any).createdBy || 'Sarita Rani Guleria (Manager)'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-slate-200/80 shadow-soft-xs">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Due Date</span>
                <span className="font-bold text-slate-900 truncate block">{task.dueDate}</span>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-brand-600" />
              Task Comments & Notes ({comments.length})
            </h3>

            {/* Add Comment Input */}
            <form onSubmit={handleAddComment} className="flex gap-2">
              <Input
                placeholder="Write a comment or status note..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="text-xs"
              />
              <Button type="submit" variant="primary" size="md" className="shrink-0 text-xs" leftIcon={<Send className="w-3.5 h-3.5" />}>
                Post
              </Button>
            </form>

            {/* Comments List */}
            {comments.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No comments posted yet on this task.</p>
            ) : (
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
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
          <Button
            variant={currentStatus === 'Done' ? 'secondary' : 'primary'}
            size="md"
            className="text-xs font-semibold"
            onClick={() => handleStatusChange(currentStatus === 'Done' ? 'In Progress' : 'Done')}
          >
            {currentStatus === 'Done' ? 'Re-open Task' : 'Mark Task Complete ✅'}
          </Button>

          <Button variant="outline" size="md" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
