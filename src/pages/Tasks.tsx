import React, { useState } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { CreateTaskModal } from '../components/common/CreateTaskModal';
import { CheckSquare, Plus, Search, Filter, Clock, AlertCircle } from 'lucide-react';
import { TaskPlaceholder } from '../types';

const mockTasks: TaskPlaceholder[] = [
  {
    id: 't-1',
    code: 'AUTH-101',
    title: 'Configure Supabase Auth Provider & Persistent Session Guards',
    project: 'Auth System',
    priority: 'Urgent',
    status: 'Done',
    assignee: { name: 'Sarah Jenkins', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
    dueDate: 'Jul 22, 2026',
  },
  {
    id: 't-2',
    code: 'DS-204',
    title: 'Implement Linear/Vercel inspired Dashboard layout & Collapsible Sidebar',
    project: 'Design System',
    priority: 'High',
    status: 'In Progress',
    assignee: { name: 'Alex Morgan', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' },
    dueDate: 'Jul 23, 2026',
  },
  {
    id: 't-3',
    code: 'MOB-012',
    title: 'Design TanStack Query hooks for asynchronous cache invalidation',
    project: 'Core Architecture',
    priority: 'Medium',
    status: 'In Review',
    assignee: { name: 'David Kim', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
    dueDate: 'Jul 25, 2026',
  },
  {
    id: 't-4',
    code: 'AUTH-105',
    title: 'Email password reset token verification endpoint',
    project: 'Auth System',
    priority: 'High',
    status: 'Todo',
    assignee: { name: 'Elena Rostova' },
    dueDate: 'Jul 28, 2026',
  },
];

export const Tasks: React.FC = () => {
  const [taskList, setTaskList] = useState<TaskPlaceholder[]>(mockTasks);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const handleTaskCreated = (newTask: any) => {
    setTaskList((prev) => [newTask, ...prev]);
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Workspace
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold text-brand-600">{taskList.length} Tasks</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-1">
            <CheckSquare className="w-6 h-6 text-brand-600" />
            Tasks
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            className="shadow-soft font-semibold text-xs"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setCreateModalOpen(true)}
          >
            Create Task
          </Button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search tasks by title or code..."
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button variant="outline" size="sm" className="text-xs" leftIcon={<Filter className="w-3.5 h-3.5" />}>
            All Priorities
          </Button>
        </div>
      </div>

      {/* Tasks Table Card */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Task Title</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4 text-right">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {taskList.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50 transition-colors cursor-pointer">
                    <td className="py-3.5 px-4 font-mono font-bold text-brand-600">
                      {task.code}
                    </td>
                    <td className="py-3.5 px-4 text-slate-900 font-semibold max-w-xs truncate">
                      {task.title}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px]">
                        {task.project}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          task.priority === 'Urgent'
                            ? 'danger'
                            : task.priority === 'High'
                            ? 'warning'
                            : 'neutral'
                        }
                        dot
                      >
                        {task.priority}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          task.status === 'Done'
                            ? 'success'
                            : task.status === 'In Progress'
                            ? 'primary'
                            : task.status === 'In Review'
                            ? 'purple'
                            : 'neutral'
                        }
                      >
                        {task.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <Avatar src={task.assignee?.avatar} name={task.assignee?.name} size="xs" />
                        <span className="text-slate-700">{task.assignee?.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-500">
                      {task.dueDate}
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
        onTaskCreated={handleTaskCreated}
      />
    </div>
  );
};
