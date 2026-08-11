import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ShieldCheck } from 'lucide-react';

/**
 * MfaGuard — enforces a verified TOTP second factor (AAL2) for
 * privileged roles (Admin, Manager).
 *
 * Behaviour:
 *  - Non-privileged roles pass through untouched.
 *  - Privileged users at AAL2 (MFA verified this session) pass through.
 *  - Privileged users WITHOUT a TOTP factor enrolled are redirected to
 *    /settings?mfa=setup where they can enroll via the MfaSetup component.
 *  - Privileged users WITH TOTP enrolled but at AAL1 are shown a challenge
 *    form here; on success the session is upgraded to AAL2.
 *
 * NOTE: this is a UX gate — true server-side AAL enforcement can be
 * strengthened later via Supabase custom access-token hooks or by checking
 * `aal` in JWT claims within SECURITY DEFINER functions. Supabase Auth must
 * have TOTP MFA enabled in the dashboard.
 */
export const MfaGuard: React.FC = () => {
  const { userRole } = useAuth();
  const privileged = userRole === 'Admin' || userRole === 'Manager';

  const [state, setState] = useState<
    'loading' | 'allowed' | 'needs-enroll' | 'needs-challenge'
  >('loading');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!privileged) {
      setState('allowed');
      return;
    }

    let mounted = true;

    (async () => {
      const { data: aal, error: aalErr } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalErr) {
        // MFA API unavailable (older project config) — fail open with a
        // console note rather than locking admins out.
        console.warn('[MfaGuard] AAL check failed, allowing access:', aalErr);
        if (mounted) setState('allowed');
        return;
      }

      if (aal.currentLevel === 'aal2') {
        if (mounted) setState('allowed');
        return;
      }

      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.find((f) => f.status === 'verified');

      if (!mounted) return;
      if (totp) {
        setFactorId(totp.id);
        setState('needs-challenge');
      } else {
        setState('needs-enroll');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [privileged]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || code.length !== 6) return;
    setVerifying(true);
    setError(null);

    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (chErr || !challenge) {
      setVerifying(false);
      setError('Could not start MFA challenge. Try signing in again.');
      return;
    }

    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    setVerifying(false);

    if (vErr) {
      setError('Invalid code. Check your authenticator app and retry.');
      setCode('');
      return;
    }
    setState('allowed');
  };

  if (!privileged || state === 'allowed') return <Outlet />;
  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm">
        Verifying security level…
      </div>
    );
  }
  if (state === 'needs-enroll') {
    return <Navigate to="/settings?mfa=setup" replace />;
  }

  // needs-challenge
  return (
    <div className="flex items-center justify-center py-24 px-4">
      <form
        onSubmit={handleVerify}
        className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 shadow-soft space-y-4"
      >
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-brand-600" />
          <h2 className="text-sm font-bold text-slate-900">
            Two-factor verification required
          </h2>
        </div>
        <p className="text-xs text-slate-500">
          Your {userRole} account requires multi-factor authentication. Enter
          the 6-digit code from your authenticator app to continue.
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="123456"
          autoFocus
          className="w-full text-center tracking-[0.5em] text-lg font-mono border border-slate-200 rounded-xl py-2.5 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
        <button
          type="submit"
          disabled={verifying || code.length !== 6}
          className="w-full bg-brand-600 text-white text-sm font-semibold rounded-xl py-2.5 hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {verifying ? 'Verifying…' : 'Verify'}
        </button>
      </form>
    </div>
  );
};
