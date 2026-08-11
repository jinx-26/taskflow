-- =============================================================================
-- Hardening assign_task_code trigger function
-- =============================================================================
-- Prevents "duplicate key value violates unique constraint tasks_code_unique"
-- error when older/cached frontend clients send a duplicate task code.
--
-- If NEW.code is NULL, empty, or ALREADY EXISTS in public.tasks, the trigger
-- automatically assigns the next guaranteed-unique code from public.task_code_seq.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.assign_task_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL 
     OR TRIM(NEW.code) = '' 
     OR EXISTS (SELECT 1 FROM public.tasks WHERE code = NEW.code) 
  THEN
    NEW.code := 'TSK-' || LPAD(nextval('public.task_code_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
