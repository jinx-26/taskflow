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
import { TaskPlaceholder } from '../types';
import { fetchLiveTasks, formatDisplayDate } from '../services/taskService';

// Productivity chart dataset
const productivityData = [
  { day: 'Mon', completed: 0, created: 0 },
  { day: 'Tue', completed: 0, created: 0 },
  { day: 'Wed', completed: 0, created: 0 },
  { day: 'Thu', completed: 0, created: 0 },
  { day: 'Fri', completed: 0, created: 0 },
  { day: 'Sat', completed: 0, created: 0 },
  { day: 'Sun', completed: 0, created: 0 },
];

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Team Lead';
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskPlaceholder | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [tasks, setTasks] = useState<TaskPlaceholder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = async () => {
    setIsLoading(true);
    const liveTasks = await fetchLiveTasks();
    setTasks(liveTasks);
    setIsLoading(false);
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleTaskUpdated = (updatedTask: TaskPlaceholder) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );
    setSelectedTask(updatedTask);
  };

  const completedCount = tasks.filter((t) => t.status === 'Done').length;
  const pendingCount = tasks.filter((t) => t.status !== 'Done').length;

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Welcome Card Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-brand-950 p-6 md:p-8 text-white shadow-soft-lg border border-slate-800">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-500/20 via-transparent to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30 backdrop-blur-sm">
                Sprint Active
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              Welcome back, {userName} 👋
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl leading-relaxed">
              You have <span className="font-semibold text-brand-300">{tasks.length} total tasks</span> in your workspace. Click any task below to manage, comment, or mark complete.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
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

      {/* Metrics Row */}
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
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">1</span>
            <span className="inline-flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              Active
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">TaskFlow Workspace</p>
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
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{tasks.length}</span>
            <span className="inline-flex items-center text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
              Live
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">across active workspace</p>
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
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{pendingCount}</span>
            <span className="inline-flex items-center text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
              In Progress
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">awaiting completion</p>
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
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{completedCount}</span>
            <span className="inline-flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              Done
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">verified deliverables</p>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Productivity Chart */}
        <Card className="lg:col-span-2 flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b-0">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ActivityIcon className="w-4 h-4 text-brand-600" />
                Productivity & Velocity
              </CardTitle>
              <CardDescription>
                Live task completion graph
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pt-4 pb-0">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={productivityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="completed" stroke="#2563eb" strokeWidth={2.5} fill="#bfdbfe" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Live Activity Feed */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b-0">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Recent Activity
              </CardTitle>
              <CardDescription>Workspace activity updates</CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pt-2 flex-1 flex flex-col justify-center items-center text-center p-6">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
              <Inbox className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-800">No recent activity</p>
            <p className="text-[11px] text-slate-400">Activity will log as tasks are created and updated.</p>
          </CardContent>
        </Card>
      </div>

      {/* Deadlines Table Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b-0 pb-0">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-600" />
              Assigned Tasks & Deadlines
            </CardTitle>
            <CardDescription>Live workspace task schedule</CardDescription>
          </div>
          <Button
            variant="primary"
            size="sm"
            className="text-xs font-semibold"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setCreateModalOpen(true)}
          >
            Create Task
          </Button>
        </CardHeader>

        <CardContent className="pt-4">
          {tasks.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-xs text-slate-500 font-medium">No tasks found in your workspace.</p>
              <Button variant="outline" size="sm" onClick={() => setCreateModalOpen(true)} className="text-xs">
                + Assign First Task
              </Button>
            </div>
          ) : (
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
                  {tasks.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => {
                        setSelectedTask(item);
                        setDetailsModalOpen(true);
                      }}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      title="Click to view details, add comments, or mark complete"
                    >
                      <td className="py-3 px-3 text-slate-900 font-semibold group-hover:text-brand-600">
                        {item.title}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[11px]">
                          {item.project}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {formatDisplayDate(item.dueDate)}
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={
                            item.priority === 'Urgent'
                              ? 'danger'
                              : item.priority === 'High'
                              ? 'warning'
                              : 'neutral'
                          }
                          dot
                        >
                          {item.priority}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <Avatar src={item.assignee?.avatar} name={item.assignee?.name} size="xs" />
                          <div className="flex flex-col">
                            <span className="text-slate-900 font-semibold">{item.assignee?.name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              by {(item as any).createdBy ? (item as any).createdBy.split(' ')[0] : 'Sarita'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Badge
                          variant={
                            item.status === 'Done'
                              ? 'success'
                              : item.status === 'In Progress'
                              ? 'primary'
                              : 'purple'
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
          )}
        </CardContent>
      </Card>

      <CreateTaskModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onTaskCreated={() => loadDashboardData()}
      />

      <TaskDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        task={selectedTask}
        onTaskUpdated={handleTaskUpdated}
      />
    </div>
  );
};
