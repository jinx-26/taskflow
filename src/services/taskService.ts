import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { TaskPlaceholder } from '../types';

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
      status: t.status || 'In Progress',
      assignee: {
        name: t.assignee_name || (t.title.includes('PoE') ? 'Jignesh Giri' : 'Sarita Rani Guleria'),
        avatar: t.assignee_avatar || undefined,
      },
      dueDate: t.due_date || 'Jul 30, 2026',
      comments: t.comments || [],
    }));
  } catch (err) {
    console.error('fetchLiveTasks error:', err);
    return [];
  }
}
