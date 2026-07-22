import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { fetchLiveNotifications, markAllAsRead, NotificationItem } from '../../services/notificationService';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { CreateTaskModal } from './CreateTaskModal';
import {
  Menu,
  Search,
  Bell,
  LogOut,
  User as UserIcon,
  Settings,
  ShieldCheck,
  ChevronDown,
  Layers,
  Plus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TopNavProps {
  onOpenMobileSidebar: () => void;
  collapsed: boolean;
}

export const TopNav: React.FC<TopNavProps> = ({
  onOpenMobileSidebar,
  collapsed,
}) => {
  const { user, signOut, isDemo } = useAuth();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [notificationsList, setNotificationsList] = useState<NotificationItem[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    if (!user?.email) return;
    const list = await fetchLiveNotifications(user.email);
    setNotificationsList(list);
  };

  useEffect(() => {
    loadNotifications();

    if (isSupabaseConfigured && user?.email) {
      const channel = supabase
        .channel('topnav_notifications_realtime')
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const userDisplayName =
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'Team Member';
  const userEmail = user?.email || 'user@taskflow.io';
  const userAvatar = user?.user_metadata?.avatar_url;

  const userRole = user?.user_metadata?.role || 'Member';

  return (
    <header className="sticky top-0 z-20 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 md:px-6 flex items-center justify-between transition-all duration-300">
      {/* Left section: Mobile menu toggle & Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
          aria-label="Toggle mobile menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile Logo Branding */}
        <div className="md:hidden flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold">
            <Layers className="w-4 h-4" />
          </div>
          <span className="font-bold text-slate-900 tracking-tight text-base">
            TaskFlow
          </span>
        </div>

        {/* Desktop Search Bar (UI Only) */}
        <div className="hidden md:flex items-center relative w-72 lg:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search projects, tasks, or members..."
            className="w-full bg-slate-100/80 hover:bg-slate-100 text-slate-900 text-xs rounded-xl pl-10 pr-12 py-2.5 border border-transparent focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all duration-200"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 absolute right-3 text-[10px] font-semibold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-soft-xs">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right section: Actions & User Menu */}
      <div className="flex items-center gap-2 md:gap-3" ref={menuRef}>
        {/* User Role Badge */}
        <span
          className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
            userRole === 'Manager'
              ? 'bg-purple-50 text-purple-700 border-purple-200'
              : userRole === 'Admin' || userRole === 'Owner'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-brand-50 text-brand-700 border-brand-200'
          }`}
        >
          {userRole === 'Manager' ? '👔 Manager' : userRole === 'Admin' ? '👑 Admin' : '🧑‍💻 Member'}
        </span>

        {/* Quick Assign Task Button */}
        <Button
          variant="primary"
          size="sm"
          className="inline-flex text-xs font-semibold shadow-soft"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setCreateModalOpen(true)}
        >
          New Task
        </Button>

        {isDemo && (
          <span className="hidden lg:inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full border border-amber-200/80">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
            Demo Mode Active
          </span>
        )}

        {/* Notifications Icon */}
        <div className="relative">
          <button
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              setUserMenuOpen(false);
            }}
            className="relative p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {notificationsList.some(n => !n.isRead) && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-brand-600 ring-2 ring-white animate-pulse" />
            )}
          </button>

          {/* Notifications Dropdown Preview */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-soft-lg border border-slate-200/80 py-3 z-50 animate-in fade-in-50 duration-150">
              <div className="px-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Notifications</span>
                {notificationsList.some(n => !n.isRead) && (
                  <button
                    onClick={async () => {
                      if (user?.email) {
                        await markAllAsRead(user.email);
                        setNotificationsList(prev => prev.map(n => ({ ...n, isRead: true })));
                      }
                    }}
                    className="text-[10px] font-semibold text-brand-600 hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {notificationsList.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No notifications yet
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {notificationsList.slice(0, 5).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        setNotificationsOpen(false);
                        navigate('/notifications');
                      }}
                      className={`p-3 transition-colors cursor-pointer hover:bg-slate-50 ${
                        !n.isRead ? 'bg-brand-50/20' : ''
                      }`}
                    >
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {n.senderName} <span className="font-medium text-slate-600">• {n.title}</span>
                      </p>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{n.message}</p>
                      <span className="text-[10px] text-slate-400 block mt-1">{n.time}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 px-3 border-t border-slate-100 text-center">
                <button 
                  onClick={() => { setNotificationsOpen(false); navigate('/notifications'); }}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setUserMenuOpen(!userMenuOpen);
              setNotificationsOpen(false);
            }}
            className="flex items-center gap-2 p-1 pl-2 rounded-xl hover:bg-slate-100 transition-colors focus:outline-none border border-slate-200/60"
          >
            <Avatar src={userAvatar} name={userDisplayName} size="sm" />
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-800 leading-tight">
                {userDisplayName}
              </span>
              <span className="text-[10px] text-slate-500 leading-tight truncate max-w-[120px]">
                {userEmail}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {/* Dropdown Menu */}
          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-soft-lg border border-slate-200/80 py-2 z-50 animate-in fade-in-50 duration-150">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {userDisplayName}
                  </p>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                    {userRole}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">{userEmail}</p>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    navigate('/settings');
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <UserIcon className="w-4 h-4 text-slate-400" />
                  <span>Profile & Account</span>
                </button>
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    navigate('/settings');
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>Preferences</span>
                </button>
              </div>

              <div className="pt-1 border-t border-slate-100">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Direct Logout Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="hidden sm:inline-flex"
          leftIcon={<LogOut className="w-3.5 h-3.5 text-slate-500" />}
        >
          Logout
        </Button>
      </div>

      <CreateTaskModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </header>
  );
};
