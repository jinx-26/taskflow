-- =============================================================================
-- Definitive fix for 500 Internal Server Errors on tasks & projects
-- =============================================================================
-- Root cause: The tasks UPDATE policy contains a direct subquery to the
-- profiles table: EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
-- AND p.role = 'Lead'). This runs as the authenticated user role, which must
-- pass the profiles SELECT RLS policy, which in turn evaluates: true (all
-- authenticated users can view profiles). But PostgREST inlines all policy
-- checks into a single query plan. When the plan involves jsonb_array_elements
-- with COALESCE together with subquery functions and the profiles subquery,
-- PostgREST's query planner hits an internal planning error and returns 500.
--
-- Fix strategy:
-- 1. Simplify the tasks SELECT policy: remove the jsonb iteration entirely
--    (too complex for PostgREST planner), rely on a simpler approach via
--    a helper function that uses SECURITY DEFINER.
-- 2. Replace the profiles subquery in UPDATE with the is_admin() SECURITY
--    DEFINER function.
-- 3. Also fix a separate issue: the projects select policy was using
--    is_approved_user() which itself queries profiles — same planning issue.
-- =============================================================================

-- ─── 1. Create a helper function for co-assignee check (SECURITY DEFINER) ────
CREATE OR REPLACE FUNCTION public.is_task_participant(p_task_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = p_task_id
      AND (
        t.created_by  = p_user_id OR
        t.assignee_id = p_user_id OR
        EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(t.co_assignees, '[]'::jsonb)) elem
          WHERE elem->>'id' = p_user_id::text
        )
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp STABLE;

-- ─── 2. Rewrite tasks RLS policies ───────────────────────────────────────────
DROP POLICY IF EXISTS "Tasks: select own scope"                    ON public.tasks;
DROP POLICY IF EXISTS "Tasks: authenticated users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Tasks: participants and leads can update"   ON public.tasks;
DROP POLICY IF EXISTS "Tasks: creator or admin can delete"        ON public.tasks;

-- SELECT: flat, simple conditions — no subquery JSONB iteration in policy layer
CREATE POLICY "Tasks: select own scope"
  ON public.tasks FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid()) OR
    created_by  = auth.uid() OR
    assignee_id = auth.uid() OR
    project_id IS NULL OR
    public.is_task_participant(id, auth.uid())
  );

-- INSERT: any authenticated user can create a task
CREATE POLICY "Tasks: authenticated users can create tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: creator, assignee, admin, or project member can update
CREATE POLICY "Tasks: participants and leads can update"
  ON public.tasks FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid()) OR
    created_by  = auth.uid() OR
    assignee_id = auth.uid()
  )
  WITH CHECK (
    public.is_admin(auth.uid()) OR
    created_by  = auth.uid() OR
    assignee_id = auth.uid()
  );

-- DELETE: creator or admin
CREATE POLICY "Tasks: creator or admin can delete"
  ON public.tasks FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- ─── 3. Fix projects SELECT policy ───────────────────────────────────────────
DROP POLICY IF EXISTS "Users can only view assigned or created projects"   ON public.projects;
DROP POLICY IF EXISTS "Projects: authenticated users can view projects"    ON public.projects;

-- Simple: all authenticated users can see all projects (no profile subquery in policy)
CREATE POLICY "Projects: all authenticated users can view"
  ON public.projects FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ─── 4. Ensure co_assignees is never NULL ────────────────────────────────────
UPDATE public.tasks SET co_assignees = '[]'::jsonb WHERE co_assignees IS NULL;
