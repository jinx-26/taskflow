import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { CreateTaskModal } from '../components/common/CreateTaskModal';
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  TrendingUp,
  Plus,
  ArrowUpRight,
  Calendar,
  AlertTriangle,
  Sparkles,
  Activity as ActivityIcon,
  ChevronRight,
  Filter,
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
import { StatMetric, DeadlineItem, ActivityItem } from '../types';

// Dummy productivity chart dataset
const productivityData = [
  { day: 'Mon', completed: 4, created: 6, velocity: 70 },
  { day: 'Tue', completed: 7, created: 5, velocity: 82 },
  { day: 'Wed', completed: 5, created: 8, velocity: 75 },
  { day: 'Thu', completed: 11, created: 4, velocity: 94 },
  { day: 'Fri', completed: 9, created: 3, velocity: 88 },
  { day: 'Sat', completed: 3, created: 1, velocity: 60 },
  { day: 'Sun', completed: 6, created: 2, velocity: 85 },
];

// Placeholder metrics
const stats: StatMetric[] = [
  {
    title: 'Total Projects',
    value: '12',
    change: '+15.2%',
    isPositive: true,
    period: 'vs last month',
    icon: 'FolderKanban',
  },
  {
    title: 'Total Tasks',
    value: '48',
    change: '+8.4%',
    isPositive: true,
    period: 'vs last week',
    icon: 'CheckSquare',
  },
  {
    title: 'Pending Tasks',
    value: '18',
    change: '-3 tasks',
    isPositive: true,
    period: '5 high priority',
    icon: 'Clock',
  },
  {
    title: 'Completed Tasks',
    value: '30',
    change: '88% rate',
    isPositive: true,
    period: '+12 this week',
    icon: 'CheckCircle2',
  },
];

