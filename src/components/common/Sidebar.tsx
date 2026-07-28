import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Calendar,
  Megaphone,
  Settings,
  ChevronLeft,
  ChevronRight,
  Layers,
  ShieldCheck,
  X,
  Bell,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { fetchLiveNotifications } from '../../services/notificationService';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const navigationItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Projects', path: '/projects', icon: FolderKanban },
  { name: 'My Tasks', path: '/tasks', icon: CheckSquare },
  { name: 'Teams', path: '/teams', icon: Users },
  { name: 'Calendar', path: '/calendar', icon: Calendar },
  { name: 'Announcements', path: '/announcements', icon: Megaphone },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const location = useLocation();
  const { user, profile, userRole } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const isSuperAdmin = user?.email?.toLowerCase() === 'jignesh.giri2005@gmail.com' || profile?.is_superadmin;
  const isAdminOrSuper = isSuperAdmin || userRole === 'Admin';

  const loadUnreadCount = async () => {
    if (!user?.email) return;
    const list = await fetchLiveNotifications(user.email);
    const unread = list.filter((n) => !n.isRead).length;
    setUnreadCount(unread);
  };

  useEffect(() => {
    loadUnreadCount();

    if (isSupabaseConfigured && user?.email) {
      const channel = supabase
        .channel('sidebar_notifications_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications' },
          () => {
            loadUnreadCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200/80 select-none">
      {/* Header / Workspace Selector */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-500 flex items-center justify-center text-white font-bold shadow-soft shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col truncate">
              <span className="text-sm font-bold text-slate-900 tracking-tight truncate flex items-center gap-1.5">
                HFCL TaskFlow
                <span className="text-[10px] font-semibold uppercase bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded border border-brand-200/60">
                  Enterprise
                </span>
              </span>
              <span className="text-xs text-slate-500 truncate">Hardware & Telecom Hub</span>
            </div>
          )}
        </div>

        {/* Mobile close button */}
        <button
          onClick={onCloseMobile}
          className="md:hidden p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <div className={cn('px-2 mb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider', collapsed && 'text-center')}>
          {collapsed ? '•••' : 'Main Menu'}
        </div>

        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => onCloseMobile()}
              className={cn(
                'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-brand-50 text-brand-700 font-semibold shadow-soft-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80',
                collapsed && 'justify-center px-0'
              )}
              title={collapsed ? item.name : undefined}
            >
              <Icon
                className={cn(
                  'w-5 h-5 shrink-0 transition-colors',
                  isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'
                )}
              />

              {!collapsed && (
                <span className="flex-1 truncate">{item.name}</span>
              )}
            </NavLink>
          );
        })}

        {/* SuperAdmin / Admin Control Link */}
        {isAdminOrSuper && (
          <div className="pt-4 mt-4 border-t border-slate-100">
            <div className={cn('px-2 mb-2 text-[11px] font-semibold text-amber-600 uppercase tracking-wider', collapsed && 'text-center')}>
              {collapsed ? 'ADM' : 'Administration'}
            </div>
            <NavLink
              to={isSuperAdmin ? '/super-admin' : '/admin'}
              onClick={() => onCloseMobile()}
              className={cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-amber-700 bg-amber-50/70 hover:bg-amber-100/80 transition-all duration-150',
                collapsed && 'justify-center px-0'
              )}
              title={collapsed ? (isSuperAdmin ? 'SuperAdmin Panel' : 'Admin Panel') : undefined}
            >
              <ShieldCheck className="w-5 h-5 shrink-0 text-amber-600" />
              {!collapsed && (
                <span className="flex-1 truncate font-semibold">
                  {isSuperAdmin ? 'SuperAdmin Panel' : 'Admin Approvals'}
                </span>
              )}
            </NavLink>
          </div>
        )}
      </div>

      {/* Collapse Desktop Toggle */}
      <div className="hidden md:flex p-3 border-t border-slate-100 justify-end">
        <button
          onClick={onToggleCollapse}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:block fixed top-0 left-0 bottom-0 z-30 transition-all duration-300 ease-in-out',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm animate-in fade-in-50"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={cn(
          'md:hidden fixed top-0 left-0 bottom-0 z-50 w-64 transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
};
