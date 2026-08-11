-- =============================================================================
-- Fix: Task attachment persistence for co-assignees
-- =============================================================================
-- Root causes:
-- 1. handleUploadReviewFiles in TaskDetailsModal.tsx saves attachments by
--    appending markdown links to the `description` field, then doing a direct
--    supabase.from('tasks').update({ description, activity_log }).eq('id', task.id)
--    This UPDATE runs as the authenticated user role which hits the UPDATE RLS:
--      USING (is_admin OR created_by = uid OR assignee_id = uid)
--    Co-assignees are NONE of these, so the UPDATE silently affects 0 rows.
--    File is uploaded to storage but never saved to DB → vanishes on refresh.
--
-- 2. The attachment_url / attachment_name columns are never updated in
--    TaskDetailsModal, so collaborators don't see them either.
--
-- Fix: Create a SECURITY DEFINER RPC that:
--   a) Validates the caller is a task participant (creator, assignee, co-assignee)
--   b) Appends new attachments to the task (description + attachment_url/name)
--   c) Updates activity_log
-- =============================================================================

CREATE OR REPLACE FUNCTION public.add_task_attachment(
  p_task_id       UUID,
  p_file_name     TEXT,
  p_file_url      TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_task           RECORD;
  v_caller_id      UUID := auth.uid();
  v_caller_profile RECORD;
  v_is_participant BOOLEAN;
  v_new_log        JSONB;
  v_updated_desc   TEXT;
  v_markdown_link  TEXT;
BEGIN
  -- Validate caller
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Reject blob: URLs — they are browser-session-only and useless in DB
  IF p_file_url LIKE 'blob:%' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot save blob URLs to database');
  END IF;

  -- Fetch caller profile
  SELECT id, full_name, avatar_url
  INTO v_caller_profile
  FROM public.profiles
  WHERE id = v_caller_id;

  -- Fetch task (SECURITY DEFINER bypasses RLS)
  SELECT id, code, description, activity_log, attachment_url, attachment_name
  INTO v_task
  FROM public.tasks
  WHERE id = p_task_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task not found');
  END IF;

  -- Security: verify caller is a participant (creator, assignee, or co-assignee)
  v_is_participant := public.is_task_participant(p_task_id, v_caller_id);
  IF NOT v_is_participant AND NOT public.is_admin(v_caller_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to upload files to this task');
  END IF;

  -- Build markdown attachment link to append to description
  v_markdown_link := E'\n\n📎 Attachment: [' || p_file_name || '](' || p_file_url || ')';

  v_updated_desc := COALESCE(v_task.description, '') || v_markdown_link;

  -- Build activity log entry
  v_new_log := jsonb_build_object(
    'id',         'log-' || extract(epoch from now())::bigint::text,
    'userName',   v_caller_profile.full_name,
    'userAvatar', COALESCE(v_caller_profile.avatar_url, ''),
    'action',     'uploaded file for review: "' || p_file_name || '".',
    'timestamp',  to_char(now() AT TIME ZONE 'UTC', 'HH12:MI AM')
  );

  -- Update task: description, activity_log, AND attachment_url/name columns
  -- attachment_url/name hold the LATEST attachment for quick access
  UPDATE public.tasks SET
    description     = v_updated_desc,
    activity_log    = v_new_log || COALESCE(v_task.activity_log, '[]'::jsonb),
    attachment_url  = p_file_url,
    attachment_name = p_file_name
  WHERE id = p_task_id;

  RETURN jsonb_build_object(
    'success',  true,
    'taskCode', v_task.code,
    'fileName', p_file_name,
    'fileUrl',  p_file_url
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.add_task_attachment(UUID, TEXT, TEXT) TO authenticated;
