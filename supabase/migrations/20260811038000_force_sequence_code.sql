-- =============================================================================
-- Always enforce sequence-generated task code on INSERT
-- =============================================================================
-- Guaranteed fix: Ignore whatever `code` string any client (old or new) sends
-- during INSERT. The DB trigger ALWAYS assigns `TSK-<sequence_number>`.
-- This completely eliminates duplicate key violations on `tasks_code_unique`.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.assign_task_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Always override code with guaranteed sequential sequence value
  NEW.code := 'TSK-' || LPAD(nextval('public.task_code_seq')::text, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
