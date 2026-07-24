import { User as SupabaseUser, Session as SupabaseSession } from '@supabase/supabase-js';

export type UserRole = 'SuperAdmin' | 'Admin' | 'Manager' | 'Lead' | 'Member' | 'Viewer';
export type UserStatus = 'Pending' | 'Approved' | 'Rejected' | 'Suspended';

export interface UserProfile {
  id: string;
  full_name: string;
  avatar_url?: string;
  role: UserRole;
  status: UserStatus;
  is_superadmin?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DeletionRequest {
  id: string;
  target_user_id: string;
  target_user_email: string;
  target_user_name: string;
  requested_by: string;
  requested_by_name: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
}

export type User = SupabaseUser | {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
    role?: UserRole;
    status?: UserStatus;
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

export type IssueType = 'Task' | 'Bug' | 'Feature' | 'Improvement';

export interface TaskCoAssignee {
  id?: string;
  name: string;
  avatar?: string;
  role?: string;
}

export interface SubtaskItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskActivityLog {
  id: string;
  userName: string;
  userAvatar?: string;
  action: string;
  timestamp: string;
}

export interface CollaborationRequest {
  id: string;
  taskId: string;
  taskCode: string;
  taskTitle: string;
  invitedByName: string;
  invitedById: string;
  targetUserId: string;
  targetUserEmail: string;
  status: 'Pending' | 'Accepted' | 'Declined';
  createdAt: string;
}

export interface TaskPlaceholder {
  id: string;
  code: string;
  title: string;
  description?: string;
  issueType?: IssueType;
  project: string;
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  status: 'Backlog' | 'Todo' | 'In Progress' | 'In Review' | 'Done';
  assignee: { name: string; avatar?: string; id?: string };
  coAssignees?: TaskCoAssignee[];
  pendingInvitations?: CollaborationRequest[];
  subtasks?: SubtaskItem[];
  activityLog?: TaskActivityLog[];
  comments?: any[];
  dueDate: string;
  createdBy?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  estimatedHours?: number;
  loggedHours?: number;
}
