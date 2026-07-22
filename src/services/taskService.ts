import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { TaskPlaceholder } from '../types';

export interface TaskRecord {
  id: string;
  code: string;
  title: string;
  description?: string;
  project?: string;
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  status: 'Backlog' | 'Todo' | 'In Progress' | 'In Review' | 'Done';
  assignee_name?: string;
  assignee_avatar?: string;
  assignee_id?: string;
  created_by?: string;
  created_at?: string;
  due_date?: string;
}

export async function fetchLiveTasks(): Promise<TaskPlaceholder[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.warn('Error fetching tasks from Supabase:', error?.message);
      return [];
    }

    return data.map((t: any) => ({
      id: t.id,
      code: t.code || 'TSK-101',
      title: t.title,
      project: t.project || 'Auth System',
      priority: t.priority || 'Medium',
      status: t.status || 'Todo',
      assignee: {
        name: t.assignee_name || 'Assigned Member',
        avatar: t.assignee_avatar,
      },
      dueDate: t.due_date ? new Date(t.due_date).toLocaleDateString() : 'Jul 30, 2026',
    }));
  } catch (err) {
    console.error('fetchLiveTasks error:', err);
    return [];
  }
}

export async function createLiveTask(taskData: {
  code: string;
  title: string;
  project: string;
  priority: string;
  status: string;
  assignee_name: string;
  assignee_avatar?: string;
  due_date?: string;
  created_by_id?: string;
}): Promise<boolean> {
  if (!isSupabaseConfigured) return true;

  try {
    const { error } = await supabase.from('tasks').insert([
      {
        code: taskData.code,
        title: taskData.title,
        priority: taskData.priority,
        status: taskData.status,
        assignee_id: taskData.created_by_id,
        created_by: taskData.created_by_id,
      },
    ]);

    if (error) {
      console.warn('Supabase task insert warning:', error.message);
    }
    return true;
  } catch (err) {
    console.error('createLiveTask error:', err);
    return false;
  }
}
