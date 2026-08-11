import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ShieldCheck, ShieldOff } from 'lucide-react';

/**
 * MfaSetup — TOTP enrollment panel for the Settings page.
 * Admin/Manager users are redirected here with ?mfa=setup when they lack a
 * verified factor (see routes/MfaGuard.tsx).
 */
export const MfaSetup: React.FC = () => {
  const [qr, setQr] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'enrolled' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [alreadyEnrolled, setAlreadyEnrolled] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      setAlreadyEnrolled(!!data?.totp?.some((f: { status: string }) => f.status === 'verified'));
    })();
  }, []);

  const startEnrollment = async () => {
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'TaskFlow TOTP',
    });
    setBusy(false);
    if (error || !data) {
      setStatus('error');
      setMessage(error?.message ?? 'Enrollment failed.');
      return;
    }
    setQr(data.totp.qr_code);
    setFactorId(data.id);
  };

  const confirmEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || code.length !== 6) return;
    setBusy(true);
    setMessage(null);

    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !challenge) {
      setBusy(false);
      setStatus('error');
      setMessage('Challenge failed — try again.');
      return;
    }

    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    setBusy(false);

    if (vErr) {
      setStatus('error');
      setMessage('Invalid code — check your authenticator and retry.');
      setCode('');
      return;
    }
    setStatus('enrolled');
    setAlreadyEnrolled(true);
    setQr(null);
    setFactorId(null);
  };

  if (alreadyEnrolled && status !== 'enrolled') {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
        <ShieldCheck className="w-4 h-4" />
        Two-factor authentication is enabled on this account.
      </div>
    );
  }

  return (
    <div className="space-y-3 border border-slate-200 rounded-xl p-4 bg-white">
      <div className="flex items-center gap-2">
        {status === 'enrolled' ? (
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
        ) : (
          <ShieldOff className="w-4 h-4 text-amber-500" />
        )}
        <h3 className="text-sm font-semibold text-slate-900">
          Two-Factor Authentication (TOTP)
        </h3>
      </div>

      {status === 'enrolled' ? (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
          MFA enabled successfully. You can now access privileged areas.
        </p>
      ) : !qr ? (
        <>
          <p className="text-xs text-slate-500">
            Admin and Manager accounts must enable MFA. Scan a QR code with an
            authenticator app (1Password, Authy, Google Authenticator…).
          </p>
          <button
            onClick={startEnrollment}
            disabled={busy}
            className="text-xs font-semibold bg-brand-600 text-white rounded-lg px-3 py-2 hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? 'Preparing…' : 'Set up authenticator'}
          </button>
        </>
      ) : (
        <form onSubmit={confirmEnrollment} className="space-y-3">
          <p className="text-xs text-slate-500">Scan with your authenticator app:</p>
          <img src={qr} alt="TOTP QR code" className="w-40 h-40 border rounded-lg" />
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="6-digit code"
            className="w-full border border-slate-200 rounded-lg py-2 px-3 text-center tracking-[0.4em] font-mono focus:outline-none focus:border-brand-500"
          />
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="text-xs font-semibold bg-brand-600 text-white rounded-lg px-3 py-2 hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? 'Verifying…' : 'Confirm & enable MFA'}
          </button>
        </form>
      )}

      {status === 'error' && message && (
        <p className="text-xs text-red-600">{message}</p>
      )}
    </div>
  );
};
