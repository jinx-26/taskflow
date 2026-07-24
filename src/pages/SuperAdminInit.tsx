import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { ShieldCheck, Lock, CheckCircle2, AlertCircle } from 'lucide-react';

export const SuperAdminInit: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClaimSuperAdmin = async () => {
    if (!user) {
      setError('You must be signed in to initialize SuperAdmin credentials.');
      return;
    }

    if (user.email?.toLowerCase() !== 'jignesh.giri2005@gmail.com') {
      setError('Unauthorized: Only jignesh.giri2005@gmail.com is authorized to initialize SuperAdmin privileges.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: updateErr } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: 'SuperAdmin (Jignesh Giri)',
          role: 'SuperAdmin',
          status: 'Approved',
          is_superadmin: true,
          updated_at: new Date().toISOString(),
        });

      if (updateErr) {
        throw updateErr;
      }

      await refreshProfile();
      setSuccessMsg('Master SuperAdmin privileges successfully granted and synchronized with database!');
      
      setTimeout(() => {
        navigate('/super-ctrl-sec-7x9q');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to establish SuperAdmin privileges in database.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 animate-in fade-in-50">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-lg">
            <ShieldCheck className="w-8 h-8" />
          </div>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-white tracking-tight">
            SuperAdmin Bootstrapper
          </h2>
          <p className="text-xs text-slate-400">
            Special setup portal for primary workspace owner.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-2">
          <div className="flex justify-between text-slate-400">
            <span>Authorized Email:</span>
            <span className="font-mono text-emerald-400 font-semibold">jignesh.giri2005@gmail.com</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Current Signed-in User:</span>
            <span className="font-mono text-slate-200">{user?.email || 'Not signed in'}</span>
          </div>
        </div>

        <Button
          variant="primary"
          size="lg"
          className="w-full font-bold shadow-soft"
          onClick={handleClaimSuperAdmin}
          isLoading={isLoading}
          leftIcon={<Lock className="w-4 h-4" />}
        >
          Initialize Master SuperAdmin Privileges
        </Button>
      </div>
    </div>
  );
};
