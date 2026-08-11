import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { supabase } from '../lib/supabase';
import { Mail, Lock, ArrowRight, AlertCircle, CheckCircle2, User, ShieldAlert } from 'lucide-react';
import {
  recordFailedAttempt,
  clearAttempts,
  getLockoutSeconds,
} from '../lib/rateLimiter';
import { PASSWORD_MIN, PASSWORD_MAX } from '../lib/passwordPolicy';
import { Turnstile } from '@marsidev/react-turnstile';

// Cloudflare Turnstile — enabled when a site key is configured AND when
// "Captcha protection" is turned on in the Supabase dashboard
// (Authentication → Attack Protection). If either side is missing the app
// behaves as before (no captcha), leaving the choice env-driven.
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

// Allowed roles a new user can request — Admin is never available here.
const ALLOWED_ROLES = ['Manager', 'Lead', 'Member'] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

export const Login: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AllowedRole>('Member');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ─── Turnstile CAPTCHA token (cleared after every attempt so it refreshes) ──
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // ─── Honeypot ─────────────────────────────────────────────────────────────
  // Hidden field — legitimate users never type in it; bots fill it automatically.
  const [honeypot, setHoneypot] = useState('');

  // ─── Client-side lockout countdown ───────────────────────────────────────
  const [lockoutSecs, setLockoutSecs] = useState(getLockoutSeconds);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (lockoutSecs > 0) {
      timerRef.current = setInterval(() => {
        const remaining = getLockoutSeconds();
        setLockoutSecs(remaining);
        if (remaining <= 0 && timerRef.current) {
          clearInterval(timerRef.current);
        }
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lockoutSecs]);

  // ─── Password strength display ───────────────────────────────────────────
  const passwordStrength = (() => {
    if (!password || mode === 'signin') return null;
    const len = password.length;
    if (len < PASSWORD_MIN) return { label: 'Too short', color: 'text-red-500', pct: 20 };
    if (len < 12) return { label: 'Weak', color: 'text-orange-500', pct: 40 };
    if (len < 16) return { label: 'Fair', color: 'text-yellow-500', pct: 60 };
    if (len < 24) return { label: 'Good', color: 'text-emerald-500', pct: 80 };
    return { label: 'Strong', color: 'text-emerald-600', pct: 100 };
  })();

  // ─── Validation ───────────────────────────────────────────────────────────
  const validatePassword = (pw: string, isSignUp: boolean): string | null => {
    if (!pw) return 'Password is required.';
    if (pw.length > PASSWORD_MAX)
      return `Password must not exceed ${PASSWORD_MAX} characters.`;
    if (isSignUp && pw.length < PASSWORD_MIN)
      return `Password must be at least ${PASSWORD_MIN} characters.`;
    return null;
  };

  // ─── Submit handler ───────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot check — if filled, silently pretend success to confuse bots.
    if (honeypot) {
      setSuccessMsg('Registration submitted! An admin will review your request.');
      return;
    }

    // Client-side lockout guard.
    const remaining = getLockoutSeconds();
    if (remaining > 0) {
      setError(`Too many failed attempts. Please wait ${remaining} seconds.`);
      return;
    }

    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    const pwError = validatePassword(password, mode === 'signup');
    if (pwError) { setError(pwError); return; }

    // CAPTCHA required when configured — block before hitting Supabase.
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError('Please complete the CAPTCHA verification.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    // ── Sign in ──────────────────────────────────────────────────────────
    if (mode === 'signin') {
      const { error: authError } = await signIn(email, password, captchaToken ?? undefined);
      setCaptchaToken(null);
      setIsLoading(false);

      if (authError) {
        console.error('[SignIn Error]', authError);
        const secs = recordFailedAttempt();
        setLockoutSecs(secs);

        if (authError.message.toLowerCase().includes('email not confirmed')) {
          setError('Your email address has not been confirmed. Please check your inbox.');
        } else if (authError.message.toLowerCase().includes('captcha')) {
          setError(`CAPTCHA Error: ${authError.message}`);
        } else {
          setError(authError.message || 'Invalid email or password. Please try again.');
        }
      } else {
        clearAttempts();
        navigate('/dashboard');
      }

    // ── Sign up ──────────────────────────────────────────────────────────
    } else {
      const userEmail = email.trim().toLowerCase();
      const userFullName = fullName.trim() || userEmail.split('@')[0];

      // Role is NOT sent in signUp options — the database trigger always assigns
      // 'Member' / 'Pending' regardless of client metadata.
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: userEmail,
        password,
        options: {
          data: { full_name: userFullName },
          captchaToken: captchaToken ?? undefined,
        },
      });
      setCaptchaToken(null);

      if (signUpError) {
        setIsLoading(false);
        if (signUpError.message.toLowerCase().includes('rate limit')) {
          setError('Too many registration attempts. Please try again in a few minutes.');
        } else {
          setError(signUpError.message);
        }
        return;
      }

      // Upsert the profile row — role and status are always the safe defaults.
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: userFullName,
          role: 'Member',    // server / trigger decides final role
          status: 'Pending', // always pending until an Admin approves
          updated_at: new Date().toISOString(),
        });

        // Notify admin via the notifications table (no hardcoded email in code —
        // the query is addressed by recipient_role so the DB resolves the admin).
        await supabase.from('notifications').insert({
          sender_name: userFullName,
          title: 'New Account Approval Request',
          message: `${userFullName} has registered and is awaiting Admin approval.`,
          type: 'approval_request',
        });
      }

      setIsLoading(false);
      setSuccessMsg(
        `Registration submitted for ${userFullName}! ` +
          'An approval request has been sent to the Administrators. ' +
          'You can sign in once an Admin approves your account.'
      );
      setMode('signin');
    }
  };

  const switchMode = (next: 'signin' | 'signup') => {
    setMode(next);
    setError(null);
    setSuccessMsg(null);
    setPassword('');
  };

  const isLocked = lockoutSecs > 0;

  return (
    <div className="space-y-6">
      {/* Mode Switch Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => switchMode('signin')}
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
          onClick={() => switchMode('signup')}
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

      {/* Lockout warning */}
      {isLocked && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5 animate-in fade-in-50">
          <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <span>
            Too many failed attempts. Please wait{' '}
            <strong>{lockoutSecs}s</strong> before trying again.
          </span>
        </div>
      )}

      {error && !isLocked && (
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
        {/* Honeypot — hidden from real users, bots fill it */}
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ display: 'none' }}
        />

        {mode === 'signup' && (
          <>
            <Input
              label="Full Name"
              placeholder="e.g. Alex Morgan"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
              required
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Workspace Role (Requires Approval)
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AllowedRole)}
                className="w-full bg-white text-slate-900 text-xs rounded-xl border border-slate-200 px-3 py-2.5 h-10 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 font-medium"
              >
                <option value="Manager">Manager (Project &amp; Team Management)</option>
                <option value="Lead">Lead (Technical Lead)</option>
                <option value="Member">Engineer (Software Engineer / Team Member)</option>
              </select>
              <p className="text-[11px] text-slate-400">
                Your actual role is assigned by an Administrator after approval.
              </p>
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
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            maxLength={PASSWORD_MAX}
            required
          />

          {/* Password length hint */}
          {mode === 'signup' && (
            <div className="space-y-1 pt-0.5">
              {passwordStrength && (
                <>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-medium ${passwordStrength.color}`}>
                      {passwordStrength.label}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {password.length} / {PASSWORD_MAX}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        passwordStrength.pct <= 20
                          ? 'bg-red-400'
                          : passwordStrength.pct <= 40
                          ? 'bg-orange-400'
                          : passwordStrength.pct <= 60
                          ? 'bg-yellow-400'
                          : 'bg-emerald-400'
                      }`}
                      style={{ width: `${passwordStrength.pct}%` }}
                    />
                  </div>
                </>
              )}
              <p className="text-[11px] text-slate-400">
                {PASSWORD_MIN}–{PASSWORD_MAX} characters.
              </p>
            </div>
          )}
        </div>

        {TURNSTILE_SITE_KEY && (
          <div className="flex justify-center pt-1">
            <Turnstile
              siteKey={TURNSTILE_SITE_KEY}
              onSuccess={(token) => setCaptchaToken(token)}
              onExpire={() => setCaptchaToken(null)}
              onError={() => setCaptchaToken(null)}
              options={{ theme: 'light' }}
            />
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full font-semibold shadow-soft"
          isLoading={isLoading}
          disabled={isLocked || isLoading}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          {isLocked
            ? `Locked — wait ${lockoutSecs}s`
            : mode === 'signin'
            ? 'Sign In to Workspace'
            : `Submit Registration Request (${role === 'Member' ? 'Engineer' : role})`}
        </Button>
      </form>
    </div>
  );
};
