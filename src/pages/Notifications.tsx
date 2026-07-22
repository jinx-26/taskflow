import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Bell, Check, Filter, MessageSquare, CheckCircle2, UserPlus } from 'lucide-react';

const mockNotifications = [
  {
    id: 'n-1',
    user: { name: 'Sarah Jenkins', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
    title: 'Commented on Supabase Auth Guard task',
    time: '10 minutes ago',
    unread: true,
    type: 'comment',
  },
  {
    id: 'n-2',
    user: { name: 'David Kim', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
    title: 'Completed Linear/Vercel layout component',
    time: '1 hour ago',
    unread: true,
    type: 'complete',
  },
  {
    id: 'n-3',
    user: { name: 'Alex Morgan', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' },
    title: 'Assigned you to Sprint #14 High Priority tasks',
    time: '3 hours ago',
    unread: false,
    type: 'assign',
  },
];

export const Notifications: React.FC = () => {
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
            <span className="text-xs font-semibold text-brand-600">2 Unread</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-1">
            <Bell className="w-6 h-6 text-brand-600" />
            Notifications
          </h1>
        </div>

        <Button variant="outline" size="sm" className="text-xs" leftIcon={<Check className="w-3.5 h-3.5" />}>
          Mark All as Read
        </Button>
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0 divide-y divide-slate-100">
          {mockNotifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-4 flex items-start gap-4 transition-colors cursor-pointer hover:bg-slate-50 ${
                notif.unread ? 'bg-brand-50/20' : ''
              }`}
            >
              <Avatar src={notif.user.avatar} name={notif.user.name} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-900">
                    {notif.user.name}{' '}
                    <span className="font-normal text-slate-600">{notif.title}</span>
                  </p>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">{notif.time}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                  "Please review the PR for session persistence before deploying to production."
                </p>
              </div>
              {notif.unread && (
                <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0 self-center" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
