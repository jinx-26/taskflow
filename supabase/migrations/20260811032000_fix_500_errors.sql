-- =============================================================================
-- Fix 500 Internal Server Errors on tasks & projects
-- =============================================================================
-- Root causes:
-- 1. TASKS 500: The tasks SELECT policy references co_assignees with
--    jsonb_array_elements which throws when co_assignees is NULL (not '[]').
--    Also there are duplicate conflicting policies causing PostgREST to crash.
-- 2. PROJECTS 500: conflicting overlapping SELECT policies on projects table
--    (one from baseline, one from phase1) causing ambiguous RLS resolution.
-- =============================================================================

-- ─── 1. FIX TASKS 500 ─────────────────────────────────────────────────────────
-- Drop all existing tasks SELECT & INSERT policies (clean slate)
DROP POLICY IF EXISTS "Tasks: select own scope"                             ON public.tasks;
DROP POLICY IF EXISTS "Tasks: approved users can create as themselves"      ON public.tasks;
DROP POLICY IF EXISTS "Tasks: authenticated users can create tasks"         ON public.tasks;
DROP POLICY IF EXISTS "Users can only view assigned, coassigned, created, or project tasks" ON public.tasks;

-- Create clean, NULL-safe SELECT policy
-- Uses COALESCE to default NULL co_assignees to '[]'::jsonb before iterating
CREATE POLICY "Tasks: select own scope"
  ON public.tasks FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid()) OR
    created_by   = auth.uid() OR
    assignee_id  = auth.uid() OR
    project_id IS NULL OR
    EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(co_assignees, '[]'::jsonb)) AS elem
      WHERE elem->>'id' = auth.uid()::text
    ) OR
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid()
    )
  );

-- Create clean INSERT policy allowing any authenticated user to create a task
CREATE POLICY "Tasks: authenticated users can create tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 2. FIX PROJECTS 500 ──────────────────────────────────────────────────────
-- Drop all overlapping SELECT policies on projects
DROP POLICY IF EXISTS "Users can only view assigned or created projects" ON public.projects;
DROP POLICY IF EXISTS "Admins, Managers, and Leads can manage projects"  ON public.projects;

-- Create single clean SELECT policy: all approved authenticated users can see projects
CREATE POLICY "Projects: authenticated users can view projects"
  ON public.projects FOR SELECT TO authenticated
  USING (public.is_approved_user(auth.uid()));

-- ─── 3. ENSURE NULL-SAFE co_assignees DEFAULT ─────────────────────────────────
-- Ensure all existing rows have '[]'::jsonb instead of NULL in co_assignees
UPDATE public.tasks
SET co_assignees = '[]'::jsonb
WHERE co_assignees IS NULL;
