import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { X, CheckSquare, User, Calendar, Tag, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated?: (newTask: any) => void;
}

export const teamMembersList = [
  { id: 'm-1', name: 'Alex Morgan', role: 'Member', email: 'alex.morgan@taskflow.io', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' },
  { id: 'm-2', name: 'Marcus Vance', role: 'Manager', email: 'marcus.vance@taskflow.io', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
  { id: 'm-3', name: 'Sarah Jenkins', role: 'Member', email: 'sarah.jenkins@taskflow.io', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
  { id: 'm-4', name: 'David Kim', role: 'Member', email: 'david.kim@taskflow.io', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
  { id: 'm-5', name: 'Elena Rostova', role: 'Admin', email: 'elena.rostova@taskflow.io' },
];

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onTaskCreated,
}) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [project, setProject] = useState('Auth System');
  const [assigneeName, setAssigneeName] = useState(teamMembersList[0].name);
  const [priority, setPriority] = useState<'Urgent' | 'High' | 'Medium' | 'Low'>('High');
  const [dueDate, setDueDate] = useState('Jul 30, 2026');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);

    const selectedAssignee = teamMembersList.find(m => m.name === assigneeName) || {
      name: assigneeName,
      avatar: undefined,
    };

    const newTask = {
      id: `task-${Date.now()}`,
      code: `TSK-${Math.floor(100 + Math.random() * 900)}`,
      title: title.trim(),
      project,
      priority,
      status: 'In Progress',
      assignee: selectedAssignee,
      createdBy: user?.user_metadata?.full_name || user?.email || 'Current User',
      dueDate,
    };

    setTimeout(() => {
      setIsSubmitting(false);
      setSuccessMsg(`Task "${newTask.code}" assigned to ${selectedAssignee.name} successfully!`);
      if (onTaskCreated) {
        onTaskCreated(newTask);
      }
      setTimeout(() => {
        setSuccessMsg('');
        setTitle('');
        onClose();
      }, 1500);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in-50 duration-150">
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-soft-lg border border-slate-200/90 overflow-hidden space-y-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Create & Assign Task</h2>
              <p className="text-xs text-slate-500">Assign work to any member in your workspace</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMsg ? (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold text-center">
            {successMsg}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Task Title"
              placeholder="e.g. Implement Supabase Row Level Security Policies"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Project Select */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Project
                </label>
                <select
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  className="w-full bg-white text-slate-900 text-xs rounded-xl border border-slate-200 px-3 py-2.5 h-10 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="Auth System">Auth System</option>
                  <option value="Design System">Design System</option>
                  <option value="Core Architecture">Core Architecture</option>
                  <option value="Mobile Companion App">Mobile Companion App</option>
                </select>
              </div>

              {/* Assignee Select */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Assign To Member
                </label>
                <select
                  value={assigneeName}
                  onChange={(e) => setAssigneeName(e.target.value)}
                  className="w-full bg-white text-slate-900 text-xs rounded-xl border border-slate-200 px-3 py-2.5 h-10 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 font-medium"
                >
                  {teamMembersList.map((member) => (
                    <option key={member.id} value={member.name}>
                      {member.name} ({member.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Priority Select */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full bg-white text-slate-900 text-xs rounded-xl border border-slate-200 px-3 py-2.5 h-10 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="Urgent">Urgent</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              {/* Due Date Input */}
              <Input
                label="Due Date"
                type="text"
                placeholder="Jul 30, 2026"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <Button variant="outline" size="md" onClick={onClose} className="text-xs">
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="text-xs font-semibold shadow-soft"
                isLoading={isSubmitting}
              >
                Create & Assign Task
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
