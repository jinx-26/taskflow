-- =============================================================================
-- Fix Notifications RLS: Use auth.jwt() ->> 'email' instead of querying auth.users
-- =============================================================================
-- WHY: Standard authenticated users lack SELECT privileges on auth.users directly.
-- Using auth.jwt() ->> 'email' extracts the email from the user's JWT token without permission errors.
-- Also allows recipient_email = 'all' for system-wide announcements/notifications.

DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can mark own notifications read" ON public.notifications;

CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    LOWER(recipient_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    OR LOWER(recipient_email) = 'all'
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Users can mark own notifications read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (
    LOWER(recipient_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    OR LOWER(recipient_email) = 'all'
  )
  WITH CHECK (
    LOWER(recipient_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    OR LOWER(recipient_email) = 'all'
  );
