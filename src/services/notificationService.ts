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

export async function fetchLiveNotifications(userEmail: string): Promise<NotificationItem[]> {
  if (!userEmail) return [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`recipient_email.eq.${userEmail.toLowerCase()},recipient_email.eq.all`)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map((n: any) => ({
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
    } catch (err) {
      console.warn('Supabase fetch notifications error:', err);
    }
  }

  // Fallback storage
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (stored) {
    try {
      const parsed: NotificationItem[] = JSON.parse(stored);
      return parsed.filter(
        (n) => n.recipientEmail.toLowerCase() === userEmail.toLowerCase() || n.recipientEmail === 'all'
      );
    } catch (e) {
      return [];
    }
  }

  return [];
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
      console.warn('Supabase send notification error:', err);
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
  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_email', userEmail.toLowerCase());
    } catch (err) {
      console.warn('Supabase mark all read error:', err);
    }
  }

  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (stored) {
    try {
      const list: NotificationItem[] = JSON.parse(stored);
      const updated = list.map((n) =>
        n.recipientEmail.toLowerCase() === userEmail.toLowerCase() ? { ...n, isRead: true } : n
      );
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
  }

  return true;
}
