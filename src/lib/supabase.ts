import { createClient } from '@supabase/supabase-js';

// ─── Environment variables ────────────────────────────────────────────────────
// Vite statically replaces import.meta.env.* at build time.
// If either variable is missing the app throws immediately so the problem is
// obvious rather than silently falling back to a hard-coded production key.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[TaskFlow] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.\n' +
      'Copy .env.example to .env and fill in your Supabase project values.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // required for password-reset / magic-link redirects
  },
});

// Always true after the guard above — kept for any legacy callers.
export const isSupabaseConfigured = true;
