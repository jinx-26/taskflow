-- =============================================================================
-- Fix: Co-assignee acceptance RLS + add a SECURITY DEFINER function for it
-- =============================================================================
-- Root causes:
-- 1. The tasks UPDATE policy only allows creator or primary assignee to update.
--    When a user accepts a co-assignment invite, THEY update the task's
--    co_assignees column — but they are neither creator nor assignee_id.
--    The UPDATE silently succeeds (returns 200) but affects 0 rows because
--    the USING check fails. This is a PostgREST behavior: UPDATE with failing
--    RLS returns success but no rows modified.
--
-- 2. After accepting, the task is still not visible to the new co-assignee
--    because the SELECT policy checks co_assignees but the JSONB was never
--    updated (due to bug 1). Chicken-and-egg problem.
--
-- Fix: Create a SECURITY DEFINER RPC function that any authenticated user can
-- call to accept/decline their own co-assignment invitation. This function runs
-- as a superuser, bypassing the UPDATE RLS, and validates that the caller is
-- the actual invitation target before making changes.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.respond_to_task_invite(
  p_task_id   UUID,
  p_invite_id TEXT,
  p_accept    BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
  v_task          RECORD;
  v_invite        JSONB;
  v_caller_id     UUID := auth.uid();
  v_caller_profile RECORD;
  v_remaining_invites JSONB;
  v_updated_coassignees JSONB;
  v_new_log       JSONB;
  v_existing_logs JSONB;
BEGIN
  -- Validate caller is authenticated
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Fetch caller profile
  SELECT id, full_name, avatar_url, role
  INTO v_caller_profile
  FROM public.profiles
  WHERE id = v_caller_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  -- Fetch task (bypasses RLS because SECURITY DEFINER)
  SELECT id, code, co_assignees, pending_invitations, activity_log
  INTO v_task
  FROM public.tasks
  WHERE id = p_task_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task not found');
  END IF;

  -- Find the specific invitation targeting this caller
  SELECT elem INTO v_invite
  FROM jsonb_array_elements(COALESCE(v_task.pending_invitations, '[]'::jsonb)) AS elem
  WHERE (elem->>'id' = p_invite_id OR elem->>'targetUserId' = v_caller_id::text)
    AND elem->>'status' = 'Pending'
  LIMIT 1;

  -- Security check: caller must be the invite target
  IF v_invite IS NULL OR (
    v_invite->>'targetUserId' != v_caller_id::text AND
    lower(v_invite->>'targetUserEmail') != lower(v_caller_profile.full_name)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite not found or not authorized');
  END IF;

  -- Remove this invite from pending_invitations
  SELECT jsonb_agg(elem)
  INTO v_remaining_invites
  FROM jsonb_array_elements(COALESCE(v_task.pending_invitations, '[]'::jsonb)) AS elem
  WHERE elem->>'id' != p_invite_id
    AND elem->>'targetUserId' != v_caller_id::text;

  v_remaining_invites := COALESCE(v_remaining_invites, '[]'::jsonb);

  -- Build updated co_assignees list
  v_updated_coassignees := COALESCE(v_task.co_assignees, '[]'::jsonb);

  IF p_accept THEN
    -- Only add if not already a co-assignee
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_updated_coassignees) AS ca
      WHERE ca->>'id' = v_caller_id::text
    ) THEN
      v_updated_coassignees := v_updated_coassignees || jsonb_build_array(
        jsonb_build_object(
          'id',     v_caller_id::text,
          'name',   v_caller_profile.full_name,
          'avatar', COALESCE(v_caller_profile.avatar_url, ''),
          'role',   COALESCE(v_caller_profile.role, 'Member')
        )
      );
    END IF;
  END IF;

  -- Build activity log entry
  v_new_log := jsonb_build_object(
    'id',         'log-' || extract(epoch from now())::bigint::text,
    'userName',   v_caller_profile.full_name,
    'userAvatar', COALESCE(v_caller_profile.avatar_url, ''),
    'action',     CASE WHEN p_accept
                    THEN 'accepted collaboration invite and joined task as co-assignee.'
                    ELSE 'declined collaboration invite.'
                  END,
    'timestamp',  to_char(now() AT TIME ZONE 'UTC', 'HH12:MI AM')
  );

  v_existing_logs := COALESCE(v_task.activity_log, '[]'::jsonb);

  -- Apply the update (runs as SECURITY DEFINER — bypasses RLS)
  UPDATE public.tasks SET
    pending_invitations = v_remaining_invites,
    co_assignees        = v_updated_coassignees,
    activity_log        = v_new_log || v_existing_logs
  WHERE id = p_task_id;

  RETURN jsonb_build_object(
    'success',       true,
    'accepted',      p_accept,
    'taskCode',      v_task.code,
    'invitedByName', v_invite->>'invitedByName'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.respond_to_task_invite(UUID, TEXT, BOOLEAN) TO authenticated;
