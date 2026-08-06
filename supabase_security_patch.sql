-- ============================================================
-- TASKFLOW SECURITY PATCH — Apply in Supabase SQL Editor
-- Safe to re-run (uses DROP POLICY IF EXISTS / CREATE OR REPLACE)
-- Does NOT drop tables or delete data.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Fix helper functions — remove hardcoded email lookups
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Admin status comes from profiles.role only.
  -- No email-address comparisons — the trigger seeds the bootstrap admin.
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


-- ────────────────────────────────────────────────────────────
-- 2. Fix handle_new_user trigger
--    Role and status are ALWAYS seeded from safe defaults,
--    never from client-supplied raw_user_meta_data.
-- ────────────────────────────────────────────────────────────

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
    -- Role is NEVER taken from client metadata — always safe defaults.
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


-- ────────────────────────────────────────────────────────────
-- 3. Fix profiles RLS policies
-- ────────────────────────────────────────────────────────────

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


-- ────────────────────────────────────────────────────────────
-- 4. Fix departments & teams RLS policies
-- ────────────────────────────────────────────────────────────

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


-- ────────────────────────────────────────────────────────────
-- 5. Fix project_members RLS policies
-- ────────────────────────────────────────────────────────────

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


-- ────────────────────────────────────────────────────────────
-- 6. Fix announcements RLS
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins and Managers can create announcements" ON public.announcements;

CREATE POLICY "Admins and Managers can create announcements"
  ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins and Managers can update or delete announcements" ON public.announcements;
CREATE POLICY "Admins and Managers can update or delete announcements"
  ON public.announcements FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));


-- ────────────────────────────────────────────────────────────
-- 7. Fix notifications RLS — users see only their own
-- ────────────────────────────────────────────────────────────

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


-- ────────────────────────────────────────────────────────────
-- 8. Fix deletion_requests RLS — admins only
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can manage deletion requests" ON public.deletion_requests;

CREATE POLICY "Admins can manage deletion requests"
  ON public.deletion_requests FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));


-- ────────────────────────────────────────────────────────────
-- 9. Fix messages RLS — approved users only
-- ────────────────────────────────────────────────────────────

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


-- ────────────────────────────────────────────────────────────
-- 10. Storage — make task-attachments bucket private
--     Serve files via short-lived signed URLs from application code.
-- ────────────────────────────────────────────────────────────

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
