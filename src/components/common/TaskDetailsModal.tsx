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
  Paperclip,
  Download,
  History,
  MessageSquare,
  UserCheck,
  Mail,
  Upload,
} from 'lucide-react';
import { TaskPlaceholder, UserProfile, TaskCoAssignee, IssueType, CollaborationRequest } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { inviteCoAssignee, respondToInvite, softDeleteTask } from '../../services/taskService';
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
  const [pendingInvitations, setPendingInvitations] = useState<CollaborationRequest[]>(task?.pendingInvitations || []);
  const [subtasks, setSubtasks] = useState(task?.subtasks || []);
  const [activityLog, setActivityLog] = useState(task?.activityLog || []);
  const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'comments'>('details');

  // Co-assignee modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [availableMembers, setAvailableMembers] = useState<UserProfile[]>([]);
  const [selectedInviteUser, setSelectedInviteUser] = useState<UserProfile | null>(null);

  // Review File Upload & 2-Step Deletion Modal State
  const [isUploadingReviewFile, setIsUploadingReviewFile] = useState(false);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);

  const [successMsg, setSuccessMsg] = useState('');

  const isManagerOrAdmin =
    userRole === 'Admin' ||
    userRole === 'Manager' ||
    profile?.role === 'Admin' ||
    profile?.role === 'Manager' ||
    user?.email?.toLowerCase() === 'jignesh.giri2005@gmail.com';

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

  // Handler for post-creation file uploads for review
  const handleUploadReviewFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const filesToUpload = Array.from(e.target.files).slice(0, 10);
    setIsUploadingReviewFile(true);

    const newAttachments: Array<{ name: string; url: string }> = [];

    for (const file of filesToUpload) {
      let fileUrl = '';
      if (isSupabaseConfigured) {
        try {
          const filePath = `tasks/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const { error: uploadErr } = await supabase.storage
            .from('task-attachments')
            .upload(filePath, file);

          if (!uploadErr) {
            const { data: pubData } = supabase.storage.from('task-attachments').getPublicUrl(filePath);
            fileUrl = pubData.publicUrl;
          }
        } catch (storageErr) {
          console.warn('Review upload storage warning:', storageErr);
        }
      }
      if (!fileUrl) {
        fileUrl = URL.createObjectURL(file);
      }
      newAttachments.push({ name: file.name, url: fileUrl });
    }

    // Append new markdown attachment links to description
    const newMarkdownLinks = newAttachments
      .map((f) => `📎 Attachment: [${f.name}](${f.url})`)
      .join('\n');

    const updatedDescription = description
      ? `${description.trim()}\n\n${newMarkdownLinks}`
      : newMarkdownLinks;

    setDescription(updatedDescription);

    // Add activity log entries for uploaded files
    const logEntries = newAttachments.map((f) => ({
      id: `log-${Date.now()}-${Math.random()}`,
      userName: profile?.full_name || 'Team Member',
      userAvatar: profile?.avatar_url,
      action: `uploaded file for review: "${f.name}".`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));

    const updatedLogs = [...logEntries, ...activityLog];
    setActivityLog(updatedLogs);

    if (isSupabaseConfigured) {
      await supabase
        .from('tasks')
        .update({ description: updatedDescription, activity_log: updatedLogs })
        .eq('id', task.id);
    }

    setIsUploadingReviewFile(false);
    setSuccessMsg(`Successfully uploaded ${newAttachments.length} file(s) for review!`);
    setTimeout(() => setSuccessMsg(''), 4000);

    const updatedTask = { ...task, description: updatedDescription, activityLog: updatedLogs };
    if (onTaskUpdated) onTaskUpdated(updatedTask);
    window.dispatchEvent(new CustomEvent('taskflow:task-created', { detail: updatedTask }));
  };

  // Manager 2-Step Confirmation Task Delete Handler
  const handleConfirmDeleteTask = async () => {
    const success = await softDeleteTask(task.id, user?.id, profile?.full_name);
    setDeleteStep(0);
    if (success) {
      setSuccessMsg(`Task ${task.code} deleted successfully.`);
      window.dispatchEvent(new CustomEvent('taskflow:task-created'));
      setTimeout(() => {
        onClose();
        if (onTaskUpdated) onTaskUpdated({ ...task, isDeleted: true });
      }, 600);
    }
  };

  useEffect(() => {
    if (task) {
      setCurrentStatus(task.status);
      setCurrentPriority(task.priority);
      setDescription(task.description || '');
      setCoAssignees(task.coAssignees || []);
      setPendingInvitations(task.pendingInvitations || []);
      setSubtasks(task.subtasks || []);
      setActivityLog(task.activityLog || []);
      setSuccessMsg('');

      if (Array.isArray(task.comments) && task.comments.length > 0) {
        setComments(task.comments);
      }
    }
    loadAvailableMembers();
  }, [task, isOpen]);

  // Real-Time WebSocket Subscription for Live Comments & Updates
  useEffect(() => {
    if (!isSupabaseConfigured || !task?.id || !isOpen) return;

    const channel = supabase
      .channel(`task_live_${task.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `id=eq.${task.id}`,
        },
        (payload: any) => {
          if (!payload?.new) return;
          const updated = payload.new;
          if (updated.comments) setComments(updated.comments);
          if (updated.activity_log) setActivityLog(updated.activity_log);
          if (updated.co_assignees) setCoAssignees(updated.co_assignees);
          if (updated.pending_invitations) setPendingInvitations(updated.pending_invitations);
          if (updated.status) setCurrentStatus(updated.status);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [task?.id, isOpen]);

  useEffect(() => {
    if (showInviteModal) {
      loadAvailableMembers();
    }
  }, [showInviteModal]);

  if (!isOpen || !task) return null;

  const handleStatusChange = async (newStatus: any) => {
    setCurrentStatus(newStatus);
    const newLog = {
      id: `log-${Date.now()}`,
      userName: profile?.full_name || 'Member',
      userAvatar: profile?.avatar_url,
      action: `updated status to "${newStatus}".`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    const updatedLogs = [newLog, ...activityLog];
    setActivityLog(updatedLogs);

    const updated = { ...task, status: newStatus, activityLog: updatedLogs };
    if (onTaskUpdated) onTaskUpdated(updated);

    if (isSupabaseConfigured) {
      await supabase
        .from('tasks')
        .update({ status: newStatus, activity_log: updatedLogs })
        .eq('id', task.id);
    }
  };

  const handleAddCoAssignee = async () => {
    if (!selectedInviteUser || !profile) return;

    // Check if already assigned
    if (coAssignees.some((ca) => ca.id === selectedInviteUser.id || ca.name === selectedInviteUser.full_name)) {
      setSuccessMsg(`${selectedInviteUser.full_name} is already assigned to this task.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      setShowInviteModal(false);
      return;
    }

    if (isManagerOrAdmin) {
      // Manager/Admin can directly add co-assignee
      const newCo: TaskCoAssignee = {
        id: selectedInviteUser.id,
        name: selectedInviteUser.full_name,
        avatar: selectedInviteUser.avatar_url,
        role: selectedInviteUser.role,
      };

      const updatedCoAssignees = [...coAssignees, newCo];
      setCoAssignees(updatedCoAssignees);

      const newLog = {
        id: `log-${Date.now()}`,
        userName: profile.full_name,
        userAvatar: profile.avatar_url,
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

        await sendNotification({
          recipientEmail: selectedInviteUser.full_name,
          senderName: profile.full_name,
          title: `Co-Assigned to Task ${task.code}`,
          message: `${profile.full_name} added you as a co-assignee on "${task.title}".`,
          taskCode: task.code,
          type: 'collab_request',
        });
      }

      setSuccessMsg(`Successfully co-assigned ${selectedInviteUser.full_name}!`);
      if (onTaskUpdated) onTaskUpdated({ ...task, coAssignees: updatedCoAssignees });
    } else {
      // Members/Engineers must send a collaboration request requiring target member approval
      const success = await inviteCoAssignee(task, profile, selectedInviteUser);
      if (success) {
        setSuccessMsg(`Collaboration request sent to ${selectedInviteUser.full_name}! Awaiting their acceptance.`);
        setPendingInvitations((prev) => [
          ...prev,
          {
            id: `inv-${Date.now()}`,
            taskId: task.id,
            taskCode: task.code,
            taskTitle: task.title,
            invitedByName: profile.full_name,
            invitedById: profile.id,
            targetUserId: selectedInviteUser.id,
            targetUserEmail: selectedInviteUser.full_name,
            status: 'Pending',
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    }

    setTimeout(() => setSuccessMsg(''), 4000);
    setShowInviteModal(false);
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

    const newLog = {
      id: `log-${Date.now()}`,
      userName: profile?.full_name || 'Member',
      userAvatar: profile?.avatar_url,
      action: `commented: "${newComment.trim().slice(0, 40)}${newComment.length > 40 ? '...' : ''}"`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    const updatedLogs = [newLog, ...activityLog];
    setActivityLog(updatedLogs);

    if (isSupabaseConfigured) {
      await supabase
        .from('tasks')
        .update({ comments: updatedComments, activity_log: updatedLogs })
        .eq('id', task.id);
    }
    if (onTaskUpdated) onTaskUpdated({ ...task, comments: updatedComments, activityLog: updatedLogs });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
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

          <div className="flex items-center gap-2">
            {isManagerOrAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-bold text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 transition-colors"
                leftIcon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
                onClick={() => setDeleteStep(1)}
              >
                Delete Task
              </Button>
            )}
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
              <X className="w-5 h-5" />
            </button>
          </div>
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

        {/* View Navigation Tabs */}
        <div className="flex items-center border-b border-slate-200 gap-6 text-xs font-bold">
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-2 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'details'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Task Details & Files
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`pb-2 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'timeline'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Activity Timeline ({activityLog.length})
          </button>

          <button
            onClick={() => setActiveTab('comments')}
            className={`pb-2 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'comments'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Comments ({comments.length})
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Real-time WebSockets Live" />
          </button>
        </div>

        {/* TAB 1: DETAILS */}
        {activeTab === 'details' && (() => {
          let cleanDesc = (description || '')
            .replace(/📎 Attachment: \[(.*?)\]\((.*?)\)/g, '')
            .trim();

          // Extract all attachment links (from single prop, list prop, or description links)
          const allAttachmentsList: Array<{ name: string; url: string }> = [];

          if (task.attachmentUrl) {
            allAttachmentsList.push({ name: task.attachmentName || 'Attachment', url: task.attachmentUrl });
          }

          if (description && description.includes('📎 Attachment:')) {
            const matches = description.matchAll(/📎 Attachment: \[(.*?)\]\((.*?)\)/g);
            for (const match of matches) {
              if (!allAttachmentsList.some((a) => a.url === match[2])) {
                allAttachmentsList.push({ name: match[1], url: match[2] });
              }
            }
          }

          return (
            <div className="space-y-4">
              {/* Description */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Description & Notes</h3>
                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                  {cleanDesc || 'No additional instructions provided for this task.'}
                </p>
              </div>

              {/* Specification & Post-Creation Review Files Section */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-brand-600" />
                    Task Specification & Review Files ({allAttachmentsList.length})
                  </h3>
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold rounded-xl border border-brand-200 transition-colors">
                    <Upload className="w-3.5 h-3.5 text-brand-600" />
                    <span>{isUploadingReviewFile ? 'Uploading...' : '+ Upload File(s) for Review'}</span>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleUploadReviewFiles}
                      disabled={isUploadingReviewFile}
                    />
                  </label>
                </div>

                {allAttachmentsList.length === 0 ? (
                  <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    No files attached yet. Team members and assignees can click "+ Upload File(s) for Review" above to submit review files.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {allAttachmentsList.map((att, idx) => {
                      const filename = att.name;
                      const ext = (filename.split('.').pop() || '').toLowerCase();
                      let typeLabel = 'Attached File';
                      let typeTag = ext.toUpperCase() || 'FILE';
                      let tagStyle = 'bg-slate-100 text-slate-700 border-slate-200';

                      if (['pdf'].includes(ext)) {
                        typeLabel = 'PDF Document';
                        tagStyle = 'bg-red-50 text-red-700 border-red-200';
                      } else if (['doc', 'docx'].includes(ext)) {
                        typeLabel = 'Word Document';
                        tagStyle = 'bg-blue-50 text-blue-700 border-blue-200';
                      } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
                        typeLabel = 'Excel Spreadsheet';
                        tagStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      } else if (['ppt', 'pptx'].includes(ext)) {
                        typeLabel = 'PowerPoint Presentation';
                        tagStyle = 'bg-amber-50 text-amber-700 border-amber-200';
                      } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
                        typeLabel = 'Compressed Archive (ZIP/RAR)';
                        tagStyle = 'bg-purple-50 text-purple-700 border-purple-200';
                      } else if (['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'].includes(ext)) {
                        typeLabel = 'Image File';
                        tagStyle = 'bg-indigo-50 text-indigo-700 border-indigo-200';
                      } else if (['cad', 'dwg', 'dxf', 'sch', 'brd', 'pcb'].includes(ext)) {
                        typeLabel = 'CAD / Hardware Schematic File';
                        tagStyle = 'bg-cyan-50 text-cyan-700 border-cyan-200';
                      }

                      return (
                        <div key={idx} className="flex items-center justify-between p-3 bg-brand-50/50 border border-brand-200/80 rounded-xl">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
                              <Paperclip className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900 block truncate max-w-xs">{filename}</span>
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${tagStyle}`}>
                                  {typeTag}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500">{typeLabel}</span>
                            </div>
                          </div>

                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-800 bg-white px-3 py-1.5 rounded-lg border border-brand-200 shadow-xs shrink-0"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Spec</span>
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Co-Assignees & Pending Invitations Section */}
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
                    + Request Co-Assignee
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

                  {/* Active Co-Assignees */}
                  {coAssignees.map((ca, idx) => (
                    <div key={ca.id || idx} className="flex items-center gap-2 p-2 bg-slate-100 border border-slate-200 rounded-xl">
                      <Avatar name={ca.name} src={ca.avatar} size="xs" />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block leading-none">{ca.name}</span>
                        <span className="text-[10px] text-slate-500 font-medium">Co-Assignee</span>
                      </div>
                    </div>
                  ))}

                  {/* Pending Invitations */}
                  {pendingInvitations
                    .filter((inv) => inv.status === 'Pending')
                    .map((inv) => (
                      <div key={inv.id} className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200/80 rounded-xl">
                        <div className="w-6 h-6 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center font-bold text-[10px]">
                          ?
                        </div>
                        <div>
                          <span className="text-xs font-bold text-amber-900 block leading-none">{inv.targetUserEmail}</span>
                          <span className="text-[10px] text-amber-700 font-semibold">Invitation Pending Acceptance</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* TAB 2: TIMELINE */}
        {activeTab === 'timeline' && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2">
              <History className="w-4 h-4 text-brand-600" />
              Task Activity Audit Trail
            </h3>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {activityLog.length === 0 ? (
                <p className="text-xs text-slate-400 p-4 text-center">No recorded activity logs yet.</p>
              ) : (
                activityLog.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <Avatar name={log.userName || 'Member'} src={log.userAvatar} size="xs" />
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900">{log.userName}</span>
                        <span className="text-[10px] font-semibold text-slate-400">{log.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-normal">{log.action}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: REAL-TIME COMMENTS */}
        {activeTab === 'comments' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-brand-600" />
                Live Comments & Discussion
              </h3>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Realtime WebSockets Active
              </span>
            </div>

            <form onSubmit={handleAddComment} className="flex items-center gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment or update (syncs live)..."
                className="flex-1 rounded-xl border border-slate-200 p-2.5 text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
              <Button type="submit" variant="primary" size="sm" leftIcon={<Send className="w-3.5 h-3.5" />}>
                Post
              </Button>
            </form>

            <div className="space-y-2 max-h-64 overflow-y-auto pt-1 pr-1">
              {comments.length === 0 ? (
                <p className="text-xs text-slate-400 p-4 text-center">No comments posted yet. Start the conversation!</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-800">{c.authorName}</span>
                      <span className="text-slate-400">{c.createdAt}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{c.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Co-Assignee Sub-Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-brand-600" />
                Request Co-Assignee Assistance
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
                Send Invitation Request
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 2-STEP CONFIRMATION DELETE TASK MODAL */}
      {deleteStep > 0 && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 select-none">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-red-100 animate-in zoom-in-95">
            {deleteStep === 1 ? (
              <>
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black">
                    ⚠️
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-amber-600 tracking-wider">Step 1 of 2 • Manager Safety Check</span>
                    <h3 className="text-base font-extrabold text-slate-900">Confirm Deletion Request</h3>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Manager Authorization Required: Are you sure you want to delete task <strong className="text-slate-900">{task.code}</strong> ("{task.title}")? This action will remove it from department workspace boards.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button variant="outline" size="sm" onClick={() => setDeleteStep(0)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                    onClick={() => setDeleteStep(2)}
                  >
                    Proceed to Final Step (2/2) →
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-red-100 pb-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-black">
                    🚨
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-red-600 tracking-wider">Step 2 of 2 • Final Confirmation</span>
                    <h3 className="text-base font-extrabold text-red-900">Permanent Deletion Warning</h3>
                  </div>
                </div>

                <div className="p-3 bg-red-50 text-red-800 rounded-xl text-xs font-medium border border-red-200 space-y-1">
                  <p className="font-bold">⚠️ Final Safety Confirmation:</p>
                  <p>Are you ABSOLUTELY sure? This is your SECOND confirmation to delete task <strong>{task.code}</strong>.</p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button variant="outline" size="sm" onClick={() => setDeleteStep(0)}>
                    Cancel & Keep Task
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 border-none text-white font-bold"
                    onClick={handleConfirmDeleteTask}
                  >
                    🔴 Confirm Permanent Deletion
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
