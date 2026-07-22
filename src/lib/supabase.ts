import { createClient } from '@supabase/supabase-js';

// Safe environment variable reader for Vite frontend
const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};

const supabaseUrl: string =
  metaEnv.VITE_SUPABASE_URL ||
  metaEnv.NEXT_PUBLIC_SUPABASE_URL ||
  'https://zabzwsdvbgzjlkfszxhn.supabase.co';

const supabaseAnonKey: string =
  metaEnv.VITE_SUPABASE_ANON_KEY ||
  metaEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_74Qt2BwujAigJl2cHE2gzw_8KgRbEcn';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-supabase-project')
);
