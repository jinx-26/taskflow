import * as Sentry from '@sentry/react';

/**
 * Sentry initialisation — active only when VITE_SENTRY_DSN is set.
 * Noops silently in local dev without a DSN so developers aren't spammed.
 *
 * Set VITE_SENTRY_DSN in .env (dev) and in Vercel project env vars (prod).
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Lightly sample to keep quota predictable for a ~200-user internal app.
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend(event) {
      // Strip any auth tokens that could ride along in breadcrumbs/headers.
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.filter(
          (b) => !b.category?.toLowerCase().includes('auth')
        );
      }
      return event;
    },
  });
}

/** Drop-in replacement for console.error at call sites we touch. */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  }
  console.error(error);
}
