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
  Inbox,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { TaskPlaceholder } from '../types';
import { fetchLiveTasks } from '../services/taskService';
import { TaskDetailsModal } from '../components/common/TaskDetailsModal';
import { CreateTaskModal } from '../components/common/CreateTaskModal';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface Project {
  id: string;
  key: string;
  name: string;
  description: string;
  status: 'Active' | 'Planning' | 'Completed' | 'On Hold';
  progress: number;
  due_date?: string;
  created_at?: string;
}

interface ProjectFile {
  id: string;
  name: string;
  url: string;
  size?: string;
  type?: string;
}

export const Projects: React.FC = () => {
  const { user, userRole } = useAuth();
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'timeline' | 'board' | 'list' | 'files'>('board');
  const [tasks, setTasks] = useState<TaskPlaceholder[]>([]);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [selectedTask, setSelectedTask] = useState<TaskPlaceholder | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);
  
  // New Project Modal State
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [projName, setProjName] = useState('');
  const [projKey, setProjKey] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [isSubmittingProj, setIsSubmittingProj] = useState(false);

  const isManagerOrAdmin = userRole === 'SuperAdmin' || userRole === 'Admin' || userRole === 'Manager';

  const loadProjectsData = async () => {
    setIsLoading(true);
    if (isSupabaseConfigured) {
      try {
        const [projRes, tasksRes] = await Promise.all([
          supabase.from('projects').select('*').order('created_at', { ascending: false }),
          fetchLiveTasks(),
        ]);

        if (projRes.data) {
          setProjectsList(projRes.data as Project[]);
        }
        setTasks(tasksRes);
      } catch (err) {
        console.error('Error fetching projects:', err);
      }
    } else {
      const liveTasks = await fetchLiveTasks();
      setTasks(liveTasks);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadProjectsData();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim() || !user) return;

    setIsSubmittingProj(true);
    const key = projKey.trim() || projName.substring(0, 4).toUpperCase();

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('projects')
          .insert([
            {
              key,
              name: projName.trim(),
              description: projDesc.trim(),
              status: 'Active',
              progress: 0,
              created_by: user.id,
            },
          ])
          .select()
          .single();

        if (!error && data) {
          setProjectsList((prev) => [data as Project, ...prev]);
        }
      } catch (err) {
        console.error('Error creating project:', err);
      }
    } else {
      const newProj: Project = {
        id: `proj-${Date.now()}`,
        key,
        name: projName.trim(),
        description: projDesc.trim(),
        status: 'Active',
        progress: 0,
      };
      setProjectsList((prev) => [newProj, ...prev]);
    }

    setProjName('');
    setProjKey('');
    setProjDesc('');
    setIsSubmittingProj(false);
    setShowCreateProjectModal(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProject || !isSupabaseConfigured) return;

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `projects/${selectedProject.id}/${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage.from('task-attachments').upload(filePath, file);

      if (!error && data) {
        const { data: pubData } = supabase.storage.from('task-attachments').getPublicUrl(filePath);
        const newFileObj: ProjectFile = {
          id: `file-${Date.now()}`,
          name: file.name,
          url: pubData.publicUrl,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          type: fileExt?.toUpperCase() || 'FILE',
        };
        setProjectFiles((prev) => [newFileObj, ...prev]);
      }
    } catch (err) {
      console.warn('File upload fallback:', err);
    }
  };

  const filteredProjects = projectsList.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const projectTasks = selectedProject
    ? tasks.filter((t) => t.project_id === selectedProject.id || t.project === selectedProject.name || t.project === selectedProject.key)
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
              Back to Projects Directory
            </Button>
          )}
          {isManagerOrAdmin && (
            <Button
              variant="primary"
              size="md"
              className="shadow-soft font-semibold text-xs"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                if (selectedProject) setCreateTaskModalOpen(true);
                else setShowCreateProjectModal(true);
              }}
            >
              {selectedProject ? 'Create Task in Project' : 'Create New Project'}
            </Button>
          )}
        </div>
      </div>

      {/* Directory Search Bar */}
      {!selectedProject && (
        <div className="w-full sm:w-80">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search project by name or key..."
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>
      )}

      {/* View 1: Projects Cards Directory */}
      {!selectedProject ? (
        isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading projects...
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-slate-500 space-y-3">
              <FolderKanban className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">No Projects Created Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Managers and Admins can create private hardware R&D projects to group tasks and documents.
              </p>
              {isManagerOrAdmin && (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setShowCreateProjectModal(true)}
                >
                  Create First Project
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredProjects.map((proj) => (
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
                    <span className="text-slate-900 font-bold">{proj.progress || 0}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-600 rounded-full transition-all duration-300"
                      style={{ width: `${proj.progress || 0}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-slate-400" /> Private Member Access
                  </span>
                  <span className="font-semibold text-brand-600 hover:underline">Click to View Details →</span>
                </div>
              </Card>
            ))}
          </div>
        )
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
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Status</span>
                  <span className="text-sm font-bold text-slate-800">{selectedProject.status}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Tasks</span>
                  <span className="text-sm font-bold text-slate-800">{projectTasks.length} Tasks</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Overall Completion</span>
                  <span className="text-sm font-bold text-slate-800">{selectedProject.progress || 0}%</span>
                </div>
              </div>
            </Card>
          )}

          {/* Sub-tab 2: Timeline */}
          {activeTab === 'timeline' && (
            <Card className="p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand-600" />
                Target Milestone Schedule
              </h3>
              {projectTasks.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No task deadlines set for this project yet.</p>
              ) : (
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
              )}
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

          {/* Sub-tab 5: Files & Specs (Zero hardcoded files!) */}
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
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-600 text-white font-bold text-xs shadow-soft hover:bg-brand-700 transition-colors">
                    <Upload className="w-4 h-4" /> Upload Document
                  </span>
                  <input type="file" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>

              {projectFiles.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <FileText className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-700">No Documents Uploaded Yet</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Click "Upload Document" above to share PDF, Excel, or Word spec sheets for this project.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {projectFiles.map((f) => (
                    <div key={f.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-5 h-5 text-brand-600 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-slate-800 block truncate max-w-[180px]">{f.name}</span>
                          <span className="text-[10px] text-slate-400">{f.size} • {f.type}</span>
                        </div>
                      </div>
                      <a href={f.url} target="_blank" rel="noopener noreferrer" download>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 flex items-center justify-center">
                          <Download className="w-3.5 h-3.5 text-slate-600" />
                        </Button>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateProjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-brand-600" />
                Create New Project
              </h3>
              <button onClick={() => setShowCreateProjectModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Project Name *</label>
                <Input
                  required
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  placeholder="e.g. WSS 5G Outdoor Unit Development"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Project Key (Short Code)</label>
                <Input
                  value={projKey}
                  onChange={(e) => setProjKey(e.target.value)}
                  placeholder="e.g. WSS-5G"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Description</label>
                <textarea
                  rows={3}
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  placeholder="Describe hardware requirements, CAD goals, firmware RTOS spec..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateProjectModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isSubmittingProj}>
                  Create Project
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateTaskModal
        isOpen={createTaskModalOpen}
        onClose={() => setCreateTaskModalOpen(false)}
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