// Placeholder deadlines
const upcomingDeadlines: DeadlineItem[] = [
  {
    id: 'd-1',
    title: 'Supabase Row Level Security Audit',
    project: 'Auth System',
    dueDate: 'Today, 5:00 PM',
    priority: 'high',
    status: 'In Progress',
    assignee: { name: 'Sarah Jenkins', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
  },
  {
    id: 'd-2',
    title: 'Finalize Dark Theme Token Palette',
    project: 'Design System',
    dueDate: 'Tomorrow, 12:00 PM',
    priority: 'medium',
    status: 'Review',
    assignee: { name: 'David Kim', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
  },
  {
    id: 'd-3',
    title: 'API Rate Limiting & Edge Middleware',
    project: 'Core Backend',
    dueDate: 'Jul 25, 2026',
    priority: 'high',
    status: 'In Progress',
    assignee: { name: 'Alex Morgan', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' },
  },
  {
    id: 'd-4',
    title: 'Client Mobile Drawer Responsiveness',
    project: 'TaskFlow Web',
    dueDate: 'Jul 27, 2026',
    priority: 'low',
    status: 'Pending',
    assignee: { name: 'Elena Rostova' },
  },
];

// Placeholder activity feed
const recentActivity: ActivityItem[] = [
  {
    id: 'act-1',
    user: { name: 'Sarah Jenkins', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
    action: 'completed task',
    target: 'Auth Context Provider Hook',
    timestamp: '12 mins ago',
    iconType: 'complete',
  },
  {
    id: 'act-2',
    user: { name: 'Alex Morgan', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' },
    action: 'created new project',
    target: 'TaskFlow Mobile Companion App',
    timestamp: '45 mins ago',
    iconType: 'create',
  },
  {
    id: 'act-3',
    user: { name: 'David Kim', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
    action: 'commented on',
    target: 'Vite & Tailwind CSS Build Setup',
    timestamp: '2 hours ago',
    iconType: 'comment',
  },
  {
    id: 'act-4',
    user: { name: 'Elena Rostova' },
    action: 'updated priority for',
    target: 'React Router Guard Infrastructure',
    timestamp: '4 hours ago',
    iconType: 'update',
  },
];

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Team Lead';
  const [createModalOpen, setCreateModalOpen] = useState(false);

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Welcome Card Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-brand-950 p-6 md:p-8 text-white shadow-soft-lg border border-slate-800">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-500/20 via-transparent to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30 backdrop-blur-sm">
                Sprint #14 • Active
              </span>
              <span className="text-xs text-slate-400">Jul 20 - Aug 03</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              Good afternoon, {userName} 👋
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Your team completed <span className="font-semibold text-brand-300">30 tasks</span> this week with an overall sprint velocity of <span className="font-semibold text-emerald-400">88%</span>. 5 high-priority deadlines require attention.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="secondary"
              size="md"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm text-xs font-semibold"
            >
              Export Report
            </Button>
            <Button
              variant="primary"
              size="md"
              className="bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs shadow-soft"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setCreateModalOpen(true)}
            >
              New Task
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics Row (4 Widgets) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <Card hoverEffect className="relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Projects
            </span>
            <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">12</span>
            <span className="inline-flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              <TrendingUp className="w-3 h-3 mr-0.5" />
              +15.2%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">vs last month (10 active)</p>
        </Card>

        {/* Metric 2 */}
        <Card hoverEffect className="relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Tasks
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">48</span>
            <span className="inline-flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              <TrendingUp className="w-3 h-3 mr-0.5" />
              +8.4%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">across 4 active teams</p>
        </Card>

        {/* Metric 3 */}
        <Card hoverEffect className="relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Tasks
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">18</span>
            <span className="inline-flex items-center text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
              <AlertTriangle className="w-3 h-3 mr-0.5" />
              5 Urgent
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">12 in progress • 6 backlog</p>
        </Card>

        {/* Metric 4 */}
        <Card hoverEffect className="relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Completed Tasks
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">30</span>
            <span className="inline-flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              88% Rate
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">+12 completed this week</p>
        </Card>
      </div>

      {/* Main Grid: Productivity Chart + Deadlines / Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Productivity & Velocity Chart (2 Columns on Desktop) */}
        <Card className="lg:col-span-2 flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b-0">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ActivityIcon className="w-4 h-4 text-brand-600" />
                Productivity & Weekly Task Velocity
              </CardTitle>
              <CardDescription>
                Tasks completed vs created over the last 7 days
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-600 inline-block" />
                Completed
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
                Created
              </span>
            </div>
          </CardHeader>

          <CardContent className="pt-4 pb-0">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={productivityData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '0.75rem',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorCompleted)"
                  />
                  <Area
                    type="monotone"
                    dataKey="created"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCreated)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Timeline Widget */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b-0">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Recent Activity
              </CardTitle>
              <CardDescription>Live updates from your team</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-xs text-brand-600 p-1">
              View All
            </Button>
          </CardHeader>

          <CardContent className="pt-2 flex-1">
            <div className="space-y-4 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
              {recentActivity.map((act) => (
                <div key={act.id} className="relative flex items-start gap-3 pl-1">
                  <Avatar
                    src={act.user.avatar}
                    name={act.user.name}
                    size="sm"
                    className="ring-2 ring-white z-10"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-800 leading-snug">
                      <span className="font-semibold">{act.user.name}</span>{' '}
                      <span className="text-slate-500">{act.action}</span>{' '}
                      <span className="font-semibold text-slate-900">{act.target}</span>
                    </p>
                    <span className="text-[10px] text-slate-400">{act.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Deadlines Table Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b-0 pb-0">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-600" />
              Upcoming Deadlines
            </CardTitle>
            <CardDescription>Tasks scheduled for delivery in the next 7 days</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs" leftIcon={<Filter className="w-3.5 h-3.5" />}>
              Filter
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Task Title</th>
                  <th className="py-2.5 px-3">Project</th>
                  <th className="py-2.5 px-3">Due Date</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3">Assignee</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {upcomingDeadlines.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 text-slate-900 font-semibold">
                      {item.title}
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[11px]">
                        {item.project}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {item.dueDate}
                    </td>
                    <td className="py-3 px-3">
                      <Badge
                        variant={
                          item.priority === 'high'
                            ? 'danger'
                            : item.priority === 'medium'
                            ? 'warning'
                            : 'neutral'
                        }
                        dot
                      >
                        {item.priority.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <Avatar src={item.assignee.avatar} name={item.assignee.name} size="xs" />
                        <span className="text-slate-700">{item.assignee.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Badge
                        variant={
                          item.status === 'In Progress'
                            ? 'primary'
                            : item.status === 'Review'
                            ? 'purple'
                            : 'neutral'
                        }
                      >
                        {item.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <CreateTaskModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  );
};
