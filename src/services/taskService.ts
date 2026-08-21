import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { TaskPlaceholder, TaskComment, UserProfile, CollaborationRequest } from '../types';
import { sendNotification } from './notificationService';

export function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return 'Jul 30, 2026';
  
  if (dateStr.includes(',') && !dateStr.includes('T')) {
    return dateStr;
  }

  try {
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) {
      return dateStr;
    }
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch (e) {
    return dateStr;
  }
}

// Local in-memory session cache for tasks created during session
let localTasksCache: TaskPlaceholder[] = [];

export function clearLocalTasksCache() {
  localTasksCache = [];
}

export function addLocalTask(task: TaskPlaceholder) {
  if (!localTasksCache.some((t) => t.id === task.id || t.code === task.code)) {
    localTasksCache.unshift(task);
  }
}

export async function clearAllTasks(): Promise<{ success: boolean; error?: string }> {
  try {
    clearLocalTasksCache();
    if (isSupabaseConfigured) {
      const { data: rpcData, error: rpcError } = await supabase.rpc('clear_all_tasks');
      if (rpcError) {
        const { error: delError } = await supabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (delError) throw delError;
      }
    }
    return { success: true };
  } catch (err: any) {
    console.error('Failed to clear all tasks:', err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
}

export async function fetchLiveTasks(): Promise<TaskPlaceholder[]> {
  let dbTasks: TaskPlaceholder[] = [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, code, title, description, issue_type, project, project_id, priority, status, assignee_id, assignee_name, assignee_avatar, co_assignees, pending_invitations, subtasks, activity_log, comments, due_date, created_by, created_at, is_deleted, estimated_hours, logged_hours, attachment_url, attachment_name')
        .neq('is_deleted', true)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const isUuid = (val?: string | null) =>
          typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

        dbTasks = data.map((t: any) => {
          let attachmentUrl = t.attachment_url || null;
          let attachmentName = t.attachment_name || null;
          let cleanDescription = t.description || '';

          // Fallback: extract attachment URL and name from description if embedded
          if (cleanDescription.includes('📎 Attachment:')) {
            const match = cleanDescription.match(/📎 Attachment: \[(.*?)\]\((.*?)\)/);
            if (match) {
              if (!attachmentName) attachmentName = match[1];
              if (!attachmentUrl) attachmentUrl = match[2];
            }
            // Strip out raw attachment link string from description
            cleanDescription = cleanDescription
              .replace(/📎 Attachment: \[(.*?)\]\((.*?)\)/g, '')
              .trim();
          }

          // Resolve human readable creator name
          let creatorName = t.created_by_name;
          if (!creatorName && Array.isArray(t.activity_log)) {
            const createLog = t.activity_log.find((l: any) => l.action && l.action.toLowerCase().includes('created task'));
            if (createLog && createLog.userName) {
              creatorName = createLog.userName;
            }
          }
          if (!creatorName && t.created_by && !isUuid(t.created_by)) {
            creatorName = t.created_by;
          }
          if (!creatorName) {
            creatorName = 'Workspace Manager';
          }

          return {
            id: t.id,
            code: t.code || '—',
            title: t.title,
            description: cleanDescription,
            issueType: t.issue_type || 'Task',
            project: t.project || 'General',
            priority: t.priority || 'Medium',
            status: t.status || 'In Progress',
            assignee: {
              id: t.assignee_id,
              name: t.assignee_name || 'Unassigned',
              avatar: t.assignee_avatar || undefined,
            },
            coAssignees: t.co_assignees || [],
            pendingInvitations: t.pending_invitations || [],
            subtasks: t.subtasks || [],
            activityLog: t.activity_log || [],
            createdBy: creatorName,
            createdAt: t.created_at,
            dueDate: formatDisplayDate(t.due_date),
            comments: t.comments || [],
            attachmentUrl,
            attachmentName,
            isDeleted: t.is_deleted || false,
            estimatedHours: t.estimated_hours || 0,
            loggedHours: t.logged_hours || 0,
          };
        });
      }
    } catch (err) {
      console.error('fetchLiveTasks error:', err);
    }
  } // end if (isSupabaseConfigured)

  // Merge DB tasks with local session cache, avoiding duplicates by code/id
  const combined = [...dbTasks];
  localTasksCache.forEach((localTask) => {
    if (!combined.some((t) => t.id === localTask.id || (t.code && t.code === localTask.code))) {
      combined.unshift(localTask);
    }
  });

  return combined;
}


