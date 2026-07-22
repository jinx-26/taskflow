import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface NotificationItem {
  id: string;
  recipientEmail: string;
  senderName: string;
  senderAvatar?: string;
  title: string;
  message: string;
  taskCode?: string;
  type: 'assignment' | 'completion' | 'comment' | 'announcement';
  isRead: boolean;
  time: string;
}

const LOCAL_STORAGE_KEY = 'taskflow_live_notifications';

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

export async function fetchLiveNotifications(userEmail: string): Promise<NotificationItem[]> {
  const cleanEmail = (userEmail || '').toLowerCase().trim();
  const emailPrefix = cleanEmail.split('@')[0];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const userNotifs = data.filter((n: any) => {
          const rec = (n.recipient_email || '').toLowerCase();
          return (
            rec === 'all' ||
            rec === cleanEmail ||
            (emailPrefix && rec.includes(emailPrefix.substring(0, 5)))
          );
        });

        if (userNotifs.length > 0) {
          return userNotifs.map((n: any) => ({
            id: n.id,
            recipientEmail: n.recipient_email,
            senderName: n.sender_name || 'System',
            senderAvatar: n.sender_avatar,
            title: n.title,
            message: n.message,
            taskCode: n.task_code,
            type: n.type || 'assignment',
            isRead: n.is_read || false,
            time: n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
          }));
        }
      }
    } catch (err) {
      console.warn('Supabase fetch notifications warning:', err);
    }
  }

  // Fallback local storage
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (stored) {
    try {
      const parsed: NotificationItem[] = JSON.parse(stored);
      const filtered = parsed.filter((n) => {
        const rec = (n.recipientEmail || '').toLowerCase();
        return (
          rec === 'all' ||
          rec === cleanEmail ||
          (emailPrefix && rec.includes(emailPrefix.substring(0, 5)))
        );
      });

      if (filtered.length > 0) return filtered;
    } catch (e) {}
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
  type: 'assignment' | 'completion' | 'comment' | 'announcement';
}): Promise<boolean> {
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

  if (isSupabaseConfigured) {
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
    } catch (err) {
      console.warn('Supabase send notification notice:', err);
    }
  }

  // Local fallback persistence
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  let list: NotificationItem[] = [];
  if (stored) {
    try {
      list = JSON.parse(stored);
    } catch (e) {
      list = [];
    }
  }
  list.unshift(newNotifObj);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));

  return true;
}

export async function markAllAsRead(userEmail: string): Promise<boolean> {
  const cleanEmail = (userEmail || '').toLowerCase().trim();

  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .or(`recipient_email.eq.${cleanEmail},recipient_email.eq.all`);
    } catch (err) {
      console.warn('Supabase mark all read warning:', err);
    }
  }

  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (stored) {
    try {
      const list: NotificationItem[] = JSON.parse(stored);
      const updated = list.map((n) => ({ ...n, isRead: true }));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
  }

  return true;
}
