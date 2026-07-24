import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { TaskPlaceholder, UserProfile, CollaborationRequest } from '../types';
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

export async function fetchLiveTasks(): Promise<TaskPlaceholder[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .neq('is_deleted', true)
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.warn('Error fetching tasks from Supabase:', error?.message);
      return [];
    }

    return data.map((t: any) => ({
      id: t.id,
      code: t.code || 'TSK-101',
      title: t.title,
      description: t.description || '',
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
      createdBy: t.created_by_name || 'Workspace Member',
      dueDate: formatDisplayDate(t.due_date),
      comments: t.comments || [],
      isDeleted: t.is_deleted || false,
      estimatedHours: t.estimated_hours || 0,
      loggedHours: t.logged_hours || 0,
    }));
  } catch (err) {
    console.error('fetchLiveTasks error:', err);
    return [];
  }
}

// Audited Soft Deletion
export async function softDeleteTask(taskId: string, userId?: string, userName?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return true;

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
  if (!isSupabaseConfigured) return true;

  try {
    const newInvite: CollaborationRequest = {
      id: `inv-${Date.now()}`,
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

    // Update task pending invitations
    await supabase
      .from('tasks')
      .update({ pending_invitations: updatedInvites })
      .eq('id', task.id);

    // Send real-time notification to target user
    await sendNotification({
      recipientEmail: target.full_name, // Matches target profile full name / channel
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
  if (!isSupabaseConfigured) return true;

  try {
    // 1. Fetch target task
    const { data: taskData, error: taskErr } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (taskErr || !taskData) return false;

    const pendingInvites: CollaborationRequest[] = taskData.pending_invitations || [];
    const coAssignees = taskData.co_assignees || [];

    const targetInvite = pendingInvites.find((i) => i.id === inviteId || i.targetUserId === userProfile.id);

    // Remove invite from pending
    const remainingInvites = pendingInvites.filter((i) => i.id !== inviteId && i.targetUserId !== userProfile.id);

    let updatedCoAssignees = coAssignees;

    if (accept) {
      // Add user to co-assignees if not already present
      if (!coAssignees.some((c: any) => c.id === userProfile.id || c.name === userProfile.full_name)) {
        updatedCoAssignees = [
          ...coAssignees,
          {
            id: userProfile.id,
            name: userProfile.full_name,
            avatar: userProfile.avatar_url,
            role: userProfile.role,
          },
        ];
      }
    }

    // Add activity log entry
    const existingLogs = taskData.activity_log || [];
    const newLog = {
      id: `log-${Date.now()}`,
      userName: userProfile.full_name,
      userAvatar: userProfile.avatar_url,
      action: accept
        ? `accepted collaboration invite and joined task as co-assignee.`
        : `declined collaboration invite.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Update DB
    await supabase
      .from('tasks')
      .update({
        pending_invitations: remainingInvites,
        co_assignees: updatedCoAssignees,
        activity_log: [newLog, ...existingLogs],
      })
      .eq('id', taskId);

    // Send confirmation notification to original inviter if invite existed
    if (targetInvite) {
      await sendNotification({
        recipientEmail: targetInvite.invitedByName,
        senderName: userProfile.full_name,
        senderAvatar: userProfile.avatar_url,
        title: accept ? `Collaboration Invite Accepted` : `Collaboration Invite Declined`,
        message: `${userProfile.full_name} has ${accept ? 'accepted' : 'declined'} your request to collaborate on ${taskData.code}.`,
        taskCode: taskData.code,
        type: 'collab_response',
      });
    }

    return true;
  } catch (err) {
    console.error('Failed to respond to invite:', err);
    return false;
  }
}
