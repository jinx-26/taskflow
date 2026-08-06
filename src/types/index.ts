import { User as SupabaseUser, Session as SupabaseSession } from '@supabase/supabase-js';

export type UserRole = 'Admin' | 'Manager' | 'Lead' | 'Member';
export type UserStatus = 'Pending' | 'Approved' | 'Rejected' | 'Suspended';

export interface UserProfile {
  id: string;
  full_name: string;
  email?: string;          // added for notification routing
  avatar_url?: string;
  role: UserRole;
  status: UserStatus;
  department_id?: string;
  team_id?: string;
  team_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  manager_id?: string;
  manager_name?: string;
  created_at?: string;
}

export interface Team {
  id: string;
  department_id?: string;
  name: string;
  description?: string;
  lead_id?: string;
  lead_name?: string;
  members_count?: number;
  created_by?: string;
  created_at?: string;
}

export interface ProjectMember {
  project_id: string;
  user_id: string;
  role?: string;
  joined_at?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author_id?: string;
  author_name: string;
  author_avatar?: string;
  attachment_url?: string;
  attachment_name?: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id?: string;
  sender_name: string;
  sender_avatar?: string;
  content: string;
  attachment_url?: string;
  attachment_name?: string;
  attachment_type?: string;
  created_at: string;
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

export type IssueType =
  | 'PCB Layout'
  | 'Hardware Design'
  | 'Mechanical CAD'
  | 'Firmware Flash'
  | 'QA & Compliance'
  | 'Component Procurement'
  | 'Field Issue'
  | 'General Task';

export interface TaskCoAssignee {
  id?: string;
  name: string;
  avatar?: string;
  role?: string;
  teamName?: string;
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
  targetUserEmail?: string;
  status: 'Pending' | 'Accepted' | 'Declined';
  createdAt: string;
}

export interface TaskComment {
  id: string;
  authorId: string;
  authorName: string;     // max 100 chars enforced before write
  authorAvatar?: string;
  text: string;           // max 2000 chars enforced before write
  createdAt: string;
}

export interface TaskPlaceholder {
  id: string;
  code: string;
  title: string;
  description?: string;
  issueType?: IssueType;
  project: string;
  project_id?: string;
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  status: 'Backlog' | 'Todo' | 'In Progress' | 'In Review' | 'Done';
  assignee: { name: string; avatar?: string; id?: string; teamName?: string; role?: string };
  coAssignees?: TaskCoAssignee[];
  pendingInvitations?: CollaborationRequest[];
  subtasks?: SubtaskItem[];
  activityLog?: TaskActivityLog[];
  comments?: TaskComment[];
  dueDate: string;
  createdAt?: string;
  createdBy?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  estimatedHours?: number;
  loggedHours?: number;
  partNumber?: string;
  hardwareRev?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  testResult?: 'Pending' | 'Pass' | 'Fail' | 'Retest';
  requiresManagerApproval?: boolean;
  isApproved?: boolean;
  approvedBy?: string;
  blockedByTaskId?: string;
}

export interface ProjectComment {
  id: string;
  project_id: string;
  author_id?: string;
  author_name: string;
  author_avatar?: string;
  text: string;
  created_at: string;
}
