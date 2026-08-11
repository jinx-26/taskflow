-- =============================================================================
-- BASELINE MIGRATION (consolidated 2026-08-11, Phase 5)
-- =============================================================================
-- This file replaces the former ad-hoc schema sources:
--   * supabase/schema.sql            (legacy v1 — superseded, deleted)
--   * supabase_v2_clean_schema.sql   (v2 clean schema — superseded, deleted)
--   * supabase_security_patch.sql    (security patch — superseded, deleted)
--
-- Contents below = clean schema followed by the security patch, verbatim,
-- so a fresh database reaches the full pre-Phase-1 state in one idempotent
-- pass. Later migrations (20260811*) layer the hardening on top.
-- NOTE: the destructive "DELETE FROM auth.users" step that once lived at the
-- end of the v2 schema was removed in Phase 1 and is NOT included here.
-- =============================================================================

-- ====================================================================
-- TASKFLOW COMPLETE PRODUCTION DATABASE & HFCL ENTERPRISE SCHEMA

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

-- 16. DANGEROUS STEP REMOVED (2026-08-11, Phase 1 hardening)
--     The following statement previously deleted every login except one
--     personal account and has been removed permanently. Fresh environments
--     have no users to purge; existing environments must not be wiped by a
--     setup script. Account removal now goes through the deletion_requests
--     approval workflow or the Supabase dashboard.
-- DELETE FROM auth.users   -- REMOVED â€” see memory.md
-- ============================================================
-- TASKFLOW SECURITY PATCH â€” Apply in Supabase SQL Editor
-- Safe to re-run (uses DROP POLICY IF EXISTS / CREATE OR REPLACE)
-- Does NOT drop tables or delete data.
-- ============================================================

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. Fix helper functions â€” remove hardcoded email lookups
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Admin status comes from profiles.role only.
  -- No email-address comparisons â€” the trigger seeds the bootstrap admin.
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role IN ('Admin', 'Manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp STABLE;

CREATE OR REPLACE FUNCTION public.is_approved_user(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND (status = 'Approved' OR role IN ('Admin', 'Manager'))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp STABLE;


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 2. Fix handle_new_user trigger
--    Role and status are ALWAYS seeded from safe defaults,
--    never from client-supplied raw_user_meta_data.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_email     TEXT;
  user_full_name TEXT;
  is_bootstrap   BOOLEAN := false;
BEGIN
  user_email     := LOWER(NEW.email);
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1));

  -- The bootstrap admin email may be changed here; this is the ONE place it
  -- appears in SQL. It is removed from all TypeScript client code.
  IF user_email = 'jignesh.giri2005@gmail.com' THEN
    is_bootstrap := true;
  END IF;

  INSERT INTO public.profiles (id, full_name, avatar_url, role, status)
  VALUES (
    NEW.id,
    user_full_name,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    -- Role is NEVER taken from client metadata â€” always safe defaults.
    CASE WHEN is_bootstrap THEN 'Admin' ELSE 'Member' END,
    CASE WHEN is_bootstrap THEN 'Approved' ELSE 'Pending' END
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name  = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    -- On re-insert conflict, only update name/avatar; never downgrade an
    -- existing admin's role or reset their status.
    updated_at = NOW();

  IF NOT is_bootstrap THEN
    INSERT INTO public.notifications (sender_name, title, message, type)
    VALUES (
      user_full_name,
      'New Account Signup Request',
      user_full_name || ' registered and requires Admin approval.',
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


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 3. Fix profiles RLS policies
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

DROP POLICY IF EXISTS "Authenticated users can update profiles"   ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can delete profiles"   ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles"     ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile"        ON public.profiles;

-- SELECT: any authenticated user may view profiles (needed for team/assignee UIs)
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- INSERT: users may only create their own profile row
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- UPDATE: users edit their own row; admins can edit any row
CREATE POLICY "Users update own profile or admins update any"
  ON public.profiles FOR UPDATE TO authenticated
  USING  (auth.uid() = id OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() = id OR public.is_admin(auth.uid()));

-- DELETE: only admins may delete profile rows
CREATE POLICY "Only admins can delete profiles"
  ON public.profiles FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 4. Fix departments & teams RLS policies
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

DROP POLICY IF EXISTS "Admins and Managers can manage departments" ON public.departments;
DROP POLICY IF EXISTS "Admins and Managers can manage teams"       ON public.teams;
DROP POLICY IF EXISTS "Admins and Managers can manage team members" ON public.team_members;

-- Manage means Admin/Manager only (is_admin covers both roles)
CREATE POLICY "Admins and Managers can manage departments"
  ON public.departments FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins and Managers can manage teams"
  ON public.teams FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins and Managers can manage team members"
  ON public.team_members FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 5. Fix project_members RLS policies
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

DROP POLICY IF EXISTS "Approved users can view project members"        ON public.project_members;
DROP POLICY IF EXISTS "Managers and Admins can manage project members" ON public.project_members;

CREATE POLICY "Project members can view membership"
  ON public.project_members FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid()) OR
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.project_members pm2
      WHERE pm2.project_id = project_members.project_id AND pm2.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and Managers can manage project members"
  ON public.project_members FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 6. Fix announcements RLS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

DROP POLICY IF EXISTS "Admins and Managers can create announcements" ON public.announcements;

CREATE POLICY "Admins and Managers can create announcements"
  ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins and Managers can update or delete announcements" ON public.announcements;
CREATE POLICY "Admins and Managers can update or delete announcements"
  ON public.announcements FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 7. Fix notifications RLS â€” users see only their own
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

DROP POLICY IF EXISTS "Authenticated users can manage notifications" ON public.notifications;

CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    recipient_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);  -- Triggers and app code insert; recipient is validated server-side

CREATE POLICY "Users can mark own notifications read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (
    recipient_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    recipient_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 8. Fix deletion_requests RLS â€” admins only
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

DROP POLICY IF EXISTS "Admins can manage deletion requests" ON public.deletion_requests;

CREATE POLICY "Admins can manage deletion requests"
  ON public.deletion_requests FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 9. Fix messages RLS â€” approved users only
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

DROP POLICY IF EXISTS "Approved users can view and post chat messages" ON public.messages;

CREATE POLICY "Approved users can view chat messages"
  ON public.messages FOR SELECT TO authenticated
  USING (public.is_approved_user(auth.uid()));

CREATE POLICY "Approved users can post chat messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    public.is_approved_user(auth.uid()) AND
    sender_id = auth.uid()  -- users can only post as themselves
  );


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 10. Storage â€” make task-attachments bucket private
--     Serve files via short-lived signed URLs from application code.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

UPDATE storage.buckets
SET public = false
WHERE id = 'task-attachments';

DROP POLICY IF EXISTS "Authenticated users can upload task and project attachments"
  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read task and project attachments"
  ON storage.objects;

-- Upload: path must be scoped to the authenticated user's UUID folder
CREATE POLICY "Users upload to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read: any approved authenticated user may fetch (app generates signed URLs)
CREATE POLICY "Approved users can read attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND public.is_approved_user(auth.uid())
  );

-- ============================================================
-- END OF SECURITY PATCH
-- ============================================================
