import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Calendar,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const navigationItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Projects', path: '/projects', icon: FolderKanban, badge: '12' },
  { name: 'Tasks', path: '/tasks', icon: CheckSquare, badge: '18' },
  { name: 'Teams', path: '/teams', icon: Users },
  { name: 'Calendar', path: '/calendar', icon: Calendar },
  { name: 'Notifications', path: '/notifications', icon: Bell, badge: '3' },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const location = useLocation();

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
                TaskFlow
                <span className="text-[10px] font-semibold uppercase bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded border border-brand-200/60">
                  Pro
                </span>
              </span>
              <span className="text-xs text-slate-500 truncate">Enterprise Workspace</span>
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

              {!collapsed && item.badge && (
                <span
                  className={cn(
                    'px-2 py-0.5 text-xs font-semibold rounded-full',
                    isActive
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                  )}
                >
                  {item.badge}
                </span>
              )}

              {/* Active Indicator bar */}
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-1 bg-brand-600 rounded-r-full" />
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Upgrade Banner or Quick Action */}
      {!collapsed && (
        <div className="p-3 m-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-4 h-4 text-brand-600" />
            <span className="text-xs font-bold text-slate-900">TaskFlow Sync v2.4</span>
          </div>
          <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
            All systems operational. Auth & Routes active.
          </p>
        </div>
      )}

      {/* Collapse Toggle Footer (Desktop only) */}
      <div className="hidden md:flex items-center justify-between p-3 border-t border-slate-100">
        <button
          onClick={onToggleCollapse}
          className={cn(
            'flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors',
            collapsed && 'justify-center px-0'
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-slate-600" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 text-slate-600" />
              <span>Collapse Sidebar</span>
            </>
          )}
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
          collapsed ? 'w-20' : 'w-64'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={cn(
          'md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-white transition-transform duration-300 ease-in-out shadow-soft-lg',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
};
