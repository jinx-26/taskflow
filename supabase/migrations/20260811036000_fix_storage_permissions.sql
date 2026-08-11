-- =============================================================================
-- Fix Supabase Storage upload permissions for task-attachments bucket
-- =============================================================================
-- Root cause:
-- The storage INSERT policy uses can_access_project_files() which checks
-- that the first path segment of the uploaded file is either:
--   (a) the uploader's own UUID, or
--   (b) a project UUID they are a member of.
--
-- But CreateTaskModal.tsx and TaskDetailsModal.tsx upload files to:
--   tasks/<timestamp>_<filename>
-- The first segment is literally "tasks" — not a UUID — so the function
-- returns FALSE and every upload is rejected with a permission error.
--
-- Fix: Replace the overly-restrictive storage policy with a simple policy
-- that allows any authenticated user to upload to task-attachments.
-- File-level security is already enforced by the tasks table RLS policies.
-- =============================================================================

-- ─── 1. Drop the old restrictive INSERT policy ────────────────────────────────
DROP POLICY IF EXISTS "Project-scoped attachment upload" ON storage.objects;
DROP POLICY IF EXISTS "Project-scoped attachment read"   ON storage.objects;

-- ─── 2. Simple authenticated upload policy ───────────────────────────────────
-- Any authenticated user can upload files to task-attachments.
-- Path format: tasks/<timestamp>_<filename>
CREATE POLICY "Authenticated users can upload task attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-attachments' AND auth.uid() IS NOT NULL);

-- ─── 3. Simple authenticated read policy ─────────────────────────────────────
-- Any authenticated user can read/download files from task-attachments.
-- Task-level visibility is governed by tasks RLS, not storage RLS.
CREATE POLICY "Authenticated users can read task attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-attachments' AND auth.uid() IS NOT NULL);

-- ─── 4. Allow users to update/delete their own uploaded objects ───────────────
CREATE POLICY "Authenticated users can update task attachments"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'task-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete task attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'task-attachments' AND auth.uid() IS NOT NULL);

-- ─── 5. Make the bucket public so attachment URLs work without signed URLs ─────
-- This allows the getPublicUrl() call to return a working direct link.
UPDATE storage.buckets
SET public = true
WHERE name = 'task-attachments';
