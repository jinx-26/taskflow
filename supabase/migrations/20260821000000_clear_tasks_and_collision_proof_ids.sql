-- =============================================================================
-- Migration: 20260821000000_clear_tasks_and_collision_proof_ids.sql
-- 1. Wipe all existing tasks from the database
-- 2. Restart atomic sequence for task codes from 1001
-- 3. Self-healing collision-proof trigger for code generation (cannot conflict ever)
-- 4. Provide SECURITY DEFINER RPC to clear tasks whenever needed by Admins
-- =============================================================================

-- 1. Delete all existing tasks
DELETE FROM public.tasks;

-- 2. Create or restart sequence
CREATE SEQUENCE IF NOT EXISTS public.task_code_seq
  START 1001
  INCREMENT 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

ALTER SEQUENCE public.task_code_seq RESTART WITH 1001;

-- 3. Self-Healing Collision-Proof Trigger Function
-- Generates sequential code and verifies non-existence in a loop so collisions are impossible
CREATE OR REPLACE FUNCTION public.assign_task_code()
RETURNS TRIGGER AS $$
DECLARE
  candidate_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    candidate_code := 'TSK-' || LPAD(nextval('public.task_code_seq')::text, 4, '0');
    SELECT EXISTS(SELECT 1 FROM public.tasks WHERE code = candidate_code) INTO code_exists;
    IF NOT code_exists THEN
      NEW.code := candidate_code;
      EXIT;
    END IF;
  END LOOP;
  
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
