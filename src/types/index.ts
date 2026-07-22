import { User as SupabaseUser, Session as SupabaseSession } from '@supabase/supabase-js';

export type User = SupabaseUser | {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
    role?: string;
  };
};

export type Session = SupabaseSession | {
  user: User;
  access_token: string;
};

export interface NavItem {
  name: string;
  path: string;
  iconName: string;
  badge?: number | string;
}

export interface StatMetric {
  title: string;
  value: string | number;
  change: string;
  isPositive: boolean;
  period: string;
  icon: string;
}

export interface DeadlineItem {
  id: string;
  title: string;
  project: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  status: 'In Progress' | 'Review' | 'Pending';
  assignee: {
    name: string;
    avatar?: string;
  };
}

export interface ActivityItem {
  id: string;
  user: {
    name: string;
    avatar?: string;
  };
  action: string;
  target: string;
  timestamp: string;
  iconType: 'create' | 'complete' | 'comment' | 'update';
}

export interface ProjectPlaceholder {
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

export interface TaskPlaceholder {
  id: string;
  code: string;
  title: string;
  project: string;
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  status: 'Backlog' | 'Todo' | 'In Progress' | 'In Review' | 'Done';
  assignee: { name: string; avatar?: string };
  dueDate: string;
}
