-- =============================================================================
-- Add missing attachment columns to public.tasks
-- =============================================================================
-- WHY: taskService.ts selects attachment_url and attachment_name, but these
-- columns were missing on the tasks table schema, causing 400 Bad Request.

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS attachment_name TEXT;
