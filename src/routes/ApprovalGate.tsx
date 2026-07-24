import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ShieldAlert, Clock, Ban, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const ApprovalGate: React.FC = () => {
  const { user, profile, userStatus, signOut, refreshProfile } = useAuth();

  const isSuperAdmin = user?.email?.toLowerCase() === 'jignesh.giri2005@gmail.com' || profile?.is_superadmin;

  if (isSuperAdmin || userStatus === 'Approved') {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700/80 rounded-2xl p-6 shadow-2xl space-y-6 text-center animate-in fade-in-50">
        <div className="flex justify-center">
          {userStatus === 'Pending' && (
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
          )}
          {userStatus === 'Rejected' && (
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Ban className="w-8 h-8" />
            </div>
          )}
          {userStatus === 'Suspended' && (
            <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <ShieldAlert className="w-8 h-8" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">
            {userStatus === 'Pending' && 'Account Pending Approval'}
            {userStatus === 'Rejected' && 'Access Request Rejected'}
            {userStatus === 'Suspended' && 'Account Suspended'}
          </h2>

          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
            {userStatus === 'Pending' && (
              <>Your registration as <strong className="text-amber-400 font-semibold">{profile?.role || 'Member'}</strong> has been submitted. An Administrator or SuperAdmin must approve your account before you can access the TaskFlow workspace.</>
            )}
            {userStatus === 'Rejected' && (
              <>Your access request to the TaskFlow workspace was not approved by workspace administrators. Please contact your administrator if you believe this is an error.</>
            )}
            {userStatus === 'Suspended' && (
              <>Your account access has been temporarily suspended by an administrator. An audit reason may be under review by the SuperAdmin.</>
            )}
          </p>
        </div>

        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/50 text-left text-xs space-y-1">
          <div className="flex justify-between text-slate-400">
            <span>Signed in as:</span>
            <span className="font-semibold text-slate-200">{user?.email}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Requested Role:</span>
            <span className="font-semibold text-amber-400">{profile?.role || 'Member'}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Status:</span>
            <span className="font-semibold uppercase tracking-wider text-amber-300">{userStatus}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="outline"
            size="md"
            className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-700/50"
            onClick={refreshProfile}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Check Status
          </Button>

          <Button
            variant="danger"
            size="md"
            className="flex-1"
            onClick={signOut}
            leftIcon={<LogOut className="w-4 h-4" />}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
};
