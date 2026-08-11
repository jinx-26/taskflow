-- =============================================================================
-- Phase 1: Authorization correctness hardening
-- =============================================================================
-- Idempotent. Safe to apply over either the clean schema or the security
-- patch state (all policies/functions replaced via DROP IF EXISTS / REPLACE).
--
-- What this migration does and why:
--
-- 1. app_settings table + bootstrap email held in DATA, not code.
--    WHY: the master-admin email was hard-coded in is_admin(),
--    is_approved_user() and handle_new_user(). A personal Gmail address in
--    privilege-checking SQL is unacceptable for a corporate deployment and
--    the address leaked into three places, inviting drift.
--
-- 2. is_admin()/is_approved_user() answer from profiles ONLY.
--    WHY: an email-string comparison is a privilege decision based on a
--    mutable, attacker-influenceable attribute, and silently bypassed the
--    approval workflow.
--
-- 3. handle_new_user() reads the bootstrap email from app_settings; role and
--    status ALWAYS come from safe defaults (never client metadata);
--    fixes a NOT NULL recipient_email bug in the notification insert that
--    would have broken every non-bootstrap signup under the old patch.
--
-- 4. protect_profile_privileges() trigger:
--    non-admin UPDATE of profiles FORCES role/status back to their current
--    (OLD) values. WHY: Postgres RLS cannot compare OLD vs NEW row values,
--    so a row-level policy alone cannot stop 'UPDATE profiles SET
--    role=''Admin'' WHERE id = my_id'. A trigger is the only correct layer.
--
-- 5. admin_set_profile_role() SECURITY DEFINER function: the ONLY path for
--    role/status changes. REVOKEd from public; admins only. Client code must
--    call supabase.rpc('admin_set_profile_role', ...) — never a raw UPDATE
--    touching role/status.
--
-- 6. tasks policies split per action:
--    SELECT = creator / assignee / co-assignee / project member / admin
--    INSERT = any approved user (must create as themselves)
--    UPDATE = creator / assignee / co-assignee / lead+ / admin
--    DELETE = creator / admin
--    WHY: the single FOR ALL policy meant anyone who could SEE a task could
--    DELETE it.
--
-- 7. projects INSERT now requires creator = auth.uid(); projects
--    UPDATE/DELETE restricted to admins/managers/creator.
--
-- Manual sanity check (run as a NON-admin test user after applying):
--   a) UPDATE profiles SET role='Admin' WHERE id = auth.uid();
--      → must succeed silently but role must remain unchanged (trigger).
--   b) SELECT public.admin_set_profile_role(auth.uid(), 'Admin', 'Approved');
--      → must ERROR 'Only Admins may change roles'.
--   c) DELETE FROM tasks WHERE id = '<someone-else-task>';
--      → must affect 0 rows (or error).
-- =============================================================================

-- ─── 1. app_settings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write settings (contains the bootstrap identity).
DROP POLICY IF EXISTS "Admins manage app_settings" ON public.app_settings;
CREATE POLICY "Admins manage app_settings"
  ON public.app_settings FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Seed the bootstrap email (CHANGE THIS before first deploy for another org).
INSERT INTO public.app_settings (key, value)
VALUES ('bootstrap_admin_email', 'jignesh.giri2005@gmail.com')
ON CONFLICT (key) DO NOTHING;

-- ─── 2. Privilege helpers — profiles table is the only source of truth ───────
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
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

-- ─── 3. Signup trigger — bootstrap email from settings, no client metadata ───
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_email      TEXT;
  user_full_name  TEXT;
  bootstrap_email TEXT;
  is_bootstrap    BOOLEAN := false;
