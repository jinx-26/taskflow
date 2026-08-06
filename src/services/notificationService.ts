import { supabase } from '../lib/supabase';

export interface NotificationItem {
  id: string;
  recipientEmail: string;
  senderName: string;
  senderAvatar?: string;
  title: string;
  message: string;
  taskCode?: string;
  type: 'assignment' | 'completion' | 'comment' | 'announcement' | 'collab_request' | 'collab_response' | 'approval_request';
  isRead: boolean;
  time: string;
}

// localStorage is only used as a dev/offline fallback — capped at this many items.
const LOCAL_STORAGE_KEY = 'taskflow_live_notifications';
const MAX_LOCAL_NOTIFS = 30;

const DEFAULT_WELCOME_NOTIF: NotificationItem = {
  id: 'notif-welcome-001',
  recipientEmail: 'all',
  senderName: 'TaskFlow Workspace',
  senderAvatar: '',
  title: 'Workspace Notifications Active',
  message: 'Notifications will update in real-time as tasks are assigned, updated, or completed.',
  taskCode: 'SYS-101',
  type: 'announcement',
  isRead: false,
  time: 'Just now',
};

function mapNotification(n: Record<string, unknown>): NotificationItem {
  return {
    id: n.id as string,
    recipientEmail: n.recipient_email as string,
    senderName: (n.sender_name as string) || 'System',
    senderAvatar: n.sender_avatar as string | undefined,
    title: n.title as string,
    message: n.message as string,
    taskCode: n.task_code as string | undefined,
    type: (n.type as NotificationItem['type']) || 'assignment',
    isRead: (n.is_read as boolean) || false,
    time: n.created_at
      ? new Date(n.created_at as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Recently',
  };
}

/**
 * Fetch notifications for the current user.
 * Filter is applied SERVER-SIDE via the DB query so only the user's own rows
 * are transmitted — never all rows + client-side filter.
 */
export async function fetchLiveNotifications(userEmail: string): Promise<NotificationItem[]> {
  const cleanEmail = (userEmail || '').toLowerCase().trim();

  try {
    // Only fetch explicit-to-me + broadcast notifications.
    // RLS on the notifications table enforces this at the database level too.
    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, message, type, is_read, created_at, sender_name, sender_avatar, task_code, recipient_email')
      .or(`recipient_email.eq.${cleanEmail},recipient_email.eq.all`)
      .order('created_at', { ascending: false })
      .limit(50); // prevent unbounded fetches

    if (!error && data && data.length > 0) {
      return data.map(mapNotification);
    }
  } catch (err) {
    console.warn('Supabase fetch notifications warning:', err);
  }

  // Offline / dev fallback — local storage only, capped
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (stored) {
    try {
      const parsed: NotificationItem[] = JSON.parse(stored);
      const filtered = parsed.filter((n) => {
        const rec = (n.recipientEmail || '').toLowerCase();
        return rec === 'all' || rec === cleanEmail;
      });
      if (filtered.length > 0) return filtered;
    } catch { /* ignore corrupt data */ }
  }

  return [DEFAULT_WELCOME_NOTIF];
}

export async function sendNotification(notif: {
  recipientEmail: string;
  senderName: string;
  senderAvatar?: string;
  title: string;
  message: string;
  taskCode?: string;
  type: NotificationItem['type'];
}): Promise<boolean> {
  try {
    await supabase.from('notifications').insert([
      {
        recipient_email: notif.recipientEmail.toLowerCase(),
        sender_name: notif.senderName,
        sender_avatar: notif.senderAvatar || '',
        title: notif.title,
        message: notif.message,
        task_code: notif.taskCode || '',
        type: notif.type,
        is_read: false,
      },
    ]);
    return true;
  } catch (err) {
    console.warn('Supabase send notification error:', err);

    // Dev/offline fallback — persist locally with a cap so storage doesn't grow unbounded
    const newNotifObj: NotificationItem = {
      id: `notif-${Date.now()}`,
      recipientEmail: notif.recipientEmail.toLowerCase(),
      senderName: notif.senderName,
      senderAvatar: notif.senderAvatar,
      title: notif.title,
      message: notif.message,
      taskCode: notif.taskCode,
      type: notif.type,
      isRead: false,
      time: 'Just now',
    };

    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    let list: NotificationItem[] = [];
    try { list = stored ? JSON.parse(stored) : []; } catch { list = []; }
    list.unshift(newNotifObj);
    // Keep only the most recent N notifications to prevent unbounded growth
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list.slice(0, MAX_LOCAL_NOTIFS)));

    return false;
  }
}

export async function markAllAsRead(userEmail: string): Promise<boolean> {
  const cleanEmail = (userEmail || '').toLowerCase().trim();

  try {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .or(`recipient_email.eq.${cleanEmail},recipient_email.eq.all`);
  } catch (err) {
    console.warn('Supabase mark all read warning:', err);
  }

  // Sync local fallback too
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (stored) {
    try {
      const list: NotificationItem[] = JSON.parse(stored);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list.map((n) => ({ ...n, isRead: true }))));
    } catch { /* ignore */ }
  }

  return true;
}
