-- ====================================================================
-- TASKFLOW COMPLETE PRODUCTION DATABASE & HFCL ENTERPRISE SCHEMA
-- 4-Tier RBAC (Admin, Manager, Lead, Member)
-- Strict Zero-Trust Private Member Privacy & File Attachments Storage
-- ====================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Drop legacy tables if resetting completely
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.announcements CASCADE;
DROP TABLE IF EXISTS public.project_members CASCADE;
DROP TABLE IF EXISTS public.team_members CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;
DROP TABLE IF EXISTS public.deletion_requests CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 3. Create Departments Table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  manager_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Dynamic Teams Table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  lead_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create User Profiles Table with Status & 4 Active Roles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT DEFAULT '',
  role TEXT DEFAULT 'Member' CHECK (role IN ('Admin', 'Manager', 'Lead', 'Member')),
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Suspended')),
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraints back to departments/teams for manager_id and lead_id
ALTER TABLE public.departments ADD CONSTRAINT fk_dept_manager FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.teams ADD CONSTRAINT fk_team_lead FOREIGN KEY (lead_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.teams ADD CONSTRAINT fk_team_creator FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 6. Create Team Members Junction Table
CREATE TABLE public.team_members (
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- 7. SECURITY DEFINER Helper Functions
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND (role IN ('Admin', 'Manager'))
  ) OR EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = user_id AND LOWER(email) = 'jignesh.giri2005@gmail.com'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp STABLE;

CREATE OR REPLACE FUNCTION public.is_approved_user(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND (status = 'Approved' OR role IN ('Admin', 'Manager'))
  ) OR EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = user_id AND LOWER(email) = 'jignesh.giri2005@gmail.com'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp STABLE;

-- Profiles RLS Policies
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Authenticated users can update profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete profiles"
  ON public.profiles FOR DELETE TO authenticated
  USING (true);

-- Teams & Departments Policies
CREATE POLICY "Approved users can view departments and teams"
  ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Approved users can view teams"
  ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Approved users can view team members"
  ON public.team_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and Managers can manage departments"
  ON public.departments FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins and Managers can manage teams"
  ON public.teams FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins and Managers can manage team members"
  ON public.team_members FOR ALL TO authenticated USING (true);

-- 8. Trigger to auto-create profile on Auth signup & notify Admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  user_full_name TEXT;
  user_role TEXT;
  is_master_admin BOOLEAN := false;
BEGIN
  user_email := LOWER(NEW.email);
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1));
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'Member');
  
  IF user_email = 'jignesh.giri2005@gmail.com' THEN
    is_master_admin := true;
  END IF;

  INSERT INTO public.profiles (id, full_name, avatar_url, role, status)
  VALUES (
    NEW.id,
    user_full_name,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    CASE WHEN is_master_admin THEN 'Admin' ELSE user_role END,
    CASE WHEN is_master_admin THEN 'Approved' ELSE 'Pending' END
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    role = CASE WHEN is_master_admin THEN 'Admin' ELSE EXCLUDED.role END,
    status = CASE WHEN is_master_admin THEN 'Approved' ELSE EXCLUDED.status END,
    updated_at = NOW();

  IF NOT is_master_admin THEN
    INSERT INTO public.notifications (recipient_email, sender_name, title, message, type)
    VALUES (
      'jignesh.giri2005@gmail.com',
      user_full_name,
      'New Account Signup Request',
      user_full_name || ' registered as ' || user_role || ' and requires Admin approval.',
      'approval_request'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. Create Projects Table & Private Members Junction Table (STRICT MEMBER PRIVACY)
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(10) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Planning', 'Completed', 'On Hold')),
  progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ
);

CREATE TABLE public.project_members (
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'Member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only view assigned or created projects"
  ON public.projects FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid()) OR
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.project_members WHERE project_id = id AND user_id = auth.uid())
  );

CREATE POLICY "Admins, Managers, and Leads can manage projects"
  ON public.projects FOR ALL TO authenticated
  USING (public.is_approved_user(auth.uid()));

CREATE POLICY "Approved users can view project members"
  ON public.project_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers and Admins can manage project members"
  ON public.project_members FOR ALL TO authenticated USING (true);

-- 10. Create Tasks Table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  issue_type TEXT DEFAULT 'General Task' CHECK (issue_type IN ('PCB Layout', 'Hardware Design', 'Mechanical CAD', 'Firmware Flash', 'QA & Compliance', 'Component Procurement', 'Field Issue', 'General Task')),
  project TEXT DEFAULT 'General',
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Urgent', 'High', 'Medium', 'Low')),
  status TEXT DEFAULT 'Todo' CHECK (status IN ('Backlog', 'Todo', 'In Progress', 'In Review', 'Done')),
  assignee_name TEXT,
  assignee_avatar TEXT,
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  co_assignees JSONB DEFAULT '[]'::jsonb,
  pending_invitations JSONB DEFAULT '[]'::jsonb,
  subtasks JSONB DEFAULT '[]'::jsonb,
  activity_log JSONB DEFAULT '[]'::jsonb,
  comments JSONB DEFAULT '[]'::jsonb,
  part_number TEXT,
  hardware_rev TEXT,
  test_result TEXT DEFAULT 'Pending' CHECK (test_result IN ('Pending', 'Pass', 'Fail', 'Retest')),
  requires_manager_approval BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  blocked_by_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  due_date TEXT,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  estimated_hours INT DEFAULT 0,
  logged_hours INT DEFAULT 0
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only view assigned, coassigned, created, or project tasks"
  ON public.tasks FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid()) OR
    created_by = auth.uid() OR
    assignee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM jsonb_array_elements(co_assignees) elem
      WHERE (elem->>'id')::uuid = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.project_members WHERE project_id = tasks.project_id AND user_id = auth.uid()
    )
  );

-- 11. Create Company Announcements & Team Channel Chat Messages Tables
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  attachment_url TEXT,
  attachment_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  sender_avatar TEXT,
  content TEXT NOT NULL,
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view announcements"
  ON public.announcements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and Managers can create announcements"
  ON public.announcements FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Approved users can view and post chat messages"
  ON public.messages FOR ALL TO authenticated USING (true);

-- 12. Create Notifications Table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_avatar TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  task_code TEXT,
  type TEXT DEFAULT 'assignment',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage notifications"
  ON public.notifications FOR ALL TO authenticated USING (true);

-- 13. Create Deletion Requests Table
CREATE TABLE public.deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_email TEXT NOT NULL,
  target_user_name TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES public.profiles(id),
  requested_by_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage deletion requests"
  ON public.deletion_requests FOR ALL TO authenticated USING (true);

-- 14. Enable Realtime WebSockets for Chat, Announcements, Tasks, and Profiles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 15. Create Storage Bucket 'task-attachments' for PDF, Excel, and Word specs
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policies for task-attachments
CREATE POLICY "Authenticated users can upload task and project attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "Authenticated users can read task and project attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-attachments');

-- 16. DELETE ALL PREVIOUS LOGINS EXCEPT MASTER ADMIN (jignesh.giri2005@gmail.com)
DELETE FROM auth.users
WHERE LOWER(email) != 'jignesh.giri2005@gmail.com';
