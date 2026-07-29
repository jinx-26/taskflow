import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, CheckSquare } from 'lucide-react';
import { TaskPlaceholder } from '../types';
import { fetchLiveTasks } from '../services/taskService';
import { CreateTaskModal } from '../components/common/CreateTaskModal';
import { TaskDetailsModal } from '../components/common/TaskDetailsModal';

const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const Calendar: React.FC = () => {
  const [tasks, setTasks] = useState<TaskPlaceholder[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskPlaceholder | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Dynamic Date State
  const [currentDate, setCurrentDate] = useState(new Date());

  const loadTasks = () => {
    fetchLiveTasks().then(setTasks);
  };

  useEffect(() => {
    loadTasks();
    const handleTaskEvent = () => loadTasks();
    window.addEventListener('taskflow:task-created', handleTaskEvent);
    return () => window.removeEventListener('taskflow:task-created', handleTaskEvent);
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthYearString = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Month navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleTodayMonth = () => {
    setCurrentDate(new Date());
  };

  // Real today check
  const realToday = new Date();
  const isCurrentMonthRealToday =
    realToday.getFullYear() === year && realToday.getMonth() === month;

  // Calendar grid calculations
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  // Get index of first day (0 = Mon, 6 = Sun)
  const firstDayOfWeekIndex = (new Date(year, month, 1).getDay() + 6) % 7;

  // Helper to check if task falls on a specific date
  const isTaskOnDay = (task: TaskPlaceholder, dayNum: number) => {
    if (!task.dueDate || task.isDeleted) return false;
    const taskDate = new Date(task.dueDate);
    if (!isNaN(taskDate.getTime())) {
      return (
        taskDate.getFullYear() === year &&
        taskDate.getMonth() === month &&
        taskDate.getDate() === dayNum
      );
    }
    // Fallback text match for formatted date strings (e.g. "Jul 29, 2026")
    const targetDateObj = new Date(year, month, dayNum);
    const monthShort = targetDateObj.toLocaleString('default', { month: 'short' }).toLowerCase();
    const dueLower = task.dueDate.toLowerCase();
    return dueLower.includes(monthShort) && dueLower.includes(dayNum.toString());
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-brand-700 uppercase tracking-wider bg-brand-50 px-2 py-0.5 rounded border border-brand-200/60">
              HFCL Schedule
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold text-slate-500">{monthYearString}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-1">
            <CalendarIcon className="w-6 h-6 text-brand-600" />
            Project & Task Target Calendar
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTodayMonth}
            className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-soft-xs transition-colors"
          >
            Today
          </button>

          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-soft-xs">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-bold text-slate-800 min-w-[110px] text-center">
              {monthYearString}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

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

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-4">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-2 mb-2 text-center">
            {daysOfWeek.map((day) => (
              <div key={day} className="text-xs font-bold text-slate-400 py-2 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          {/* Days Cells Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Blank offset cells for month start */}
            {Array.from({ length: firstDayOfWeekIndex }).map((_, idx) => (
              <div key={`empty-${idx}`} className="min-h-[110px] p-2 rounded-xl bg-slate-50/50 border border-slate-100/60 opacity-40" />
            ))}

            {/* Actual Month Days */}
            {Array.from({ length: totalDaysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const isToday = isCurrentMonthRealToday && realToday.getDate() === dayNum;
              const dayTasks = tasks.filter((t) => isTaskOnDay(t, dayNum));

              return (
                <div
                  key={`day-${dayNum}`}
                  className={`min-h-[110px] p-2 rounded-xl border transition-all flex flex-col justify-between ${
                    isToday
                      ? 'bg-brand-50/60 border-brand-300 ring-2 ring-brand-500/20'
                      : 'bg-white border-slate-100 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-extrabold ${
                        isToday
                          ? 'w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-xs'
                          : 'text-slate-700'
                      }`}
                    >
                      {dayNum}
                    </span>
                    {isToday && (
                      <span className="text-[9px] font-extrabold text-brand-600 uppercase tracking-wider bg-brand-100 px-1.5 py-0.2 rounded">
                        Today
                      </span>
                    )}
                  </div>

                  {/* Real Task Badges / Chips */}
                  <div className="space-y-1 overflow-y-auto max-h-[75px] pr-0.5 flex-1">
                    {dayTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          setSelectedTask(t);
                          setDetailsModalOpen(true);
                        }}
                        className={`text-[10px] font-bold p-1 rounded-lg cursor-pointer truncate transition-transform hover:scale-[1.02] border flex items-center justify-between gap-1 ${
                          t.priority === 'Urgent'
                            ? 'bg-red-50 text-red-800 border-red-200'
                            : t.priority === 'High'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-brand-50 text-brand-800 border-brand-200'
                        }`}
                        title={`${t.code}: ${t.title} (${t.status})`}
                      >
                        <span className="truncate">{t.code}: {t.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <CreateTaskModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onTaskCreated={loadTasks}
      />

      {selectedTask && (
        <TaskDetailsModal
          isOpen={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          task={selectedTask}
          onTaskUpdated={loadTasks}
        />
      )}
    </div>
  );
};
