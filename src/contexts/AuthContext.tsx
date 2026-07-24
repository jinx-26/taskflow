import React, { createContext, useEffect, useState, ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, Session, UserProfile, UserRole, UserStatus } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  userRole: UserRole;
  userStatus: UserStatus;
  loading: boolean;
  signIn: (email: string, password?: string) => Promise<{ error: Error | null }>;
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

  // Helper to fetch user's profile record from Supabase public.profiles
  const fetchProfile = async (userId: string, userEmail?: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        // Fallback profile if row is creating asynchronously
        const isMaster = userEmail?.toLowerCase() === 'jignesh.giri2005@gmail.com';
        return {
          id: userId,
          full_name: userEmail ? userEmail.split('@')[0] : 'User',
          role: isMaster ? 'SuperAdmin' : 'Member',
          status: isMaster ? 'Approved' : 'Pending',
          is_superadmin: isMaster,
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
      const updatedProf = await fetchProfile(user.id, user.email);
      if (updatedProf) {
        setProfile(updatedProf);
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      if (isSupabaseConfigured) {
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (mounted && currentSession) {
            setSession(currentSession as Session);
            setUser(currentSession.user as User);
            const prof = await fetchProfile(currentSession.user.id, currentSession.user.email);
            if (mounted) setProfile(prof);
          }
        } catch (err) {
          console.warn('Supabase getSession warning:', err);
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (_event, currentSession) => {
            if (mounted) {
              if (currentSession) {
                setSession(currentSession as Session);
                setUser(currentSession.user as User);
                const prof = await fetchProfile(currentSession.user.id, currentSession.user.email);
                if (mounted) setProfile(prof);
              } else {
                setSession(null);
                setUser(null);
                setProfile(null);
              }
              setLoading(false);
            }
          }
        );

        if (mounted) setLoading(false);

        return () => {
          subscription.unsubscribe();
        };
      } else {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = async (email: string, password?: string): Promise<{ error: Error | null }> => {
    setLoading(true);

    if (isSupabaseConfigured && password) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setLoading(false);
        return { error };
      }

      if (data.session && data.user) {
        setSession(data.session as Session);
        setUser(data.user as User);
        const prof = await fetchProfile(data.user.id, data.user.email);
        setProfile(prof);
      }

      setLoading(false);
      return { error: null };
    }

    setLoading(false);
    return { error: new Error('Supabase is not configured or password was missing.') };
  };

  const signOut = async () => {
    setLoading(true);
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Supabase sign out error:', err);
      }
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setLoading(false);
  };

  const resetPassword = async (email: string): Promise<{ error: Error | null; message?: string }> => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      return { error };
    }
    return {
      error: null,
      message: 'Password reset instructions sent to ' + email,
    };
  };

  const updatePassword = async (password: string): Promise<{ error: Error | null }> => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.updateUser({ password });
      return { error };
    }
    return { error: null };
  };

  // Determine current active user role & status
  const isMasterUser = user?.email?.toLowerCase() === 'jignesh.giri2005@gmail.com';
  const userRole: UserRole = profile?.role || (isMasterUser ? 'SuperAdmin' : 'Member');
  const userStatus: UserStatus = profile?.status || (isMasterUser ? 'Approved' : 'Pending');

  const hasRole = (allowedRoles: UserRole[]): boolean => {
    if (userRole === 'SuperAdmin') return true;
    return allowedRoles.includes(userRole);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        userRole,
        userStatus,
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
