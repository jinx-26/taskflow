import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Mail, Lock, ArrowRight, AlertCircle, Shield, Briefcase, UserCheck, UserPlus, CheckCircle2 } from 'lucide-react';

export const Login: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'Manager' | 'Lead' | 'Member'>('Member');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password');
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
      // Sign Up Flow
      if (isSupabaseConfigured) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName || email.split('@')[0],
              role,
            },
          },
        });

        setIsLoading(false);
        if (signUpError) {
          setError(signUpError.message);
        } else if (data.session) {
          navigate('/dashboard');
        } else {
          setSuccessMsg(`Account created as ${role}! Please check your email to verify your account or sign in now.`);
          setMode('signin');
        }
      } else {
        // Demo Mode Sign Up
        await signIn(email, password, role);
        setIsLoading(false);
        navigate('/dashboard');
      }
    }
  };

  const handleRoleLogin = async (demoEmail: string, demoRole: string) => {
    setIsLoading(true);
    setError(null);
    await signIn(demoEmail, 'demo123456', demoRole);
    setIsLoading(false);
    navigate('/dashboard');
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
          Create Real Account
        </button>
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          {mode === 'signin' ? 'Welcome back' : 'Join TaskFlow Workspace'}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {mode === 'signin'
            ? 'Sign in to access your projects and assigned work'
            : 'Register a real account with a specific team role'}
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
              placeholder="e.g. Sarah Jenkins"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Select Your Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full bg-white text-slate-900 text-xs rounded-xl border border-slate-200 px-3 py-2.5 h-10 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 font-medium"
              >
                <option value="Manager">Manager (Project Oversight & Delivery)</option>
                <option value="Lead">Lead (Technical / Team Lead)</option>
                <option value="Member">Member (Software Engineer / Designer)</option>
              </select>
            </div>
          </>
        )}

        <Input
          label="Email Address"
          type="email"
          placeholder="sarah@yourcompany.com"
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
          {mode === 'signin' ? 'Sign In to Workspace' : `Register as ${role}`}
        </Button>
      </form>

      {/* Quick Demo Option for local preview */}
      <div className="pt-4 border-t border-slate-100 text-center space-y-3">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
          One-Click Demo Accounts (For Testing)
        </span>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs bg-purple-50/50 hover:bg-purple-100 text-purple-800 border-purple-200/80 font-semibold"
            onClick={() => handleRoleLogin('marcus.vance@taskflow.io', 'Manager')}
            isLoading={isLoading}
            leftIcon={<Briefcase className="w-3.5 h-3.5 text-purple-600" />}
          >
            👔 Manager Account
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="text-xs bg-blue-50/50 hover:bg-blue-100 text-brand-800 border-brand-200/80 font-semibold"
            onClick={() => handleRoleLogin('alex.morgan@taskflow.io', 'Member')}
            isLoading={isLoading}
            leftIcon={<UserCheck className="w-3.5 h-3.5 text-brand-600" />}
          >
            🧑‍💻 Member Account
          </Button>
        </div>
      </div>
    </div>
  );
};
