import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { UserProfile, DeletionRequest, UserRole } from '../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import {
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  Trash2,
  CheckCircle2,
  XCircle,
  FileText,
  AlertTriangle,
  Lock,
  Key,
  Users,
} from 'lucide-react';

export const SuperAdminPanel: React.FC = () => {
  const { user } = useAuth();

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'deletion_requests' | 'admins' | 'all_users'>('deletion_requests');

  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch profiles
      const { data: profData } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profData) setProfiles(profData as UserProfile[]);

      // 2. Fetch deletion requests
      const { data: reqData } = await supabase
        .from('deletion_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (reqData) setDeletionRequests(reqData as DeletionRequest[]);
    } catch (err: any) {
      console.error('Failed to load SuperAdmin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Promote / Demote Admin
  const handleToggleAdminRole = async (targetUser: UserProfile) => {
    setActionSuccess(null);
    setActionError(null);

    const newRole: UserRole = targetUser.role === 'Admin' ? 'Member' : 'Admin';

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', targetUser.id);

      if (error) throw error;
      setActionSuccess(`Role for ${targetUser.full_name} updated to ${newRole}`);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update role');
    }
  };

  // Process Deletion Request (Approve Permanent Delete OR Reject Request)
  const handleProcessDeletionRequest = async (request: DeletionRequest, isApprove: boolean) => {
    setActionSuccess(null);
    setActionError(null);

    try {
      if (isApprove) {
        // 1. Permanently delete from profiles table
        const { error: deleteErr } = await supabase
          .from('profiles')
          .delete()
          .eq('id', request.target_user_id);

        if (deleteErr) throw deleteErr;

        // 2. Update request status to Approved
        await supabase
          .from('deletion_requests')
          .update({ status: 'Approved' })
          .eq('id', request.id);

        setActionSuccess(`User ${request.target_user_name} permanently deleted from workspace.`);
      } else {
        // Reject request -> Restore user status to Approved
        await supabase
          .from('profiles')
          .update({ status: 'Approved' })
          .eq('id', request.target_user_id);

        await supabase
          .from('deletion_requests')
          .update({ status: 'Rejected' })
          .eq('id', request.id);

        setActionSuccess(`Deletion request rejected. User ${request.target_user_name} restored to Approved.`);
      }

      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to process deletion request');
    }
  };

  // Direct Hard Delete User (SuperAdmin Exclusive Override)
  const handleDirectPermanentDelete = async (targetUser: UserProfile) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${targetUser.full_name}? This cannot be undone.`)) {
      return;
    }

    setActionSuccess(null);
    setActionError(null);

    try {
      const { error } = await supabase.from('profiles').delete().eq('id', targetUser.id);
      if (error) throw error;

      setActionSuccess(`Permanently deleted ${targetUser.full_name}`);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete user');
    }
  };

  const pendingRequests = deletionRequests.filter((r) => r.status === 'Pending');

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold text-purple-700 uppercase bg-purple-100 px-2 py-0.5 rounded border border-purple-200">
              Master Control Center
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-mono font-semibold text-slate-500">
              {user?.email}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 mt-1">
            <ShieldCheck className="w-7 h-7 text-purple-600" />
            SuperAdmin Control Center
          </h1>
        </div>

        {/* Secret Navigation Links Banner */}
        <div className="flex items-center gap-2 bg-slate-900 text-white px-3 py-2 rounded-xl text-xs">
          <Key className="w-4 h-4 text-purple-400 shrink-0" />
          <div>
            <span className="text-[10px] text-slate-400 block font-mono">Secret Master Link</span>
            <span className="font-mono text-purple-300 font-bold">/super-ctrl-sec-7x9q</span>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Mode Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('deletion_requests')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
            activeTab === 'deletion_requests'
              ? 'bg-purple-600 text-white shadow-soft'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Deletion Requests Review Queue ({pendingRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('admins')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
            activeTab === 'admins'
              ? 'bg-purple-600 text-white shadow-soft'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Manage Workspace Admins
        </button>
        <button
          onClick={() => setActiveTab('all_users')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
            activeTab === 'all_users'
              ? 'bg-purple-600 text-white shadow-soft'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          All Profiles Directory ({profiles.length})
        </button>
      </div>

      {/* Tab 1: Admin Deletion Requests Queue with Written Reasons */}
      {activeTab === 'deletion_requests' && (
        <Card className="border-purple-100">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              Admin Deletion Requests Queue
            </CardTitle>
            <CardDescription>
              Admins cannot directly delete users. Review their written reasons below to approve permanent database deletion or reject the request.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {pendingRequests.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No pending deletion requests requiring SuperAdmin approval.
              </div>
            ) : (
              pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/60">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Target User: <span className="text-rose-600">{req.target_user_name}</span> ({req.target_user_email})
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Requested by Admin: <strong>{req.requested_by_name}</strong> on{' '}
                        {new Date(req.created_at).toLocaleString()}
                      </span>
                    </div>
                    <Badge variant="warning" dot>
                      Pending SuperAdmin Review
                    </Badge>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Admin Written Reason:
                    </span>
                    <p className="text-slate-800 italic leading-relaxed">
                      &quot;{req.reason}&quot;
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs text-slate-700"
                      onClick={() => handleProcessDeletionRequest(req, false)}
                    >
                      Reject Request & Restore User
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      className="text-xs font-semibold bg-rose-600 hover:bg-rose-700"
                      onClick={() => handleProcessDeletionRequest(req, true)}
                      leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    >
                      Approve & Permanently Delete User
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Manage Admins */}
      {activeTab === 'admins' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900">
              Admin Privilege Management
            </CardTitle>
            <CardDescription>
              SuperAdmin is the exclusive authority allowed to grant or revoke Admin permissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y border-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Current Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Admin Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar src={p.avatar_url} name={p.full_name} size="sm" />
                        <div>
                          <span className="font-semibold text-slate-900 block">{p.full_name}</span>
                          {p.is_superadmin && (
                            <span className="text-[10px] font-extrabold text-purple-600 uppercase">
                              Master SuperAdmin
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <Badge variant={p.role === 'Admin' ? 'warning' : 'neutral'}>
                        {p.role}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-700">{p.status}</td>

                    <td className="py-3 px-4 text-right">
                      {!p.is_superadmin && (
                        <Button
                          variant={p.role === 'Admin' ? 'outline' : 'primary'}
                          size="sm"
                          className="text-[11px]"
                          onClick={() => handleToggleAdminRole(p)}
                          leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                        >
                          {p.role === 'Admin' ? 'Demote from Admin' : 'Promote to Admin'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Tab 3: All Profiles Directory & SuperAdmin Override Delete */}
      {activeTab === 'all_users' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900">
              Master Profiles Directory & Override Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y border-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">SuperAdmin Override Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900 block">{p.full_name}</span>
                    </td>
                    <td className="py-3 px-4"><Badge>{p.role}</Badge></td>
                    <td className="py-3 px-4 font-semibold">{p.status}</td>
                    <td className="py-3 px-4 text-right">
                      {!p.is_superadmin && (
                        <Button
                          variant="danger"
                          size="sm"
                          className="text-[11px]"
                          onClick={() => handleDirectPermanentDelete(p)}
                          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                        >
                          Direct Permanent Delete
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
