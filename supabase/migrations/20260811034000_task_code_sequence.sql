-- =============================================================================
-- Atomic Task Code Generation via PostgreSQL SEQUENCE
-- Replaces frontend Math.random() with a guaranteed-unique sequential counter
-- =============================================================================

-- 1. Create a global task code sequence
--    Start at 1001 so it clears any existing TSK-1000..TSK-9999 random codes
CREATE SEQUENCE IF NOT EXISTS public.task_code_seq
  START 1001
  INCREMENT 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

-- 2. Trigger function: auto-assign code before INSERT if not provided
CREATE OR REPLACE FUNCTION public.assign_task_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR TRIM(NEW.code) = '' THEN
    NEW.code := 'TSK-' || LPAD(nextval('public.task_code_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 3. Attach trigger to tasks table (BEFORE INSERT, per-row)
DROP TRIGGER IF EXISTS trg_assign_task_code ON public.tasks;
CREATE TRIGGER trg_assign_task_code
  BEFORE INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_task_code();

-- 4. Backfill: advance the sequence above the highest existing numeric code
--    so new codes never collide with old random ones
SELECT setval(
  'public.task_code_seq',
  GREATEST(
    1001,
    COALESCE(
      (
        SELECT MAX(CAST(REGEXP_REPLACE(code, '[^0-9]', '', 'g') AS BIGINT))
        FROM public.tasks
        WHERE code ~ '^TSK-[0-9]+$'
          AND REGEXP_REPLACE(code, '[^0-9]', '', 'g') <> ''
      ),
      1000
    )
  )
);

-- 5. Add UNIQUE constraint on code column to enforce DB-level uniqueness
--    (safe to run even if constraint already exists)
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
