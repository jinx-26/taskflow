import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { CreateTaskModal } from '../components/common/CreateTaskModal';
import { TaskDetailsModal } from '../components/common/TaskDetailsModal';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  Loader2,
  Inbox,
  LayoutGrid,
  ListFilter,
  UserCheck,
  Building,
  UserPlus,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { TaskPlaceholder, CollaborationRequest } from '../types';
import { useAuth } from '../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { fetchLiveTasks, respondToInvite } from '../services/taskService';

export const Tasks: React.FC = () => {
  const { user, profile, userRole } = useAuth();
  const [taskList, setTaskList] = useState<TaskPlaceholder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const isManagerOrAdmin =
    profile?.role === 'Admin' ||
    profile?.role === 'Manager' ||
    userRole === 'Admin' ||
    userRole === 'Manager' ||
    user?.email?.toLowerCase() === 'jignesh.giri2005@gmail.com';

  const [filterMode, setFilterMode] = useState<'assignedToMe' | 'all'>(
    isManagerOrAdmin ? 'all' : 'assignedToMe'
  );
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [isLoading, setIsLoading] = useState(true);

  // Modals & Action Message State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskPlaceholder | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const loadTasks = async () => {
    setIsLoading(true);
    const tasks = await fetchLiveTasks();
    setTaskList(tasks);
    setIsLoading(false);
  };

  useEffect(() => {
    loadTasks();

    const handleCustomTaskCreated = () => {
      loadTasks();
    };

    window.addEventListener('taskflow:task-created', handleCustomTaskCreated);

    let channel: any = null;
    if (isSupabaseConfigured) {
      channel = supabase
        .channel('tasks_page_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks' },
          () => {
            loadTasks();
          }
        )
        .subscribe();
    }

    return () => {
      window.removeEventListener('taskflow:task-created', handleCustomTaskCreated);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Update default filterMode if profile loads after initial render
  useEffect(() => {
    if (isManagerOrAdmin && filterMode === 'assignedToMe' && taskList.length === 0) {
      setFilterMode('all');
    }
  }, [isManagerOrAdmin]);

  // Collect all pending co-assignment invitations for the logged in user
  const myPendingInvites: Array<{ task: TaskPlaceholder; invite: CollaborationRequest }> = [];
  if (user) {
    taskList.forEach((t) => {
      if (Array.isArray(t.pendingInvitations)) {
        t.pendingInvitations.forEach((inv) => {
          const matchId = inv.targetUserId === user.id;
          const matchName = profile?.full_name && inv.targetUserEmail?.toLowerCase() === profile.full_name.toLowerCase();
          if ((matchId || matchName) && inv.status === 'Pending') {
            myPendingInvites.push({ task: t, invite: inv });
          }
        });
      }
    });
  }

  const handleRespondToInvite = async (
    taskId: string,
    inviteId: string,
    accept: boolean,
    taskTitle: string
  ) => {
    if (!profile) return;

    const success = await respondToInvite(taskId, inviteId, profile, accept);
    if (success) {
      setActionMsg(
        accept
          ? `Accepted co-assignment for "${taskTitle}"! Added to your My Tasks list.`
          : `Declined co-assignment invitation.`
      );
      setTimeout(() => setActionMsg(''), 4000);
      loadTasks();
    }
  };

  const filteredTasks = taskList.filter((t) => {
    if (t.isDeleted) return false;

    // PRIVACY ENFORCEMENT: Non-managers only see tasks where they are primary assignee, co-assignee, or creator
    if (!isManagerOrAdmin && user?.id) {
      const isPrimary = t.assignee?.id === user.id || (profile?.full_name && t.assignee?.name?.toLowerCase() === profile.full_name.toLowerCase());
      const isCoAssignee = t.coAssignees?.some(
        (ca) => ca.id === user.id || (profile?.full_name && ca.name?.toLowerCase() === profile.full_name.toLowerCase())
      );
      const isCreator = t.createdBy === user.id || (profile?.full_name && t.createdBy?.toLowerCase() === profile.full_name.toLowerCase());

      if (!isPrimary && !isCoAssignee && !isCreator) {
        return false;
      }
    }

    // Filter by assigned user toggle
    if (filterMode === 'assignedToMe' && user?.id) {
      const isPrimary = t.assignee?.id === user.id || (profile?.full_name && t.assignee?.name?.toLowerCase() === profile.full_name.toLowerCase());
      const isCoAssignee = t.coAssignees?.some(
        (ca) => ca.id === user.id || (profile?.full_name && ca.name?.toLowerCase() === profile.full_name.toLowerCase())
      );
      const isCreator = t.createdBy === user.id || (profile?.full_name && t.createdBy?.toLowerCase() === profile.full_name.toLowerCase());

      if (!isPrimary && !isCoAssignee && !isCreator) return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCode = t.code.toLowerCase().includes(q);
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchProject = t.project?.toLowerCase().includes(q);
      if (!matchCode && !matchTitle && !matchProject) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-brand-700 uppercase tracking-wider bg-brand-50 px-2 py-0.5 rounded border border-brand-200/60">
              HFCL Task Hub
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold text-slate-500">
              {filteredTasks.length} {filteredTasks.length === 1 ? 'Task' : 'Tasks'} Listed
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-1">
            <CheckSquare className="w-6 h-6 text-brand-600" />
            My Tasks & Work Orders
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

      {actionMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 flex items-center justify-between">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg('')} className="text-emerald-600 hover:text-emerald-800">
            ✕
          </button>
        </div>
      )}

      {/* PENDING CO-ASSIGNMENT INVITATIONS BANNER */}
      {myPendingInvites.length > 0 && (
        <Card className="bg-amber-50/80 border-amber-200 p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-amber-200/60 pb-2">
            <UserPlus className="w-5 h-5 text-amber-700" />
            <h3 className="text-sm font-extrabold text-amber-900">
              Pending Co-Assignment Invitations ({myPendingInvites.length})
            </h3>
          </div>

          <div className="space-y-2">
            {myPendingInvites.map(({ task, invite }) => (
              <div
                key={invite.id}
                className="p-3 bg-white rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-soft-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                      {task.code}
                    </span>
                    <span className="text-xs font-bold text-slate-900">{task.title}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Invited by <strong className="text-slate-800">{invite.invitedByName}</strong> to collaborate on this task.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-slate-600 hover:bg-slate-100"
                    leftIcon={<X className="w-3.5 h-3.5 text-slate-500" />}
                    onClick={() => handleRespondToInvite(task.id, invite.id, false, task.title)}
                  >
                    Decline
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 border-none text-white font-bold"
                    leftIcon={<Check className="w-3.5 h-3.5" />}
                    onClick={() => handleRespondToInvite(task.id, invite.id, true, task.title)}
                  >
                    Accept & Add to My Tasks
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Toolbar & View Toggles */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Filter Toggle */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setFilterMode('assignedToMe')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
              filterMode === 'assignedToMe'
                ? 'bg-brand-600 text-white border-brand-600 shadow-soft-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            My Assigned Tasks
          </button>
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
              filterMode === 'all'
                ? 'bg-brand-600 text-white border-brand-600 shadow-soft-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            All Department Tasks
          </button>
        </div>

        {/* Search & Board/Table View Toggle */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="w-full sm:w-64">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code, title, project..."
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              onClick={() => setViewMode('board')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'board' ? 'bg-white text-brand-600 shadow-soft-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Kanban Board View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'table' ? 'bg-white text-brand-600 shadow-soft-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Spreadsheet Table View"
            >
              <ListFilter className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main View Area */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading tasks...
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-slate-500 space-y-3">
            <Inbox className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No Tasks Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {filterMode === 'assignedToMe'
                ? "You don't have any active tasks assigned directly to you."
                : 'No tasks match your search criteria.'}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'board' ? (
        /* Board View */
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {['Todo', 'In Progress', 'In Review', 'Done'].map((status) => {
            const columnTasks = filteredTasks.filter((t) => t.status === status);
            return (
              <div key={status} className="bg-slate-50/70 p-3 rounded-2xl border border-slate-200/80 space-y-3 min-h-[450px]">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{status}</span>
                  <Badge variant="neutral">{columnTasks.length}</Badge>
                </div>

                <div className="space-y-2">
                  {columnTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => {
                        setSelectedTask(t);
                        setDetailsModalOpen(true);
                      }}
                      className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-soft-xs hover:border-brand-500 cursor-pointer space-y-2.5 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-200/60">
                          {t.code}
                        </span>
                        <Badge
                          variant={
                            t.priority === 'Urgent'
                              ? 'danger'
                              : t.priority === 'High'
                              ? 'warning'
                              : 'neutral'
                          }
                        >
                          {t.priority}
                        </Badge>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 leading-snug">{t.title}</h4>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] text-slate-500 font-medium">
                        <span className="truncate max-w-[120px] font-semibold text-slate-600">
                          {t.project || 'Standalone Task'}
                        </span>
                        <Avatar name={t.assignee?.name || 'Assignee'} size="xs" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase bg-slate-50/50">
                <th className="p-3">Task Code</th>
                <th className="p-3">Title</th>
                <th className="p-3">Project</th>
                <th className="p-3">Type</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Status</th>
                <th className="p-3">Assignee</th>
                <th className="p-3">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTasks.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => {
                    setSelectedTask(t);
                    setDetailsModalOpen(true);
                  }}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="p-3 font-bold text-brand-700">{t.code}</td>
                  <td className="p-3 font-bold text-slate-900">{t.title}</td>
                  <td className="p-3 text-slate-600 font-medium">{t.project || 'Standalone'}</td>
                  <td className="p-3 text-slate-600">{t.issueType || 'General Task'}</td>
                  <td className="p-3 font-semibold">{t.priority}</td>
                  <td className="p-3">
                    <Badge variant={t.status === 'Done' ? 'primary' : 'neutral'}>{t.status}</Badge>
                  </td>
                  <td className="p-3 font-bold text-slate-800">{t.assignee?.name || 'Unassigned'}</td>
                  <td className="p-3 text-slate-500">{t.dueDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Modals */}
      <CreateTaskModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onTaskCreated={() => loadTasks()}
      />

      {selectedTask && (
        <TaskDetailsModal
          isOpen={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          task={selectedTask}
          onTaskUpdated={() => loadTasks()}
        />
      )}
    </div>
  );
};
