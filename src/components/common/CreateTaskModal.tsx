import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { 
  X, CheckSquare, User, Calendar, Tag, AlertCircle, FileText, 
  Clock, Layers, Users, Check, Upload, Paperclip, Plus, Trash2,
  FolderGit2, ShieldAlert, Cpu, Sparkles, ChevronRight, UserCheck, UserPlus, Search
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { sendNotification } from '../../services/notificationService';
import { addLocalTask } from '../../services/taskService';
import { UserProfile, IssueType } from '../../types';

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
  const [projectId, setProjectId] = useState<string>('');
  const [projectName, setProjectName] = useState('General Task Hub');
  const [priority, setPriority] = useState<'Urgent' | 'High' | 'Medium' | 'Low'>('High');

  const getNextWeekString = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  };

  const [dueDate, setDueDate] = useState(getNextWeekString());
  const [partNumber, setPartNumber] = useState('');
  const [hardwareRev, setHardwareRev] = useState('');
  const [estimatedHours, setEstimatedHours] = useState<number>(8);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Interactive Subtasks Checklist
  const [subtasks, setSubtasks] = useState<Array<{ id: string; title: string; completed: boolean }>>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // File Attachments
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  // Workspace Data & Jira-Style Assignment State
  const [workspaceMembers, setWorkspaceMembers] = useState<UserProfile[]>([]);
  const [projectsList, setProjectsList] = useState<Array<{ id: string; name: string; key: string }>>([]);
  
  // Jira Assignee & Collaborators Model
  const [primaryAssigneeId, setPrimaryAssigneeId] = useState<string>('');
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
  const [isAddingCollaborator, setIsAddingCollaborator] = useState(false);
  const [collabSearchQuery, setCollabSearchQuery] = useState('');

  const loadData = async () => {
    let fetchedMembers: UserProfile[] = [];
    try {
      if (isSupabaseConfigured) {
        // Fetch profiles
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .order('full_name', { ascending: true });

        if (profilesData && profilesData.length > 0) {
          fetchedMembers = profilesData.map((d: any) => ({
            id: d.id,
            full_name: d.full_name,
            role: d.role,
            status: d.status,
            avatar_url: d.avatar_url,
          }));
        }

        // Fetch projects
        const { data: projectsData } = await supabase
          .from('projects')
          .select('id, name, key')
          .order('name', { ascending: true });

        if (projectsData && projectsData.length > 0) {
          setProjectsList(projectsData);
          if (!projectId) {
            setProjectId(projectsData[0].id);
            setProjectName(projectsData[0].name);
          }
        }
      }
    } catch (err) {
      console.warn('Could not load data for full-page task modal:', err);
    }

    if (fetchedMembers.length === 0 && user) {
      const selfName = profile?.full_name || user.email?.split('@')[0] || 'Employee';
      fetchedMembers = [{
        id: user.id,
        full_name: selfName,
        role: profile?.role || 'Member',
        status: 'Approved',
      }];
    }

    if (fetchedMembers.length > 0) {
      setWorkspaceMembers(fetchedMembers);
      if (user) {
        const selfMember = fetchedMembers.find((m) => m.id === user.id);
        setPrimaryAssigneeId((prev) => prev || (selfMember ? selfMember.id : fetchedMembers[0].id));
      } else {
        setPrimaryAssigneeId((prev) => prev || fetchedMembers[0].id);
      }
    }
  };

  // Pre-fetch workspace data as soon as user is authenticated
  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setAttachedFiles([]);
      setSubtasks([]);
      setCollaboratorIds([]);
      setIsAddingCollaborator(false);
      setDueDate(getNextWeekString());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAssignToMe = () => {
    if (user) {
      setPrimaryAssigneeId(user.id);
    }
  };

  const toggleCollaborator = (memberId: string) => {
    if (memberId === primaryAssigneeId) return; // Primary assignee is handled separately
    setCollaboratorIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const removeCollaborator = (memberId: string) => {
    setCollaboratorIds((prev) => prev.filter((id) => id !== memberId));
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    setSubtasks((prev) => [
      ...prev,
      { id: `sub-${Date.now()}`, title: newSubtaskTitle.trim(), completed: false }
    ]);
    setNewSubtaskTitle('');
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  };

  const handleRemoveFile = (indexToRemove: number) => {
    setAttachedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const filteredCollabMembers = workspaceMembers.filter(
    (m) =>
      m.id !== primaryAssigneeId &&
      (m.full_name.toLowerCase().includes(collabSearchQuery.toLowerCase()) ||
        m.role.toLowerCase().includes(collabSearchQuery.toLowerCase()))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;

    if (!primaryAssigneeId) {
      alert('Please select a primary assignee for this task.');
      return;
    }

    setIsSubmitting(true);

    // taskCode will be assigned by the DB SEQUENCE trigger.
    // We use a temporary placeholder until the DB returns the real code.
    let taskCode = 'TSK-???';

    const primaryAssigneeObj = workspaceMembers.find((m) => m.id === primaryAssigneeId) || {
      id: user.id,
      full_name: profile?.full_name || 'Assigned Member',
      avatar_url: profile?.avatar_url,
    };

    const secondaryMembers = workspaceMembers.filter(
      (m) => collaboratorIds.includes(m.id) && m.id !== primaryAssigneeObj.id
    );

    const coAssigneesList = secondaryMembers.map((m) => ({
      id: m.id,
      name: m.full_name,
      avatar: m.avatar_url,
      role: m.role,
    }));

    // Process all attached files
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

    const resolvedProject = isStandalone ? 'Standalone Task' : (projectName || 'General Task Hub');

    const attachmentLinksMarkdown = uploadedFilesList
      .map((f) => `📎 Attachment: [${f.name}](${f.url})`)
      .join('\n');

    const dbDescription = attachmentLinksMarkdown
      ? `${description.trim()}\n\n${attachmentLinksMarkdown}`
      : description.trim();

    // Do NOT send `code` — the DB BEFORE INSERT trigger (task_code_seq)
    // assigns a guaranteed-unique sequential code automatically.
    const dbInsertPayload: any = {
      title: title.trim(),
      description: dbDescription,
      issue_type: issueType,
      project: resolvedProject,
      project_id: (!isStandalone && isUuid(projectId)) ? projectId : null,
      priority,
      status: 'Todo',
      assignee_id: isUuid(primaryAssigneeObj.id) ? primaryAssigneeObj.id : null,
      assignee_name: primaryAssigneeObj.full_name,
      assignee_avatar: primaryAssigneeObj.avatar_url || '',
      co_assignees: coAssigneesList,
      pending_invitations: [],
      part_number: partNumber.trim() || null,
      hardware_rev: hardwareRev.trim() || null,
      estimated_hours: estimatedHours || 8,
      created_by: isUuid(user.id) ? user.id : null,
      due_date: dueDate,
      subtasks: subtasks,
      attachment_url: uploadedFilesList[0]?.url || null,
      attachment_name: uploadedFilesList[0]?.name || null,
    };

    let insertSuccess = false;
    let insertedId = `task-${Date.now()}`;

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .insert([dbInsertPayload])
          .select('id, code')
          .single();

        if (!error && data) {
          insertedId = data.id;
          // Real code assigned by DB SEQUENCE trigger — guaranteed unique & sequential
          taskCode = data.code;
          insertSuccess = true;
        } else if (error) {
          console.error('Supabase task insert error:', error.message);
          alert(`Could not save task to database: ${error.message}`);
          setIsSubmitting(false);
          return;
        }
      } catch (err: any) {
        console.error('Task insert exception:', err);
        setIsSubmitting(false);
        return;
      }
    } else {
      // Offline fallback: generate a local code when Supabase is not configured
      taskCode = `TSK-${Date.now().toString().slice(-5)}`;
      insertSuccess = true;
    }

    // Build the activity log entry now that we have the real DB-assigned code
    const activityLogEntry = {
      id: `log-${Date.now()}`,
      userName: profile?.full_name || 'Member',
      userAvatar: profile?.avatar_url,
      action: `created task ${taskCode}${uploadedFilesList.length > 0 ? ` with ${uploadedFilesList.length} file attachment(s)` : ''}.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Patch the activity_log on the newly created row with the real code
    if (isSupabaseConfigured && insertSuccess) {
      supabase
        .from('tasks')
        .update({ activity_log: [activityLogEntry] })
        .eq('id', insertedId)
        .then(() => {});
    }

    const fullTaskObject: any = {
      id: insertedId,
      code: taskCode,
      title: title.trim(),
      description: description.trim(),
      issueType,
      project: resolvedProject,
      projectId: isStandalone ? null : (projectId || null),
      priority,
      status: 'Todo',
      assignee: {
        id: primaryAssigneeObj.id,
        name: primaryAssigneeObj.full_name,
        avatar: primaryAssigneeObj.avatar_url,
      },
      coAssignees: coAssigneesList,
      pendingInvitations: [],
      attachmentUrl: uploadedFilesList[0]?.url || null,
      attachmentName: uploadedFilesList[0]?.name || null,
      attachments: uploadedFilesList,
      partNumber: partNumber.trim() || null,
      hardwareRev: hardwareRev.trim() || null,
      estimatedHours: estimatedHours || 8,
      createdBy: user.id,
      createdByName: profile?.full_name || 'Member',
      dueDate,
      createdAt: new Date().toISOString(),
      activityLog: [activityLogEntry],
      comments: [],
      subtasks: subtasks,
      isDeleted: false,
    };

    addLocalTask(fullTaskObject);

    if (insertSuccess) {
      sendNotification({
        recipientEmail: primaryAssigneeObj.full_name,
        senderName: profile?.full_name || 'Member',
        title: `New Task Assignment: ${taskCode}`,
        message: `You were assigned as primary owner of task "${title.trim()}".`,
        taskCode,
        type: 'assignment',
      }).catch(() => {});
    }

    if (onTaskCreated) {
      onTaskCreated(fullTaskObject);
    }

    window.dispatchEvent(new CustomEvent('taskflow:task-created', { detail: fullTaskObject }));

    setSuccessMsg(`Task ${taskCode} created successfully!`);
    setIsSubmitting(false);

    setTimeout(() => {
      setSuccessMsg('');
      setTitle('');
      setDescription('');
      setAttachedFiles([]);
      setSubtasks([]);
      onClose();
    }, 1000);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-white w-screen h-screen flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
      {/* Full-Page Top Header Bar */}
      <div className="h-16 px-6 md:px-8 border-b border-slate-200 flex items-center justify-between bg-slate-50/90 backdrop-blur-md shrink-0 shadow-soft-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center font-extrabold shadow-soft">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span>TaskFlow Workspaces</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-800 font-bold">{isStandalone ? 'Standalone Tasks' : projectName}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-brand-600 font-bold bg-brand-50 px-2 py-0.5 rounded border border-brand-200">New Task Specification</span>
            </div>
            <h2 className="text-sm font-extrabold text-slate-900">Create &amp; Assign Work Order / Task</h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {successMsg && (
            <div className="px-3 py-1 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 flex items-center gap-1.5 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-xl font-semibold">
            Cancel
          </Button>
          <Button 
            type="button" 
            variant="primary" 
            size="sm" 
            isLoading={isSubmitting}
            onClick={handleSubmit}
            className="rounded-xl font-bold shadow-soft px-5"
          >
            Create &amp; Assign Task
          </Button>
          <div className="h-5 w-px bg-slate-200 mx-1" />
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-200/60 transition-colors"
            title="Close Full Page"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2-Column Full Page Body */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* LEFT COLUMN: Main Issue Content (65% width) */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6 border-r border-slate-200">
          
          {/* Task Title Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              Task Title / Summary *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. PCB Schematics & RF Layout Review for 5G Outdoor Unit"
              className="w-full text-xl md:text-2xl font-extrabold text-slate-900 placeholder:text-slate-300 border-b-2 border-slate-200 pb-2 focus:outline-none focus:border-brand-600 transition-colors bg-transparent"
              autoFocus
            />
          </div>

          {/* Description Editor Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-400" />
                Description &amp; Work Breakdown Structure
              </label>
              <span className="text-[11px] text-slate-400 font-medium">Supports rich markdown &amp; specs</span>
            </div>
            <textarea
              rows={7}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe detailed technical requirements, Acceptance Criteria, hardware specs, block diagrams, or instructions for the assignee..."
              className="w-full rounded-2xl border border-slate-200 p-4 text-sm text-slate-800 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none bg-slate-50/50 transition-all font-sans leading-relaxed"
            />
          </div>

          {/* Interactive Subtasks Checklist Builder */}
          <div className="space-y-3 pt-2">
            <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-brand-600" />
                Subtasks &amp; Deliverables Checklist ({subtasks.length})
              </span>
            </label>

            <div className="flex gap-2">
              <Input
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); } }}
                placeholder="Add a subtask item (e.g. Verify impedance matching tolerance)..."
                className="text-xs py-2"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddSubtask} className="shrink-0 rounded-xl">
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>

            {subtasks.length > 0 && (
              <div className="space-y-1.5 bg-slate-50 border border-slate-200 rounded-2xl p-3">
                {subtasks.map((st) => (
                  <div key={st.id} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-soft-xs">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-brand-600" />
                      <span className="text-xs font-semibold text-slate-800">{st.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubtask(st.id)}
                      className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* File Attachments Dropzone */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-brand-600" />
                Technical Specifications &amp; Attachments ({attachedFiles.length}/10)
              </label>
              {attachedFiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAttachedFiles([])}
                  className="text-xs font-bold text-red-600 hover:underline"
                >
                  Remove All
                </button>
              )}
            </div>

            <div className="border-2 border-dashed border-slate-200 hover:border-brand-400 rounded-2xl p-6 bg-slate-50/50 transition-colors text-center">
              <Upload className="w-8 h-8 text-brand-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">Drag and drop specification files here, or browse</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Supports PDF, Word, Excel, CAD Gerber, ZIP, Images (up to 10 files)</p>
              <label className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 shadow-soft-xs cursor-pointer transition-colors">
                <Paperclip className="w-3.5 h-3.5 text-brand-600" />
                Select File(s)
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      const selected = Array.from(e.target.files);
                      const combined = [...attachedFiles, ...selected];
                      setAttachedFiles(combined.slice(0, 10));
                    }
                  }}
                />
              </label>
            </div>

            {attachedFiles.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {attachedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 bg-brand-50/60 border border-brand-200 rounded-xl text-xs font-semibold text-brand-900"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Paperclip className="w-4 h-4 text-brand-600 shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="text-brand-400 hover:text-brand-700 font-bold p-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Jira-Style Attributes & Assignment Sidebar (35% width) */}
        <div className="w-full md:w-[380px] bg-slate-50/70 p-6 overflow-y-auto space-y-6 shrink-0 border-t md:border-t-0 md:border-l border-slate-200">
          
          {/* Task Scope & Project Linkage */}
          <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <FolderGit2 className="w-4 h-4 text-brand-600" />
                Project Scope
              </span>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setIsStandalone(true)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isStandalone ? 'bg-white text-brand-700 shadow-soft-xs' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Standalone
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
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-500 uppercase">Select Project *</label>
                {projectsList.length > 0 ? (
                  <select
                    value={projectId}
                    onChange={(e) => {
                      setProjectId(e.target.value);
                      const found = projectsList.find((p) => p.id === e.target.value);
                      if (found) setProjectName(found.name);
                    }}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-brand-500"
                  >
                    {projectsList.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.key})</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. 5G PCB Development"
                  />
                )}
              </div>
            )}
          </div>

          {/* JIRA-STYLE PRIMARY ASSIGNEE & COLLABORATORS */}
          <div className="space-y-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft-xs">
            
            {/* Primary Assignee Selector + "Assign to me" Button */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-4 h-4 text-brand-600" />
                  Primary Assignee *
                </label>
                {user && (
                  <button
                    type="button"
                    onClick={handleAssignToMe}
                    className="text-[11px] font-bold text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-2 py-0.5 rounded-lg border border-brand-200/80 flex items-center gap-1 transition-colors"
                  >
                    <UserCheck className="w-3 h-3" /> Assign to me
                  </button>
                )}
              </div>

              <select
                value={primaryAssigneeId}
                onChange={(e) => setPrimaryAssigneeId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-brand-500"
              >
                {workspaceMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Collaborators / Watchers Chips & Add Popover */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-slate-500" />
                  Collaborators ({collaboratorIds.length})
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingCollaborator(!isAddingCollaborator)}
                  className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1 bg-slate-100 hover:bg-slate-200/70 px-2 py-0.5 rounded-lg transition-colors"
                >
                  <UserPlus className="w-3 h-3" />
                  {isAddingCollaborator ? 'Done' : '+ Add'}
                </button>
              </div>

              {/* Selected Collaborators Avatar Chips */}
              <div className="flex flex-wrap gap-1.5 min-h-[32px] items-center">
                {collaboratorIds.length === 0 ? (
                  <span className="text-[11px] text-slate-400 italic">No secondary collaborators added.</span>
                ) : (
                  collaboratorIds.map((id) => {
                    const member = workspaceMembers.find((m) => m.id === id);
                    if (!member) return null;
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200/80 rounded-full text-xs font-semibold text-slate-800 border border-slate-200 shadow-soft-xs transition-colors"
                      >
                        <div className="w-4 h-4 rounded-full bg-brand-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                          {member.full_name.charAt(0)}
                        </div>
                        <span>{member.full_name}</span>
                        <button
                          type="button"
                          onClick={() => removeCollaborator(id)}
                          className="text-slate-400 hover:text-red-600 font-bold ml-0.5 text-sm"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Collaborators Search Popover */}
              {isAddingCollaborator && (
                <div className="space-y-2 pt-2 border-t border-slate-200 animate-in fade-in-50 duration-150">
                  <Input
                    value={collabSearchQuery}
                    onChange={(e) => setCollabSearchQuery(e.target.value)}
                    placeholder="Search member to add..."
                    leftIcon={<Search className="w-3.5 h-3.5 text-slate-400" />}
                    className="py-1 text-xs"
                    autoFocus
                  />
                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-1.5 divide-y divide-slate-100 bg-white">
                    {filteredCollabMembers.length === 0 ? (
                      <p className="text-[11px] text-slate-400 p-2 text-center">No available members to add.</p>
                    ) : (
                      filteredCollabMembers.map((m) => {
                        const isAdded = collaboratorIds.includes(m.id);
                        return (
                          <div
                            key={m.id}
                            onClick={() => toggleCollaborator(m.id)}
                            className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                              isAdded ? 'bg-brand-50 text-brand-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-slate-200 font-bold text-[10px] text-slate-700 flex items-center justify-center shrink-0">
                                {m.full_name.charAt(0)}
                              </div>
                              <span>{m.full_name}</span>
                            </div>
                            {isAdded ? (
                              <Check className="w-3.5 h-3.5 text-brand-600" />
                            ) : (
                              <Plus className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Issue Attributes & Metadata */}
          <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft-xs">
            <span className="text-xs font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-brand-600" />
              Issue Attributes
            </span>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-500 uppercase">Category / Issue Type</label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value as IssueType)}
                className="w-full rounded-xl border border-slate-300 p-2 text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-brand-500"
              >
                <option value="General Task">General Task</option>
                <option value="PCB Layout">PCB Layout</option>
                <option value="Hardware Design">Hardware Design</option>
                <option value="Mechanical CAD">Mechanical CAD</option>
                <option value="Firmware Flash">Firmware Flash</option>
                <option value="QA & Compliance">QA &amp; Compliance</option>
                <option value="Component Procurement">Component Procurement</option>
                <option value="Field Issue">Field Issue</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-500 uppercase">Priority Level</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full rounded-xl border border-slate-300 p-2 text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-brand-500"
              >
                <option value="Urgent">🔴 Urgent</option>
                <option value="High">🟠 High</option>
                <option value="Medium">🟡 Medium</option>
                <option value="Low">🔵 Low</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-500 uppercase">Due Date *</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-brand-300 bg-brand-50/50 p-2 text-xs font-bold text-brand-900 focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Quick Due Presets */}
            <div className="flex items-center gap-1 flex-wrap pt-1">
              <button
                type="button"
                onClick={() => setDueDate(new Date().toISOString().split('T')[0])}
                className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  setDueDate(d.toISOString().split('T')[0]);
                }}
                className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 7);
                  setDueDate(d.toISOString().split('T')[0]);
                }}
                className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                +1 Wk
              </button>
            </div>
          </div>

          {/* Hardware Specifications */}
          <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-soft-xs">
            <span className="text-xs font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-brand-600" />
              Hardware Specifications
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Part Number</label>
                <input
                  type="text"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  placeholder="e.g. PN-9941"
                  className="w-full text-xs p-2 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">HW Rev</label>
                <input
                  type="text"
                  value={hardwareRev}
                  onChange={(e) => setHardwareRev(e.target.value)}
                  placeholder="e.g. Rev C2"
                  className="w-full text-xs p-2 rounded-xl border border-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Est. Work Hours</label>
              <input
                type="number"
                min={1}
                max={200}
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(Number(e.target.value))}
                className="w-full text-xs p-2 rounded-xl border border-slate-200 font-bold"
              />
            </div>
          </div>

        </div>

      </div>

    </div>,
    document.body
  );
};
