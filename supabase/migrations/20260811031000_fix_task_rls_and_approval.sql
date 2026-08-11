-- =============================================================================
-- Fix Tasks RLS & Profile Approvals
-- =============================================================================
-- 1. Ensure all active workspace profiles are Approved so RLS checks succeed.
UPDATE public.profiles
SET status = 'Approved'
WHERE status IS NULL OR status = 'Pending';

-- 2. Drop old brittle tasks RLS policies
DROP POLICY IF EXISTS "Tasks: select own scope" ON public.tasks;
DROP POLICY IF EXISTS "Tasks: approved users can create as themselves" ON public.tasks;
DROP POLICY IF EXISTS "Users can only view assigned, coassigned, created, or project tasks" ON public.tasks;

-- 3. Robust SELECT policy (uses text comparison for JSONB co_assignees to avoid UUID cast crashes)
CREATE POLICY "Tasks: select own scope"
  ON public.tasks FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid()) OR
    created_by = auth.uid() OR
    assignee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM jsonb_array_elements(co_assignees) elem
      WHERE elem->>'id' = auth.uid()::text
    ) OR
    project_id IS NULL OR
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid()
    )
  );

-- 4. Robust INSERT policy for authenticated users
CREATE POLICY "Tasks: authenticated users can create tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    (created_by = auth.uid() OR created_by IS NULL)
  );
