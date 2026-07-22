import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { TaskPlaceholder } from '../types';

export function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return 'Jul 30, 2026';
  
  if (dateStr.includes(',') && !dateStr.includes('T')) {
    return dateStr;
  }

  try {
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) {
      return dateStr;
    }
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch (e) {
    return dateStr;
  }
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
      status: t.status || 'In Progress',
      assignee: {
        name: t.assignee_name || (t.title.includes('PoE') ? 'Jignesh Giri' : 'Sarita Rani Guleria'),
        avatar: t.assignee_avatar || undefined,
      },
      createdBy: t.created_by_name || (t.title.includes('PoE') ? 'Sarita Rani Guleria (Manager)' : 'Jignesh Giri (Member)'),
      dueDate: formatDisplayDate(t.due_date),
      comments: t.comments || [],
    }));
  } catch (err) {
    console.error('fetchLiveTasks error:', err);
    return [];
  }
}
