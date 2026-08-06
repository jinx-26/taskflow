import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ShieldAlert, Clock, Ban, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const ApprovalGate: React.FC = () => {
  const { userRole, userStatus, signOut, refreshProfile } = useAuth();

  // Role and status are sourced from the database profile record — no email literals.
  if (userRole === 'Admin' || userStatus === 'Approved') {
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
              <>Your registration as <strong className="text-amber-400 font-semibold">{userRole}</strong> has been submitted. An Administrator must approve your account before you can access the TaskFlow workspace.</>
            )}
            {userStatus === 'Rejected' && (
              <>Your access request to the TaskFlow workspace was not approved by workspace administrators. Please contact your administrator if you believe this is an error.</>
            )}
            {userStatus === 'Suspended' && (
              <>Your account has been temporarily suspended by an administrator.</>
            )}
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <Button
            variant="primary"
            size="md"
            onClick={() => refreshProfile()}
            className="w-full justify-center text-xs font-semibold"
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Check Approval Status
          </Button>

          <Button
            variant="outline"
            size="md"
            onClick={() => signOut()}
            className="w-full justify-center text-xs font-semibold text-slate-300 border-slate-700 hover:bg-slate-700/50"
            leftIcon={<LogOut className="w-4 h-4" />}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
};
