import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { CreateTaskModal } from '../components/common/CreateTaskModal';
import { TaskDetailsModal } from '../components/common/TaskDetailsModal';
import { CheckSquare, Plus, Search, Filter, Loader2, Inbox } from 'lucide-react';
import { TaskPlaceholder } from '../types';
import { fetchLiveTasks } from '../services/taskService';

export const Tasks: React.FC = () => {
  const [taskList, setTaskList] = useState<TaskPlaceholder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskPlaceholder | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  const loadTasks = async () => {
    setIsLoading(true);
    const tasks = await fetchLiveTasks();
    setTaskList(tasks);
    setIsLoading(false);
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleTaskCreated = (newTask: any) => {
    setTaskList((prev) => [newTask, ...prev]);
  };

  const handleTaskUpdated = (updatedTask: TaskPlaceholder) => {
    setTaskList((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );
    setSelectedTask(updatedTask);
  };

  const filteredTasks = taskList.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <span className="text-xs font-semibold text-brand-600">
              {taskList.length} {taskList.length === 1 ? 'Task' : 'Tasks'}
            </span>
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button variant="outline" size="sm" className="text-xs" leftIcon={<Filter className="w-3.5 h-3.5" />}>
            All Priorities
          </Button>
        </div>
      </div>

      {/* Tasks Content Region */}
      {isLoading ? (
        <Card>
          <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            <p className="text-xs font-semibold text-slate-500">Loading workspace tasks...</p>
          </CardContent>
        </Card>
      ) : filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Inbox className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-base font-bold text-slate-900">No tasks assigned</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {searchQuery
                  ? 'No tasks match your search filter.'
                  : 'No active tasks found. Click Create Task to assign work to a team member.'}
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              className="text-xs font-semibold shadow-soft"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setCreateModalOpen(true)}
            >
              Create & Assign Task
            </Button>
          </CardContent>
        </Card>
      ) : (
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
                  {filteredTasks.map((task) => (
                    <tr
                      key={task.id}
                      onClick={() => {
                        setSelectedTask(task);
                        setDetailsModalOpen(true);
                      }}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      title="Click to view details, add comments, or mark complete"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-brand-600 group-hover:underline">
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
      )}

      {/* Task Creation Modal */}
      <CreateTaskModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onTaskCreated={handleTaskCreated}
      />

      {/* Task Details & Completion Modal */}
      <TaskDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        task={selectedTask}
        onTaskUpdated={handleTaskUpdated}
      />
    </div>
  );
};
