import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import {
  FolderKanban,
  Plus,
  Search,
  Filter,
  Layers,
  Calendar,
  ListFilter,
  FileText,
  Clock,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Upload,
  Download,
  Users,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { TaskPlaceholder } from '../types';
import { fetchLiveTasks } from '../services/taskService';
import { TaskDetailsModal } from '../components/common/TaskDetailsModal';
import { CreateTaskModal } from '../components/common/CreateTaskModal';

interface Project {
  id: string;
  key: string;
  name: string;
  description: string;
  status: 'Active' | 'Planning' | 'Completed';
  progress: number;
  dueDate: string;
  members: string[];
}

const mockProjects: Project[] = [
  {
    id: 'proj-1',
    key: 'WSS-5G',
    name: 'WSS 5G Outdoor Unit Development',
    description: 'Hardware, mechanical CAD enclosure, and RTOS firmware for 5G telecom outdoor equipment.',
    status: 'Active',
    progress: 65,
    dueDate: '2026-08-30',
    members: ['Hardware Lead', 'Mechanical Lead', 'QA Lead'],
  },
  {
    id: 'proj-2',
    key: 'OPT-FIB',
    name: 'Optical Fiber Termination R&D',
    description: 'High-speed optical transceiver PCB design and thermal testing.',
    status: 'Planning',
    progress: 30,
    dueDate: '2026-09-15',
    members: ['Hardware Lead', 'QA Lead'],
  },
];

export const Projects: React.FC = () => {
  const { user, userRole } = useAuth();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'timeline' | 'board' | 'list' | 'files'>('board');
  const [tasks, setTasks] = useState<TaskPlaceholder[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskPlaceholder | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const isManagerOrAdmin = userRole === 'SuperAdmin' || userRole === 'Admin' || userRole === 'Manager';

  useEffect(() => {
    fetchLiveTasks().then(setTasks);
  }, []);

  const projectTasks = selectedProject
    ? tasks.filter((t) => t.project === selectedProject.name || t.project === selectedProject.key || true)
    : tasks;

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-brand-700 uppercase tracking-wider bg-brand-50 px-2 py-0.5 rounded border border-brand-200/60">
              HFCL Projects
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold text-slate-500">Private Member Access</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-1">
            <FolderKanban className="w-6 h-6 text-brand-600" />
            {selectedProject ? selectedProject.name : 'Projects Directory'}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {selectedProject && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => setSelectedProject(null)}
            >
              Back to Projects List
            </Button>
          )}
          {isManagerOrAdmin && (
            <Button
              variant="primary"
              size="md"
              className="shadow-soft font-semibold text-xs"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setCreateModalOpen(true)}
            >
              Create Task in Project
            </Button>
          )}
        </div>
      </div>

      {/* View 1: Projects Cards Directory */}
      {!selectedProject ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {mockProjects.map((proj) => (
            <Card
              key={proj.id}
              hoverEffect
              className="p-6 border border-slate-200/80 cursor-pointer flex flex-col justify-between space-y-4"
              onClick={() => setSelectedProject(proj)}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200/60">
                    {proj.key}
                  </span>
                  <Badge variant={proj.status === 'Active' ? 'primary' : 'neutral'} dot>
                    {proj.status}
                  </Badge>
                </div>
                <h3 className="text-lg font-bold text-slate-900 leading-snug">{proj.name}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{proj.description}</p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <span>Progress</span>
                  <span className="text-slate-900 font-bold">{proj.progress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-600 rounded-full transition-all duration-300"
                    style={{ width: `${proj.progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-slate-400" /> Private Project
                </span>
                <span className="font-semibold text-brand-600 hover:underline">Click to View Details →</span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        /* View 2: Inside Selected Project (Sub-tabs: Summary, Timeline, Board, List, Files & Specs) */
        <div className="space-y-6">
          {/* Sub-tabs Header Bar */}
          <div className="flex items-center gap-1 border-b border-slate-200 pb-px overflow-x-auto">
            {[
              { id: 'summary', label: 'Summary', icon: Layers },
              { id: 'timeline', label: 'Timeline', icon: Calendar },
              { id: 'board', label: 'Board', icon: FolderKanban },
              { id: 'list', label: 'List', icon: ListFilter },
              { id: 'files', label: 'Files & Specs', icon: FileText },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
                    isActive
                      ? 'border-brand-600 text-brand-600 bg-brand-50/50'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Sub-tab 1: Summary */}
          {activeTab === 'summary' && (
            <Card className="p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900">Project Overview</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{selectedProject.description}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Target Due Date</span>
                  <span className="text-sm font-bold text-slate-800">{selectedProject.dueDate}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Tasks</span>
                  <span className="text-sm font-bold text-slate-800">{projectTasks.length} Tasks</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Overall Completion</span>
                  <span className="text-sm font-bold text-slate-800">{selectedProject.progress}%</span>
                </div>
              </div>
            </Card>
          )}

          {/* Sub-tab 2: Timeline */}
          {activeTab === 'timeline' && (
            <Card className="p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand-600" />
                Gantt Milestone Schedule
              </h3>
              <div className="space-y-3">
                {projectTasks.map((t) => (
                  <div key={t.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">{t.title}</span>
                      <span className="text-[10px] text-slate-400">{t.issueType} • Due {t.dueDate}</span>
                    </div>
                    <Badge variant={t.status === 'Done' ? 'primary' : 'neutral'}>{t.status}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Sub-tab 3: Board */}
          {activeTab === 'board' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {['Todo', 'In Progress', 'In Review', 'Done'].map((status) => {
                const columnTasks = projectTasks.filter((t) => t.status === status);
                return (
                  <div key={status} className="bg-slate-50/70 p-3 rounded-2xl border border-slate-200/80 space-y-3 min-h-[400px]">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{status}</span>
                      <Badge variant="neutral">{columnTasks.length}</Badge>
                    </div>

                    <div className="space-y-2">
                      {columnTasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => {
                            setSelectedTask(task);
                            setDetailsModalOpen(true);
                          }}
                          className="p-3 bg-white rounded-xl border border-slate-200 shadow-soft-xs hover:border-brand-500 cursor-pointer space-y-2 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-200/60">
                              {task.code}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400">{task.priority}</span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 leading-snug">{task.title}</h4>
                          {task.assignee?.name && (
                            <div className="text-[10px] text-slate-500 font-medium pt-1 border-t border-slate-100 flex items-center gap-1">
                              <span>Assignee:</span>
                              <span className="font-bold text-slate-800">{task.assignee.name}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sub-tab 4: List */}
          {activeTab === 'list' && (
            <Card className="p-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase">
                    <th className="p-2">Code</th>
                    <th className="p-2">Title</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Priority</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {projectTasks.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => {
                        setSelectedTask(t);
                        setDetailsModalOpen(true);
                      }}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="p-2 font-bold text-brand-700">{t.code}</td>
                      <td className="p-2 font-bold text-slate-900">{t.title}</td>
                      <td className="p-2 text-slate-600">{t.issueType}</td>
                      <td className="p-2 text-slate-600">{t.priority}</td>
                      <td className="p-2"><Badge variant={t.status === 'Done' ? 'primary' : 'neutral'}>{t.status}</Badge></td>
                      <td className="p-2 text-slate-500">{t.dueDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* Sub-tab 5: Files & Specs (Replaces Code for HFCL) */}
          {activeTab === 'files' && (
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-brand-600" />
                    Project Documents & Technical Specs
                  </h3>
                  <p className="text-xs text-slate-500">PDF datasheets, Excel BOMs, and Word specifications.</p>
                </div>
                <Button variant="primary" size="sm" leftIcon={<Upload className="w-4 h-4" />}>
                  Upload File
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { name: 'PCB_Layout_Schematics_v1.2.pdf', size: '4.2 MB', type: 'PDF' },
                  { name: 'Hardware_BOM_Parts_Costing.xlsx', size: '1.8 MB', type: 'Excel' },
                  { name: 'Enclosure_Thermal_Test_Report.docx', size: '2.5 MB', type: 'Word' },
                ].map((f, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-5 h-5 text-brand-600 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block truncate max-w-[180px]">{f.name}</span>
                        <span className="text-[10px] text-slate-400">{f.size} • {f.type}</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 flex items-center justify-center">
                      <Download className="w-3.5 h-3.5 text-slate-600" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateTaskModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onTaskCreated={() => fetchLiveTasks().then(setTasks)}
      />

      {selectedTask && (
        <TaskDetailsModal
          isOpen={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          task={selectedTask}
          onTaskUpdated={() => fetchLiveTasks().then(setTasks)}
        />
      )}
    </div>
  );
};
