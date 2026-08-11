-- =============================================================================
-- Phase 6: indexes for the hot query paths at 100–200 users
-- =============================================================================
-- WHY: the baseline schema had only primary-key indexes. RLS policies and
-- service queries filter heavily on assignee, project, recipient and channel;
-- without these indexes every task list / notification load is a seq scan.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id           ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id            ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by            ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_not_deleted           ON public.tasks(id) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient     ON public.notifications(recipient_email);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at    ON public.notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_channel_created    ON public.messages(channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_members_user        ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user           ON public.team_members(user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_role               ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status             ON public.profiles(status);

-- Partial index to speed up the co_assignees JSONB predicate in the tasks
-- SELECT policy (expression GIN index on the id field).
CREATE INDEX IF NOT EXISTS idx_tasks_co_assignees_gin
  ON public.tasks USING GIN (co_assignees jsonb_path_ops);
