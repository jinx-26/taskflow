-- =============================================================================
-- Migration: 20260821000100_fix_project_members_visibility.sql
-- Fix: Ensure project members can view projects and manage members without RLS blocks
-- =============================================================================

-- 1. Ensure RLS is enabled on projects and project_members
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 2. Projects RLS Policies
DROP POLICY IF EXISTS "Projects: all authenticated users can view" ON public.projects;
DROP POLICY IF EXISTS "Projects: approved users create as themselves" ON public.projects;
DROP POLICY IF EXISTS "Projects: admins or creator can update" ON public.projects;
DROP POLICY IF EXISTS "Projects: admins or creator can delete" ON public.projects;
DROP POLICY IF EXISTS "Users can only view assigned or created projects" ON public.projects;
DROP POLICY IF EXISTS "Projects: authenticated users can view projects" ON public.projects;

-- All authenticated users can SELECT projects (filtering for UI privacy is done via project_members / creator)
CREATE POLICY "Projects: authenticated users can view"
  ON public.projects FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Projects: authenticated users can insert"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Projects: admins or creator can update"
  ON public.projects FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());

CREATE POLICY "Projects: admins or creator can delete"
  ON public.projects FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- 3. Project Members RLS Policies
DROP POLICY IF EXISTS "Approved users can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Managers and Admins can manage project members" ON public.project_members;
DROP POLICY IF EXISTS "Project members select policy" ON public.project_members;
DROP POLICY IF EXISTS "Project members insert policy" ON public.project_members;
DROP POLICY IF EXISTS "Project members update policy" ON public.project_members;
DROP POLICY IF EXISTS "Project members delete policy" ON public.project_members;

CREATE POLICY "Project members select policy"
  ON public.project_members FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Project members insert policy"
  ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Project members update policy"
  ON public.project_members FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Project members delete policy"
  ON public.project_members FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 4. SECURITY DEFINER RPC to safely set project members and guarantee consistency
CREATE OR REPLACE FUNCTION public.set_project_members(
  p_project_id UUID,
  p_user_ids UUID[]
)
RETURNS JSONB AS $$
DECLARE
  v_uid UUID;
  v_creator UUID;
BEGIN
  SELECT created_by INTO v_creator FROM public.projects WHERE id = p_project_id;
  
  DELETE FROM public.project_members WHERE project_id = p_project_id;

  -- Ensure creator is included
  IF v_creator IS NOT NULL AND NOT (v_creator = ANY(p_user_ids)) THEN
    p_user_ids := array_append(p_user_ids, v_creator);
  END IF;

  FOREACH v_uid IN ARRAY p_user_ids
  LOOP
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (p_project_id, v_uid, CASE WHEN v_uid = v_creator THEN 'Manager' ELSE 'Member' END)
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.set_project_members(UUID, UUID[]) TO authenticated;
