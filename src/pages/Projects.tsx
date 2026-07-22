import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { FolderKanban, Plus, Search, Filter, Layers, ArrowUpRight } from 'lucide-react';

interface ProjectItem {
  id: string;
  name: string;
  key: string;
  description: string;
  status: 'Active' | 'Planning' | 'Completed' | 'On Hold';
  taskCount: number;
  progress: number;
  team: Array<{ name: string; avatar?: string }>;
  dueDate: string;
}

const mockProjects: ProjectItem[] = [
  {
    id: 'p-1',
    name: 'Auth & Supabase Infrastructure',
    key: 'AUTH',
    description: 'Enterprise OAuth2, session persistence, and Row Level Security audit.',
    status: 'Active',
    taskCount: 14,
    progress: 75,
    team: [
      { name: 'Alex Morgan', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' },
      { name: 'Sarah Jenkins', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
    ],
    dueDate: 'Aug 15, 2026',
  },
  {
    id: 'p-2',
    name: 'TaskFlow Design System v2',
    key: 'DS',
    description: 'Tailwind CSS design tokens, Radix UI primitives, and dark theme support.',
    status: 'Active',
    taskCount: 22,
    progress: 90,
    team: [
      { name: 'David Kim', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
    ],
    dueDate: 'Aug 02, 2026',
  },
  {
    id: 'p-3',
    name: 'Mobile iOS Companion App',
    key: 'MOB',
    description: 'React Native companion app for task management on the go.',
    status: 'Planning',
    taskCount: 8,
    progress: 20,
    team: [
      { name: 'Elena Rostova' },
    ],
    dueDate: 'Sep 30, 2026',
  },
];

export const Projects: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Page Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Workspace
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold text-brand-600">3 Active Projects</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-1">
            <FolderKanban className="w-6 h-6 text-brand-600" />
            Projects
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            className="shadow-soft font-semibold text-xs"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create Project
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Filter projects by key or name..."
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button variant="outline" size="sm" className="text-xs" leftIcon={<Filter className="w-3.5 h-3.5" />}>
            All Statuses
          </Button>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {mockProjects.map((project) => (
          <Card key={project.id} hoverEffect className="flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded">
                  {project.key}
                </span>
                <Badge variant={project.status === 'Active' ? 'primary' : 'warning'}>
                  {project.status}
                </Badge>
              </div>

              <h3 className="text-base font-bold text-slate-900 tracking-tight mb-1.5 flex items-center gap-1.5 hover:text-brand-600 transition-colors cursor-pointer">
                {project.name}
                <ArrowUpRight className="w-4 h-4 text-slate-400" />
              </h3>
              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
                {project.description}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-500 font-medium">Sprint Progress</span>
                  <span className="font-bold text-slate-800">{project.progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-600 rounded-full transition-all duration-300"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex -space-x-2 overflow-hidden">
                  {project.team.map((member, i) => (
                    <Avatar
                      key={i}
                      src={member.avatar}
                      name={member.name}
                      size="xs"
                      className="ring-2 ring-white"
                    />
                  ))}
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {project.taskCount} Tasks • Due {project.dueDate}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