BEGIN
  user_email     := LOWER(NEW.email);
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name',
                             SPLIT_PART(NEW.email, '@', 1));

  SELECT value INTO bootstrap_email
    FROM public.app_settings WHERE key = 'bootstrap_admin_email';
  is_bootstrap := (bootstrap_email IS NOT NULL AND user_email = LOWER(bootstrap_email));

  INSERT INTO public.profiles (id, full_name, avatar_url, role, status)
  VALUES (
    NEW.id,
    user_full_name,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    CASE WHEN is_bootstrap THEN 'Admin'    ELSE 'Member'  END,  -- never client metadata
    CASE WHEN is_bootstrap THEN 'Approved' ELSE 'Pending' END
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name  = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();

  -- Notify admins of the signup request (recipient_email is NOT NULL).
  IF NOT is_bootstrap THEN
    INSERT INTO public.notifications (recipient_email, sender_name, title, message, type)
    SELECT p_email.email, user_full_name,
           'New Account Signup Request',
           user_full_name || ' registered and requires Admin approval.',
           'approval_request'
    FROM (
      SELECT u.email
      FROM public.profiles p JOIN auth.users u ON u.id = p.id
      WHERE p.role IN ('Admin', 'Manager')
    ) p_email;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 4. Privilege-protection trigger on profiles ─────────────────────────────
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER AS $$
BEGIN
  -- Non-admin direct UPDATEs may not change role or status; force the
  -- previous values back into the row about to be written.
  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT public.is_admin(auth.uid()) THEN
    NEW.role := OLD.role;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT public.is_admin(auth.uid()) THEN
    NEW.status := OLD.status;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

-- ─── 5. Privileged role/status changes — admins only, via RPC ────────────────
CREATE OR REPLACE FUNCTION public.admin_set_profile_role(
  target_id UUID,
  new_role   TEXT,
  new_status TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only Admins or Managers may change roles/status';
  END IF;

  IF new_role IS NOT NULL AND new_role NOT IN ('Admin','Manager','Lead','Member') THEN
    RAISE EXCEPTION 'Invalid role: %', new_role;
  END IF;
  IF new_status IS NOT NULL AND new_status NOT IN ('Pending','Approved','Rejected','Suspended') THEN
    RAISE EXCEPTION 'Invalid status: %', new_status;
  END IF;

  UPDATE public.profiles
  SET role       = COALESCE(new_role, role),
      status     = COALESCE(new_status, status),
      updated_at = NOW()
  WHERE id = target_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_set_profile_role(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_profile_role(UUID, TEXT, TEXT) TO authenticated;

-- ─── 6. profiles RLS (rewritten) ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view profiles"  ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile"     ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile or admins update any" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can delete profiles"        ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- The role/status protection lives in the trigger; this gate limits which rows.
CREATE POLICY "Users update own profile, admins update any"
  ON public.profiles FOR UPDATE TO authenticated
  USING     (auth.uid() = id OR public.is_admin(auth.uid()))
  WITH CHECK(auth.uid() = id OR public.is_admin(auth.uid()));

CREATE POLICY "Only admins can delete profiles"
  ON public.profiles FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- ─── 7. tasks RLS — split per action ─────────────────────────────────────────
DROP POLICY IF EXISTS "Users can only view assigned, coassigned, created, or project tasks" ON public.tasks;

CREATE POLICY "Tasks: select own scope"
  ON public.tasks FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid()) OR
    created_by = auth.uid() OR
    assignee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM jsonb_array_elements(co_assignees) elem
      WHERE (elem->>'id')::uuid = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Tasks: approved users can create as themselves"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_approved_user(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Tasks: participants and leads can update"
  ON public.tasks FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid()) OR
    created_by = auth.uid() OR
    assignee_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'Lead') OR
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin(auth.uid()) OR
    created_by = auth.uid() OR
    assignee_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'Lead') OR
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Tasks: creator or admin can delete"
  ON public.tasks FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- ─── 8. projects RLS — tighten creator identity and admin scope ───────────────
DROP POLICY IF EXISTS "Admins, Managers, and Leads can manage projects" ON public.projects;

CREATE POLICY "Projects: approved users create as themselves"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.is_approved_user(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Projects: admins or creator can update"
  ON public.projects FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());

CREATE POLICY "Projects: admins or creator can delete"
  ON public.projects FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid());
