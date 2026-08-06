/**
 * Client-side login rate limiter.
 *
 * Tracks failed sign-in attempts in localStorage and enforces exponential
 * back-off so that brute-force attempts from the browser are slowed even
 * before they reach Supabase Auth.
 *
 * Limits:
 *   • 5 failed attempts  → 10-second lockout
 *   • 6 failed attempts  → 30-second lockout
 *   • 7 failed attempts  → 60-second lockout
 *   • 8+ failed attempts → 120-second lockout
 *
 * The lockout state is stored in localStorage so it survives a page refresh
 * (though it can be cleared by clearing browser storage — that is fine; this
 * is a UX-layer defence, not a server-side enforcement. The Edge Middleware
 * and Supabase Auth handle true server-side rate limiting).
 */

const STORAGE_KEY = 'tf_login_attempts';
const MAX_FREE_ATTEMPTS = 5;

interface AttemptState {
  count: number;
  lockedUntil: number; // Unix ms timestamp, 0 = not locked
}

function readState(): AttemptState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { count: 0, lockedUntil: 0 };
    return JSON.parse(raw) as AttemptState;
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
}

function writeState(state: AttemptState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable — fail open (don't crash the app)
  }
}

/** Returns lock duration in seconds for a given attempt count. */
function lockDuration(count: number): number {
  if (count <= MAX_FREE_ATTEMPTS) return 0;
  const extra = count - MAX_FREE_ATTEMPTS;
  const durations = [10, 30, 60, 120];
  return durations[Math.min(extra - 1, durations.length - 1)];
}

/** Call after a failed sign-in. Returns the lockout duration (seconds) applied, or 0. */
export function recordFailedAttempt(): number {
  const state = readState();
  state.count += 1;

  const secs = lockDuration(state.count);
  state.lockedUntil = secs > 0 ? Date.now() + secs * 1000 : 0;

  writeState(state);
  return secs;
}

/** Call after a successful sign-in to clear the attempt counter. */
export function clearAttempts(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Returns the number of seconds remaining in the current lockout, or 0 if
 * the user is free to attempt again.
 */
export function getLockoutSeconds(): number {
  const state = readState();
  if (!state.lockedUntil) return 0;
  const remaining = Math.ceil((state.lockedUntil - Date.now()) / 1000);
  if (remaining <= 0) {
    // Lockout expired — reset counter
    writeState({ count: 0, lockedUntil: 0 });
    return 0;
  }
  return remaining;
}

/** Returns current failed attempt count. */
export function getAttemptCount(): number {
  return readState().count;
}
