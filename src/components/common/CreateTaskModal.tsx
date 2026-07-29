import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { X, CheckSquare, User, Calendar, Tag, AlertCircle, FileText, Clock, Layers, Users, Check, Upload, Paperclip } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { sendNotification } from '../../services/notificationService';
import { addLocalTask } from '../../services/taskService';
import { UserProfile, IssueType, CollaborationRequest } from '../../types';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated?: (newTask: any) => void;
}

const isUuid = (val?: string | null) =>
  typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onTaskCreated,
}) => {
  const { user, profile, userRole } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [issueType, setIssueType] = useState<IssueType>('General Task');
  const [isStandalone, setIsStandalone] = useState(true);
  const [project, setProject] = useState('General Task Hub');
  const [priority, setPriority] = useState<'Urgent' | 'High' | 'Medium' | 'Low'>('High');
  const getNextWeekString = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  };

  const [dueDate, setDueDate] = useState(getNextWeekString());
  const [partNumber, setPartNumber] = useState('');
  const [hardwareRev, setHardwareRev] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // File Attachment State (Up to 10 files)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  const [workspaceMembers, setWorkspaceMembers] = useState<UserProfile[]>([]);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [assignAll, setAssignAll] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  const isManagerOrAdmin =
    userRole === 'Admin' ||
    userRole === 'Manager' ||
    profile?.role === 'Admin' ||
    profile?.role === 'Manager' ||
    user?.email?.toLowerCase() === 'jignesh.giri2005@gmail.com';

  const loadWorkspaceMembers = async () => {
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
      setAttachedFiles([]);
      setDueDate(getNextWeekString());
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

  const handleRemoveFile = (indexToRemove: number) => {
    setAttachedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

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

    const secondaryMembers = workspaceMembers.filter(
      (m) => selectedAssigneeIds.includes(m.id) && m.id !== primaryAssigneeObj.id
    );

    let coAssigneesList: any[] = [];
    let pendingInvitesList: CollaborationRequest[] = [];

    if (isManagerOrAdmin) {
      coAssigneesList = secondaryMembers.map((m) => ({
        id: m.id,
        name: m.full_name,
        avatar: m.avatar_url,
        role: m.role,
      }));
    } else {
      pendingInvitesList = secondaryMembers.map((m) => ({
        id: `inv-${Date.now()}-${m.id}`,
        taskId: '',
        taskCode: taskCode,
        taskTitle: title.trim(),
        invitedByName: profile?.full_name || 'Member',
        invitedById: user.id,
        targetUserId: m.id,
        targetUserEmail: m.full_name,
        status: 'Pending',
        createdAt: new Date().toISOString(),
      }));
    }

    // Process all attached files (Up to 10)
    const uploadedFilesList: Array<{ name: string; url: string }> = [];

    for (const file of attachedFiles) {
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
          console.warn('File upload storage error, falling back:', storageErr);
        }
      }
      if (!fileUrl) {
        fileUrl = URL.createObjectURL(file);
      }
      uploadedFilesList.push({ name: file.name, url: fileUrl });
    }

    const activityLogEntry = {
      id: `log-${Date.now()}`,
      userName: profile?.full_name || 'Member',
      userAvatar: profile?.avatar_url,
      action: `created task ${taskCode}${uploadedFilesList.length > 0 ? ` with ${uploadedFilesList.length} file attachment(s)` : ''}.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Full in-memory object for UI & State
    const fullTaskObject: any = {
      id: `task-${Date.now()}`,
      code: taskCode,
      title: title.trim(),
      description: description.trim(),
      issueType,
      project: isStandalone ? 'Standalone Task' : project.trim(),
      priority,
      status: 'Todo',
      assignee: {
        id: primaryAssigneeObj.id,
        name: primaryAssigneeObj.full_name,
        avatar: primaryAssigneeObj.avatar_url,
      },
      coAssignees: coAssigneesList,
      pendingInvitations: pendingInvitesList,
      attachmentUrl: uploadedFilesList[0]?.url || null,
      attachmentName: uploadedFilesList[0]?.name || null,
      attachments: uploadedFilesList,
      partNumber: partNumber.trim() || null,
      hardwareRev: hardwareRev.trim() || null,
      createdBy: user.id,
      createdByName: profile?.full_name || 'Member',
      dueDate,
      createdAt: new Date().toISOString(),
      activityLog: [activityLogEntry],
      comments: [],
      subtasks: [],
      isDeleted: false,
    };

    // Store in local session cache immediately
    addLocalTask(fullTaskObject);

    const attachmentLinksMarkdown = uploadedFilesList
      .map((f) => `📎 Attachment: [${f.name}](${f.url})`)
      .join('\n');

    const dbDescription = attachmentLinksMarkdown
      ? `${description.trim()}\n\n${attachmentLinksMarkdown}`
      : description.trim();

    // Payload for Supabase DB Insert (Only columns existing on Supabase schema cache)
    const dbInsertPayload: any = {
      code: taskCode,
      title: title.trim(),
      description: dbDescription,
      issue_type: issueType,
      project: isStandalone ? 'Standalone Task' : project.trim(),
      priority,
      status: 'Todo',
      assignee_id: isUuid(primaryAssigneeObj.id) ? primaryAssigneeObj.id : null,
      assignee_name: primaryAssigneeObj.full_name,
      assignee_avatar: primaryAssigneeObj.avatar_url || '',
      co_assignees: coAssigneesList,
      pending_invitations: pendingInvitesList,
      part_number: partNumber.trim() || null,
      hardware_rev: hardwareRev.trim() || null,
      created_by: isUuid(user.id) ? user.id : null,
      due_date: dueDate,
      activity_log: [activityLogEntry],
    };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('tasks').insert([dbInsertPayload]).select().single();

        if (!error && data) {
          fullTaskObject.id = data.id;
        } else if (error) {
          console.warn('Supabase task insert notice (saved to session fallback):', error.message);
        }

        // Notify primary assignee
        sendNotification({
          recipientEmail: primaryAssigneeObj.full_name,
          senderName: profile?.full_name || 'Member',
          title: `New Task Assignment: ${taskCode}`,
          message: `You were assigned to task "${title.trim()}".`,
          taskCode,
          type: 'assignment',
        }).catch(() => {});

        // Notify secondary members with collaboration requests
        secondaryMembers.forEach((targetMem) => {
          sendNotification({
            recipientEmail: targetMem.full_name,
            senderName: profile?.full_name || 'Member',
            title: `Task Collaboration Request: ${taskCode}`,
            message: `${profile?.full_name || 'A team member'} requested your collaboration on task "${title.trim()}". Please accept or decline.`,
            taskCode,
            type: 'collab_request',
          }).catch(() => {});
        });
      } catch (err) {
        console.warn('Task insert fallback triggered:', err);
      }
    }

    if (onTaskCreated) {
      onTaskCreated(fullTaskObject);
    }

    // Broadcast custom event so all open views (Tasks, Dashboard, TopNav) update in real-time
    window.dispatchEvent(new CustomEvent('taskflow:task-created', { detail: fullTaskObject }));

    setSuccessMsg(`Task ${taskCode} created successfully!`);
    setIsSubmitting(false);

    setTimeout(() => {
      setSuccessMsg('');
      setTitle('');
      setDescription('');
      setAttachedFiles([]);
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

          {/* Due Date Field & Quick Selection Buttons */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
              <span>Task Due Date *</span>
              <span className="text-[10px] text-slate-400 font-normal">Completion deadline</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[160px]">
                <Input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-xs font-bold text-slate-800 py-1.5"
                  leftIcon={<Calendar className="w-4 h-4 text-brand-600" />}
                />
              </div>

              {/* Quick Pick Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setDueDate(today);
                  }}
                  className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition-colors ${
                    dueDate === new Date().toISOString().split('T')[0]
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    setDueDate(tomorrow.toISOString().split('T')[0]);
                  }}
                  className="px-2.5 py-1.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextWeek = new Date();
                    nextWeek.setDate(nextWeek.getDate() + 7);
                    setDueDate(nextWeek.toISOString().split('T')[0]);
                  }}
                  className="px-2.5 py-1.5 text-[10px] font-bold bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg border border-brand-200 transition-colors"
                >
                  +1 Week
                </button>
              </div>
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

          {/* File Attachment Input (Up to 10 files) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Attach Documents / Specification Files ({attachedFiles.length}/10 Attached)
              </label>
              {attachedFiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAttachedFiles([])}
                  className="text-[11px] font-semibold text-slate-400 hover:text-slate-600"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {attachedFiles.length < 10 && (
                <label className="cursor-pointer flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors">
                  <Upload className="w-4 h-4 text-slate-500" />
                  <span>Add File(s)...</span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        const selected = Array.from(e.target.files);
                        const combined = [...attachedFiles, ...selected];
                        if (combined.length > 10) {
                          alert('Guardrail Warning: You can attach a maximum of 10 files per task.');
                          setAttachedFiles(combined.slice(0, 10));
                        } else {
                          setAttachedFiles(combined);
                        }
                      }
                    }}
                  />
                </label>
              )}

              <span className="text-[11px] text-slate-500 font-medium">
                Supports up to 10 files (PDF, Word, Excel, PPTX, ZIP, CAD, Images, etc.)
              </span>
            </div>

            {/* List of attached files */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1 max-h-28 overflow-y-auto">
                {attachedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-brand-50 text-brand-700 rounded-lg text-xs font-medium border border-brand-200 truncate max-w-xs"
                  >
                    <Paperclip className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="text-brand-400 hover:text-brand-700 ml-1 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
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
