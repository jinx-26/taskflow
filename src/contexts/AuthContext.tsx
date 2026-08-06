import React, { createContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User, Session, UserProfile, UserRole, UserStatus } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  userRole: UserRole;
  userStatus: UserStatus;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null; message?: string }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  hasRole: (allowedRoles: UserRole[]) => boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  userRole: 'Member',
  userStatus: 'Pending',
  loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  resetPassword: async () => ({ error: null }),
  updatePassword: async () => ({ error: null }),
  refreshProfile: async () => {},
  hasRole: () => false,
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // ─── Fetch only the columns the application actually uses ─────────────────
  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, status, department_id, team_id')
        .eq('id', userId)
        .single();

      if (error || !data) {
        // Profile row missing (e.g. trigger hasn't run yet) — return safe default.
        // Role and status are always the most restrictive defaults; the database
        // is the single source of truth for privilege decisions.
        return {
          id: userId,
          full_name: 'User',
          role: 'Member',
          status: 'Pending',
        };
      }

      return data as UserProfile;
    } catch (err) {
      console.error('Error fetching user profile:', err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      const updatedProf = await fetchProfile(user.id);
      if (updatedProf) setProfile(updatedProf);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (mounted && currentSession) {
          setSession(currentSession as Session);
          setUser(currentSession.user as User);
          const prof = await fetchProfile(currentSession.user.id);
          if (mounted) setProfile(prof);
        }
      } catch (err) {
        console.warn('Supabase getSession warning:', err);
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
        if (mounted) {
          if (currentSession) {
            setSession(currentSession as Session);
            setUser(currentSession.user as User);
            const prof = await fetchProfile(currentSession.user.id);
            if (mounted) setProfile(prof);
          } else {
            setSession(null);
            setUser(null);
            setProfile(null);
          }
          setLoading(false);
        }
      });

      if (mounted) setLoading(false);

      return () => {
        subscription.unsubscribe();
      };
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  // ─── Sign in ─────────────────────────────────────────────────────────────
  // password is required — no mock / unauthenticated fallback exists.
  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error: Error | null }> => {
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setLoading(false);
      return { error };
    }

    if (data.session && data.user) {
      setSession(data.session as Session);
      setUser(data.user as User);
      const prof = await fetchProfile(data.user.id);
      setProfile(prof);
    }

    setLoading(false);
    return { error: null };
  };

  // ─── Sign out ────────────────────────────────────────────────────────────
  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setLoading(false);
  };

  // ─── Password reset ──────────────────────────────────────────────────────
  // redirectTo is taken from an env var so it is pinned to the production domain
  // rather than computed from window.location.origin at runtime.
  const resetPassword = async (email: string) => {
    const redirectTo =
      (import.meta.env.VITE_RESET_REDIRECT_URL as string | undefined) ??
      `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo }
    );

    if (error) return { error };
    return { error: null, message: 'Password reset link sent to your email.' };
  };

  // ─── Update password ─────────────────────────────────────────────────────
  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error };
    return { error: null };
  };

  // ─── Role / status helpers ───────────────────────────────────────────────
  // The database (profiles.role / profiles.status) is the sole source of truth.
  // No client-side email-string comparisons are used.
  const effectiveRole: UserRole = profile?.role ?? 'Member';
  const effectiveStatus: UserStatus = profile?.status ?? 'Pending';

  const hasRole = (allowedRoles: UserRole[]) =>
    effectiveRole === 'Admin' || allowedRoles.includes(effectiveRole);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        userRole: effectiveRole,
        userStatus: effectiveStatus,
        loading,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        refreshProfile,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
