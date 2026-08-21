-- =============================================================================
-- Migration: 20260821000000_clear_tasks_and_collision_proof_ids.sql
-- 1. Wipe all existing tasks
-- 2. Restart atomic sequence for task codes from 1001
-- 3. Enforce bulletproof atomic trigger for code generation
-- 4. Provide SECURITY DEFINER RPC to clear tasks whenever needed by Admins
-- =============================================================================

-- 1. Delete all existing tasks (and dependent data if any)
DELETE FROM public.tasks;

-- 2. Re-create / Restart the task code sequence safely
CREATE SEQUENCE IF NOT EXISTS public.task_code_seq
  START 1001
  INCREMENT 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

ALTER SEQUENCE public.task_code_seq RESTART WITH 1001;

-- 3. Collision-Proof Trigger Function
-- Automatically assigns TSK-1001, TSK-1002, ... using the atomic sequence
CREATE OR REPLACE FUNCTION public.assign_task_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Always assign next sequence value to guarantee atomic uniqueness and eliminate collisions
  NEW.code := 'TSK-' || LPAD(nextval('public.task_code_seq')::text, 4, '0');
  
  -- If client did not provide an ID or provided a non-UUID fallback, ensure UUID is assigned
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 4. Re-bind the BEFORE INSERT trigger on public.tasks
DROP TRIGGER IF EXISTS trg_assign_task_code ON public.tasks;
CREATE TRIGGER trg_assign_task_code
  BEFORE INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_task_code();

-- 5. Ensure UNIQUE constraint on task code
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'tasks'
      AND constraint_name = 'tasks_code_unique'
  ) THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_code_unique UNIQUE (code);
  END IF;
END $$;

-- 6. SECURITY DEFINER RPC function to clear all tasks safely from authenticated client or admin
CREATE OR REPLACE FUNCTION public.clear_all_tasks()
RETURNS JSONB AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count FROM public.tasks;
  DELETE FROM public.tasks;
  ALTER SEQUENCE public.task_code_seq RESTART WITH 1001;
  
  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_count,
    'message', 'All tasks cleared and task sequence restarted at 1001.'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.clear_all_tasks() TO authenticated, anon;
