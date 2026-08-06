/**
 * Shared password policy constants.
 * Import from here — never use magic numbers in components.
 *
 * Min: 8 chars  — enforced in Supabase Dashboard (Auth → Providers → Email → Password strength)
 * Max: 72 chars — bcrypt silently truncates at 72 bytes; longer values waste CPU
 *                 and can be used as a DoS vector against the hash function.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export function validatePassword(pw: string): string | null {
  if (!pw) return 'Password is required.';
  if (pw.length > PASSWORD_MAX) return `Password must not exceed ${PASSWORD_MAX} characters.`;
  if (pw.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  return null;
}
