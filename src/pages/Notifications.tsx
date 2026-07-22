import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Bell, Check, Inbox, CheckSquare, MessageSquare, CheckCircle2, UserPlus, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { fetchLiveNotifications, markAllAsRead, NotificationItem } from '../services/notificationService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const Notifications: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadNotifications = async () => {
    if (!user?.email) return;
    setIsLoading(true);
    const list = await fetchLiveNotifications(user.email);
    setNotifications(list);
    setIsLoading(false);
  };

  useEffect(() => {
    loadNotifications();

    if (isSupabaseConfigured && user?.email) {
      const channel = supabase
        .channel('notifications_page_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications' },
          () => {
            loadNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const handleMarkAllRead = async () => {
    if (!user?.email) return;
    await markAllAsRead(user.email);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Updates
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold text-brand-600">
              {unreadCount} {unreadCount === 1 ? 'Unread' : 'Unread'}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-1">
            <Bell className="w-6 h-6 text-brand-600" />
            Notifications
          </h1>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs font-semibold"
            leftIcon={<Check className="w-3.5 h-3.5" />}
            onClick={handleMarkAllRead}
          >
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            <p className="text-xs font-semibold text-slate-500">Loading notifications...</p>
          </CardContent>
        </Card>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Bell className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-base font-bold text-slate-900">No notifications yet</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                When a manager assigns a task to you, or a team member completes work or comments, live notifications will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y divide-slate-100">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-4 flex items-start gap-4 transition-colors cursor-pointer hover:bg-slate-50 ${
                  !notif.isRead ? 'bg-brand-50/20' : ''
                }`}
              >
                <div className="relative shrink-0">
                  <Avatar src={notif.senderAvatar} name={notif.senderName} size="md" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white shadow-soft-xs flex items-center justify-center text-[10px]">
                    {notif.type === 'assignment' ? '📋' : notif.type === 'completion' ? '✅' : '💬'}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-900">
                      {notif.senderName}{' '}
                      <span className="font-semibold text-slate-700">• {notif.title}</span>
                    </p>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">{notif.time}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {notif.message}
                  </p>
                  {notif.taskCode && (
                    <span className="inline-block mt-2 text-[10px] font-mono font-bold bg-slate-100 text-brand-700 px-2 py-0.5 rounded border border-slate-200">
                      {notif.taskCode}
                    </span>
                  )}
                </div>

                {!notif.isRead && (
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-600 shrink-0 self-center" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
