import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { CreateTaskModal } from '../components/common/CreateTaskModal';
import { TaskDetailsModal } from '../components/common/TaskDetailsModal';
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  Plus,
  Calendar,
  Sparkles,
  Activity as ActivityIcon,
  Inbox,
  TrendingUp,
  Megaphone,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TaskPlaceholder, Announcement } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { fetchLiveTasks } from '../services/taskService';
import { fetchAnnouncements } from '../services/announcementService';

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Team Lead';

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskPlaceholder | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [tasks, setTasks] = useState<TaskPlaceholder[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Time-aware dynamic greeting
  const getGreeting = () => {
    const currentHour = new Date().getHours();
    if (currentHour >= 5 && currentHour < 12) return 'Good morning';
    if (currentHour >= 12 && currentHour < 17) return 'Good afternoon';
    if (currentHour >= 17 && currentHour < 22) return 'Good evening';
    return 'Good night';
  };

  const [greeting, setGreeting] = useState(getGreeting());

  useEffect(() => {
    const timer = setInterval(() => {
      setGreeting(getGreeting());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    const [liveTasks, liveAnnouncements] = await Promise.all([
      fetchLiveTasks(),
      fetchAnnouncements(),
    ]);
    setTasks(liveTasks);
    setAnnouncements(liveAnnouncements.slice(0, 3));
    setIsLoading(false);
  };

  useEffect(() => {
    loadDashboardData();

    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('dashboard_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks' },
          () => {
            loadDashboardData();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'announcements' },
          () => {
            loadDashboardData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, []);

  const isMember = profile?.role === 'Member' || profile?.role === 'Lead';

  // Filter tasks assigned to or created by current user if role is Member / Lead
  const myTasks = tasks.filter(
    (t) =>
      t.assignee?.id === user?.id ||
      (t.assignee?.name && t.assignee.name.toLowerCase() === displayName.toLowerCase()) ||
      t.coAssignees?.some((c) => c.id === user?.id || (c.name && c.name.toLowerCase() === displayName.toLowerCase()))
  );

  const relevantTasks = isMember ? myTasks : tasks;

  const completedCount = relevantTasks.filter((t) => t.status === 'Done').length;
  const inProgressCount = relevantTasks.filter((t) => t.status === 'In Progress' || t.status === 'In Review').length;
  const pendingCount = relevantTasks.filter((t) => t.status === 'Todo' || t.status === 'Backlog').length;

  // Real 7-day task velocity graph calculation
  const velocityGraphData = React.useMemo(() => {
    const days: { day: string; tasks: number; completed: number }[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);

      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      // Tasks created/assigned on this day
      const tasksOnDay = relevantTasks.filter((t) => {
        if (!t.createdAt) return false;
        return t.createdAt.startsWith(dateStr);
      }).length;

      // Tasks completed on this day
      const completedOnDay = relevantTasks.filter((t) => {
        if (t.status !== 'Done') return false;
        if (t.createdAt && t.createdAt.startsWith(dateStr)) return true;
        return t.activityLog?.some(
          (log) => log.action?.toLowerCase().includes('done') && log.timestamp?.startsWith(dateStr)
        ) || false;
      }).length;

      days.push({
        day: dayName,
        tasks: tasksOnDay,
        completed: completedOnDay,
      });
    }

    const hasRecentActivity = days.some((d) => d.tasks > 0 || d.completed > 0);
    if (!hasRecentActivity && relevantTasks.length > 0) {
      const todayName = today.toLocaleDateString('en-US', { weekday: 'short' });
      return days.map((d) =>
        d.day === todayName
          ? { day: d.day, tasks: relevantTasks.length, completed: completedCount }
          : d
      );
    }

    return days;
  }, [relevantTasks, completedCount]);

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Welcome Card Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-brand-950 p-6 md:p-8 text-white shadow-soft-lg border border-slate-800">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-500/20 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30 backdrop-blur-sm">
                HFCL Limited Workspace
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-xs text-slate-300">Live Workspace Status</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              {greeting}, {displayName} 👋
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-xl leading-relaxed">
              Track active hardware R&D tasks, view team announcements, and collaborate seamlessly across teams.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            className="shadow-glow shrink-0 font-semibold text-xs py-2.5"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setCreateModalOpen(true)}
          >
            Create New Task
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card hoverEffect className="p-5 border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isMember ? 'My Assigned Tasks' : 'Total Active Tasks'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
              <FolderKanban className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{relevantTasks.length}</span>
            <span className="text-xs text-brand-700 font-semibold">Active Items</span>
          </div>
        </Card>

        <Card hoverEffect className="p-5 border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">In Progress</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{inProgressCount}</span>
            <span className="text-xs text-amber-700 font-semibold">In Execution</span>
          </div>
        </Card>

        <Card hoverEffect className="p-5 border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Completed Tasks</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{completedCount}</span>
            <span className="text-xs text-emerald-700 font-semibold">Finished</span>
          </div>
        </Card>

        <Card hoverEffect className="p-5 border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Backlog</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Inbox className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{pendingCount}</span>
            <span className="text-xs text-purple-700 font-semibold">To Start</span>
          </div>
        </Card>
      </div>

      {/* Main Graph & Announcements Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Chart */}
        <Card className="lg:col-span-2 space-y-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-brand-600" />
                  {isMember ? 'My Task Velocity & Completion' : 'Workspace Task Velocity & Completion'}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  {isMember
                    ? 'Daily tasks assigned vs completed by you (Last 7 Days).'
                    : 'Daily task creation vs completed deliverables across teams (Last 7 Days).'}
                </CardDescription>
              </div>
              <Badge variant="primary">Realtime</Badge>
            </div>
          </CardHeader>
          <CardContent className="h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={velocityGraphData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip />
                <Area type="monotone" dataKey="tasks" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorTasks)" name={isMember ? "Assigned Tasks" : "Total Tasks"} />
                <Area type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCompleted)" name="Completed" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Right Recent Announcements */}
        <Card className="space-y-4 flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-brand-600" />
                Company Broadcasts
              </CardTitle>
              <Badge variant="neutral">Latest</Badge>
            </div>
            <CardDescription className="text-xs text-slate-500">
              Recent notices posted for HFCL teams.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 pt-0 flex-1">
            {announcements.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No recent announcements posted yet.
              </div>
            ) : (
              announcements.map((ann) => (
                <div key={ann.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[11px] font-bold text-brand-700 block truncate">{ann.title}</span>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{ann.content}</p>
                  <span className="text-[10px] text-slate-400 block pt-1">{ann.author_name}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <CreateTaskModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onTaskCreated={() => loadDashboardData()}
      />

      {selectedTask && (
        <TaskDetailsModal
          isOpen={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          task={selectedTask}
          onTaskUpdated={() => loadDashboardData()}
        />
      )}
    </div>
  );
};
