import React from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Bell, Check, Inbox } from 'lucide-react';

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
            <span className="text-xs font-semibold text-slate-500">0 Unread</span>
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
        <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
            <Bell className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h3 className="text-base font-bold text-slate-900">No new notifications</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              You are all caught up! Updates will appear here when team members mention you or update assigned tasks.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
