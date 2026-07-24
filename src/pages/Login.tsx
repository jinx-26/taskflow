import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Mail, Lock, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { UserRole } from '../types';

export const Login: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('Member');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email address and password');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    if (mode === 'signin') {
      const { error: authError } = await signIn(email, password);
      setIsLoading(false);
      if (authError) {
        setError(authError.message || 'Failed to sign in. Please check your credentials.');
      } else {
        navigate('/dashboard');
      }
    } else {
      // Production Supabase Sign Up Flow
      if (isSupabaseConfigured) {
        const userEmail = email.trim().toLowerCase();
        const userFullName = fullName.trim() || userEmail.split('@')[0];

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: userEmail,
          password,
          options: {
            data: {
              full_name: userFullName,
              role,
            },
          },
        });

        if (signUpError) {
          setIsLoading(false);
          if (signUpError.message.toLowerCase().includes('rate limit')) {
            setError(
              'Supabase Email Rate Limit Reached. Disable "Confirm email" in Supabase Dashboard (Auth -> Providers -> Email) to allow instant signups without email throttling.'
            );
          } else {
            setError(signUpError.message);
          }
          return;
        }

        const isSuperAdmin = userEmail === 'jignesh.giri2005@gmail.com';

        // Direct profile upsert fallback
        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            full_name: userFullName,
            role: isSuperAdmin ? 'SuperAdmin' : role,
            status: isSuperAdmin ? 'Approved' : 'Pending',
            is_superadmin: isSuperAdmin,
            updated_at: new Date().toISOString(),
          });

          // Insert real-time notification request for SuperAdmin & Admins
          if (!isSuperAdmin) {
            await supabase.from('notifications').insert({
              recipient_email: 'jignesh.giri2005@gmail.com',
              sender_name: userFullName,
              title: 'New Account Approval Request',
              message: `${userFullName} registered as ${role} and is awaiting Admin approval.`,
              type: 'approval_request',
            });
          }
        }

        setIsLoading(false);

        if (isSuperAdmin) {
          setSuccessMsg('Master SuperAdmin registered and approved successfully! You can now sign in.');
        } else {
          setSuccessMsg(`Registration submitted for ${userFullName} as ${role}! An approval request has been sent to Administrators. You can sign in once an Admin approves your account.`);
        }
        setMode('signin');
      } else {
        setError('Supabase is not configured. Unable to complete registration.');
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Switch Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => { setMode('signin'); setError(null); setSuccessMsg(null); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            mode === 'signin'
              ? 'bg-white text-slate-900 shadow-soft-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => { setMode('signup'); setError(null); setSuccessMsg(null); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            mode === 'signup'
              ? 'bg-white text-slate-900 shadow-soft-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Create Account
        </button>
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          {mode === 'signin' ? 'Welcome back' : 'Join TaskFlow Workspace'}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {mode === 'signin'
            ? 'Sign in to access your projects and assigned tasks'
            : 'Register a new account (Sends approval request to Admin)'}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5 animate-in fade-in-50">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5 animate-in fade-in-50">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <>
            <Input
              label="Full Name"
              placeholder="e.g. Alex Morgan"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Workspace Role (Requires Approval)
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full bg-white text-slate-900 text-xs rounded-xl border border-slate-200 px-3 py-2.5 h-10 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 font-medium"
              >
                <option value="Manager">Manager (Project & Team Management)</option>
                <option value="Lead">Lead (Technical Lead)</option>
                <option value="Member">Member (Software Engineer / Team Member)</option>
                <option value="Viewer">Viewer (Read-Only Access)</option>
              </select>
            </div>
          </>
        )}

        <Input
          label="Email Address"
          type="email"
          placeholder="your.email@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail className="w-4 h-4" />}
          autoComplete="email"
          required
        />

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Password
            </label>
            {mode === 'signin' && (
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <Input
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            autoComplete="current-password"
            required
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full font-semibold shadow-soft"
          isLoading={isLoading}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          {mode === 'signin' ? 'Sign In to Workspace' : `Submit Registration Request (${role})`}
        </Button>
      </form>
    </div>
  );
};
