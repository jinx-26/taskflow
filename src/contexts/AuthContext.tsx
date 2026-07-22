import React, { createContext, useEffect, useState, ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, Session } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password?: string, role?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null; message?: string }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  isDemo: boolean;
}

const DEMO_USER_KEY = 'taskflow_demo_user';

export const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  resetPassword: async () => ({ error: null }),
  updatePassword: async () => ({ error: null }),
  isDemo: false,
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDemo, setIsDemo] = useState<boolean>(!isSupabaseConfigured);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      if (isSupabaseConfigured) {
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (mounted) {
            setSession(currentSession as Session | null);
            setUser((currentSession?.user as User) || null);
          }
        } catch (err) {
          console.warn('Supabase getSession warning, falling back:', err);
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (_event, currentSession) => {
            if (mounted) {
              setSession(currentSession as Session | null);
              setUser((currentSession?.user as User) || null);
              setLoading(false);
            }
          }
        );

        if (mounted) setLoading(false);

        return () => {
          subscription.unsubscribe();
        };
      } else {
        const storedDemoUser = localStorage.getItem(DEMO_USER_KEY);
        if (storedDemoUser) {
          try {
            const parsedUser = JSON.parse(storedDemoUser);
            if (mounted) {
              setUser(parsedUser);
              setSession({ user: parsedUser, access_token: 'demo-token' } as Session);
            }
          } catch (e) {
            localStorage.removeItem(DEMO_USER_KEY);
          }
        }
        if (mounted) {
          setIsDemo(true);
          setLoading(false);
        }
      }
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = async (email: string, password?: string, role?: string): Promise<{ error: Error | null }> => {
    setLoading(true);

    if (isSupabaseConfigured && password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      return { error };
    }

    // Role-based demo credentials
    const isManager = email.includes('manager');
    const isAdmin = email.includes('admin');
    const userRole = role || (isManager ? 'Manager' : isAdmin ? 'Admin' : 'Member');
    const userName = isManager ? 'Marcus Vance' : isAdmin ? 'Elena Rostova' : 'Alex Morgan';
    const userAvatar = isManager
      ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
      : isAdmin
      ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
      : 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150';

    const demoUser: User = {
      id: isManager ? 'demo-manager-456' : isAdmin ? 'demo-admin-789' : 'demo-member-123',
      email: email || (isManager ? 'marcus.vance@taskflow.io' : 'alex.morgan@taskflow.io'),
      user_metadata: {
        full_name: userName,
        avatar_url: userAvatar,
        role: userRole,
      },
    };

    setUser(demoUser);
    setSession({ user: demoUser, access_token: 'demo-token' } as Session);
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(demoUser));
    setLoading(false);
    return { error: null };
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
    localStorage.removeItem(DEMO_USER_KEY);
    setUser(null);
    setSession(null);
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
      message: 'Password reset link sent to ' + email + ' (Demo Mode)',
    };
  };

  const updatePassword = async (password: string): Promise<{ error: Error | null }> => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.updateUser({ password });
      return { error };
    }
    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        isDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
