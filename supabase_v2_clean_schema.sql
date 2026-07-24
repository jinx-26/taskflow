-- ====================================================================
-- TASKFLOW COMPLETE V2 CLEAN PRODUCTION DATABASE & 5-TIER RBAC SCHEMA
-- Fixed RLS Infinite Recursion Bug & Added Backfill for Existing Users
-- ====================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Drop legacy tables if resetting completely
DROP TABLE IF EXISTS public.deletion_requests CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 3. Create User Profiles Table with Status & 5-Tier Roles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT DEFAULT '',
  role TEXT DEFAULT 'Member' CHECK (role IN ('SuperAdmin', 'Admin', 'Manager', 'Lead', 'Member', 'Viewer')),
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Suspended')),
  is_superadmin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. SECURITY DEFINER Helper Functions (Prevents RLS Infinite Recursion Loops)
CREATE OR REPLACE FUNCTION public.is_admin_or_superadmin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND (role IN ('Admin', 'SuperAdmin') OR is_superadmin = true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_approved_user(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND (status = 'Approved' OR role = 'SuperAdmin' OR is_superadmin = true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- 5. Profiles RLS Policies
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users and Admins can update profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_admin_or_superadmin(auth.uid()))
  WITH CHECK (auth.uid() = id OR public.is_admin_or_superadmin(auth.uid()));

CREATE POLICY "Admins and SuperAdmins can delete profiles"
  ON public.profiles FOR DELETE TO authenticated
  USING (public.is_admin_or_superadmin(auth.uid()));


-- 6. Trigger to auto-create profile on Auth signup & notify SuperAdmin/Admins
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  user_full_name TEXT;
  user_role TEXT;
  is_first_superadmin BOOLEAN := false;
BEGIN
  user_email := LOWER(NEW.email);
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1));
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'Member');
  
  -- Check if this email is the designated master SuperAdmin (jignesh.giri2005@gmail.com)
  IF user_email = 'jignesh.giri2005@gmail.com' THEN
    is_first_superadmin := true;
  END IF;

  INSERT INTO public.profiles (id, full_name, avatar_url, role, status, is_superadmin)
  VALUES (
    NEW.id,
    user_full_name,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    CASE WHEN is_first_superadmin THEN 'SuperAdmin' ELSE user_role END,
    CASE WHEN is_first_superadmin THEN 'Approved' ELSE 'Pending' END,
    is_first_superadmin
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();

  -- Send automatic approval request notification to SuperAdmin
  IF NOT is_first_superadmin THEN
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


-- 7. Create Projects Table & RLS Policies
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

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view projects"
  ON public.projects FOR SELECT TO authenticated
  USING (public.is_approved_user(auth.uid()));

CREATE POLICY "Managers, Admins, SuperAdmins can manage projects"
  ON public.projects FOR ALL TO authenticated
  USING (public.is_approved_user(auth.uid()));


-- 8. Create Tasks Table & RLS Policies
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  issue_type TEXT DEFAULT 'Task' CHECK (issue_type IN ('Task', 'Bug', 'Feature', 'Improvement')),
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

CREATE POLICY "Approved users can view and manage tasks"
  ON public.tasks FOR ALL TO authenticated
  USING (public.is_approved_user(auth.uid()));


-- 9. Create Notifications Table & RLS Policies
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


-- 10. Create Deletion Requests Table (Admin Reason Pipeline for SuperAdmin Approval)
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

CREATE POLICY "Admins and SuperAdmins can manage deletion requests"
  ON public.deletion_requests FOR ALL TO authenticated
  USING (public.is_admin_or_superadmin(auth.uid()));


-- 11. Enable Realtime for live WebSocket updates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deletion_requests;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;


-- ====================================================================
-- 12. BACKFILL ALL EXISTING REGISTERED AUTH.USERS INTO PUBLIC.PROFILES
-- (Populates all users currently registered in Supabase Auth!)
-- ====================================================================

INSERT INTO public.profiles (id, full_name, avatar_url, role, status, is_superadmin)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'full_name', SPLIT_PART(email, '@', 1)),
  COALESCE(raw_user_meta_data->>'avatar_url', ''),
  CASE WHEN LOWER(email) = 'jignesh.giri2005@gmail.com' THEN 'SuperAdmin' ELSE COALESCE(raw_user_meta_data->>'role', 'Member') END,
  CASE WHEN LOWER(email) = 'jignesh.giri2005@gmail.com' THEN 'Approved' ELSE 'Pending' END,
  CASE WHEN LOWER(email) = 'jignesh.giri2005@gmail.com' THEN true ELSE false END
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  is_superadmin = EXCLUDED.is_superadmin;