// Audited Soft Deletion
export async function softDeleteTask(taskId: string, userId?: string, _userName?: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('tasks')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: userId || null,
      })
      .eq('id', taskId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Failed to soft delete task:', err);
    return false;
  }
}

// Invite Co-Assignee to Task
export async function inviteCoAssignee(
  task: TaskPlaceholder,
  inviter: UserProfile,
  target: UserProfile
): Promise<boolean> {
  try {
    const newInvite: CollaborationRequest = {
      id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      taskId: task.id,
      taskCode: task.code,
      taskTitle: task.title,
      invitedByName: inviter.full_name,
      invitedById: inviter.id,
      targetUserId: target.id,
      targetUserEmail: target.full_name,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };

    const existingInvites = task.pendingInvitations || [];
    const updatedInvites = [...existingInvites, newInvite];

    // Log timeline activity
    const existingLogs = task.activityLog || [];
    const newLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userName: inviter.full_name,
      userAvatar: inviter.avatar_url,
      action: `sent a collaboration invitation to ${target.full_name}.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    const updatedLogs = [newLog, ...existingLogs];

    // Update task pending invitations & activity log
    await supabase
      .from('tasks')
      .update({
        pending_invitations: updatedInvites,
        activity_log: updatedLogs,
      })
      .eq('id', task.id);

    // Send real-time notification to target user
    // Use targetUserId as the routing key if a real email is unavailable
    await sendNotification({
      recipientEmail: target.email ?? target.id, // real email, not display name
      senderName: inviter.full_name,
      senderAvatar: inviter.avatar_url,
      title: `Task Collaboration Request: ${task.code}`,
      message: `${inviter.full_name} invited you to collaborate on "${task.title}".`,
      taskCode: task.code,
      type: 'collab_request',
    });

    return true;
  } catch (err) {
    console.error('Failed to send collaboration invite:', err);
    return false;
  }
}

// Respond to Collaboration Invite (Accept / Decline)
export async function respondToInvite(
  taskId: string,
  inviteId: string,
  userProfile: UserProfile,
  accept: boolean
): Promise<boolean> {
  try {
    // Call the SECURITY DEFINER RPC — this bypasses the UPDATE RLS policy
    // which previously blocked co-assignees (non-creator, non-primary-assignee)
    // from updating the task's co_assignees column.
    const { data, error } = await supabase.rpc('respond_to_task_invite', {
      p_task_id:   taskId,
      p_invite_id: inviteId,
      p_accept:    accept,
    });

    if (error) {
      console.error('respond_to_task_invite RPC error:', error.message);
      return false;
    }

    if (!data?.success) {
      console.error('respond_to_task_invite failed:', data?.error);
      return false;
    }

    // Send confirmation notification to original inviter
    if (data.invitedByName) {
      await sendNotification({
        recipientEmail: data.invitedByName,
        senderName: userProfile.full_name,
        senderAvatar: userProfile.avatar_url,
        title: accept ? `Collaboration Invite Accepted` : `Collaboration Invite Declined`,
        message: `${userProfile.full_name} has ${accept ? 'accepted' : 'declined'} your request to collaborate on ${data.taskCode}.`,
        taskCode: data.taskCode,
        type: 'collab_response',
      });
    }

    return true;
  } catch (err) {
    console.error('Failed to respond to invite:', err);
    return false;
  }
}

