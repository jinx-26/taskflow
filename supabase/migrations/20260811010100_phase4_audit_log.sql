-- =============================================================================
-- Phase 4: audit_log — immutable record of privileged actions
-- =============================================================================
-- WHY: approvals, role changes, suspensions and deletions previously left no
-- trace. In a corporate environment admin actions must be attributable.
--
-- Design:
--  - Append-only: INSERT policy only, no UPDATE/DELETE policies for anyone.
--  - SELECT restricted to admins.
--  - Writes happen through public.log_audit() (SECURITY DEFINER) from
--    triggers and RPCs so the actor is captured server-side from auth.uid()
--    and cannot be spoofed by the caller.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email TEXT,
  action      TEXT NOT NULL,           -- e.g. 'role_change', 'approval', 'suspension', 'deletion_approved'
  target_type TEXT NOT NULL,           -- e.g. 'profile', 'deletion_request'
  target_id   UUID,
  target_email TEXT,
  details     JSONB DEFAULT '{}'::jsonb, -- before/after values etc.
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can read the log; nobody (including admins) can update/delete it.
DROP POLICY IF EXISTS "Admins read audit log" ON public.audit_log;
CREATE POLICY "Admins read audit log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Audited inserts via function" ON public.audit_log;
CREATE POLICY "Audited inserts via function"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- ─── Server-side logging helper ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_audit(
  p_action       TEXT,
  p_target_type  TEXT,
  p_target_id    UUID DEFAULT NULL,
  p_target_email TEXT DEFAULT NULL,
  p_details      JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
DECLARE
  v_actor_email TEXT;
BEGIN
  SELECT email INTO v_actor_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.audit_log
    (actor_id, actor_email, action, target_type, target_id, target_email, details)
  VALUES
    (auth.uid(), v_actor_email, p_action, p_target_type, p_target_id, p_target_email, p_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.log_audit(TEXT, TEXT, UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit(TEXT, TEXT, UUID, TEXT, JSONB) TO authenticated;

-- ─── Wire role/status changes (admin_set_profile_role) into the log ─────────
CREATE OR REPLACE FUNCTION public.admin_set_profile_role(
  target_id UUID,
  new_role   TEXT,
  new_status TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  old_role   TEXT;
  old_status TEXT;
  t_email    TEXT;
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

  SELECT role, status INTO old_role, old_status FROM public.profiles WHERE id = target_id;
  SELECT email INTO t_email FROM auth.users WHERE id = target_id;

  UPDATE public.profiles
  SET role       = COALESCE(new_role, role),
      status     = COALESCE(new_status, status),
      updated_at = NOW()
  WHERE id = target_id;

  PERFORM public.log_audit(
    CASE
      WHEN new_status IS DISTINCT FROM old_status AND LOWER(COALESCE(new_status,'')) = 'approved' THEN 'approval'
      WHEN new_status IS DISTINCT FROM old_status AND LOWER(COALESCE(new_status,'')) = 'suspended' THEN 'suspension'
      WHEN new_role IS DISTINCT FROM old_role THEN 'role_change'
      ELSE 'profile_update'
    END,
    'profile',
    target_id,
    t_email,
    jsonb_build_object('old_role', old_role, 'new_role', new_role,
                       'old_status', old_status, 'new_status', new_status)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_set_profile_role(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_profile_role(UUID, TEXT, TEXT) TO authenticated;

-- ─── Audit deletion request decisions ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_deletion_requests()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('Approved','Rejected') THEN
    PERFORM public.log_audit(
      'deletion_' || LOWER(NEW.status),
      'deletion_request',
      NEW.id,
      NEW.target_user_email,
      jsonb_build_object('target_user_id', NEW.target_user_id, 'reason', NEW.reason)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_audit_deletion_requests ON public.deletion_requests;
CREATE TRIGGER trg_audit_deletion_requests
  AFTER UPDATE ON public.deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_deletion_requests();

-- Index for admin review screens
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor      ON public.audit_log(actor_id);
