import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { UserProfile, UserRole, UserStatus } from '../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserCheck,
  Search,
  Clock,
  Send,
  X,
} from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const { user, profile } = useAuth();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'pending' | 'active' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Deletion Request Modal State
  const [selectedUserForDeletion, setSelectedUserForDeletion] = useState<UserProfile | null>(null);
  const [deletionReason, setDeletionReason] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data as UserProfile[]);
    } catch (err: any) {
      console.error('Failed to load profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();

    const channel = supabase
      .channel('admin_panel_profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleUpdateStatus = async (targetUserId: string, newStatus: UserStatus) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', targetUserId);

      if (error) throw error;
      setActionSuccess(`User status updated to ${newStatus}`);
      fetchUsers();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update user status');
    }
  };

  const handleCreateDeletionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForDeletion || !deletionReason.trim()) {
      setActionError('Please provide a detailed reason for the deletion request.');
      return;
    }

    setIsSubmittingRequest(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      // 1. Suspend target user immediately
      await supabase
        .from('profiles')
        .update({ status: 'Suspended', updated_at: new Date().toISOString() })
        .eq('id', selectedUserForDeletion.id);

      // 2. Insert deletion request with written reason for SuperAdmin approval
      const { error: requestErr } = await supabase.from('deletion_requests').insert({
        target_user_id: selectedUserForDeletion.id,
        target_user_email: selectedUserForDeletion.full_name || selectedUserForDeletion.id,
        target_user_name: selectedUserForDeletion.full_name,
        requested_by: user?.id,
        requested_by_name: profile?.full_name || user?.email || 'Admin',
        reason: deletionReason.trim(),
        status: 'Pending',
      });

      if (requestErr) throw requestErr;

      setActionSuccess(
        `User ${selectedUserForDeletion.full_name} suspended. Deletion request submitted to SuperAdmin with your reason.`
      );
      setSelectedUserForDeletion(null);
      setDeletionReason('');
      fetchUsers();
    } catch (err: any) {
      setActionError(err.message || 'Failed to submit deletion request.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesTab =
      filterTab === 'pending'
        ? u.status === 'Pending'
        : filterTab === 'active'
        ? u.status === 'Approved'
        : true;

    const matchesSearch =
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesTab && matchesSearch;
  });

  const pendingCount = users.filter((u) => u.status === 'Pending').length;

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Administration
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold text-amber-600">
              {pendingCount} Pending Approvals
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-1">
            <Shield className="w-6 h-6 text-brand-600" />
            Workspace Admin Panel
          </h1>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setFilterTab('pending')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              filterTab === 'pending'
                ? 'bg-white text-slate-900 shadow-soft-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setFilterTab('active')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              filterTab === 'active'
                ? 'bg-white text-slate-900 shadow-soft-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
            Approved
          </button>
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              filterTab === 'all'
                ? 'bg-white text-slate-900 shadow-soft-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All Users ({users.length})
          </button>
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

      {/* User Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          placeholder="Search users by name or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-medium"
        />
      </div>

      {/* User Table Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-slate-900">
            {filterTab === 'pending'
              ? 'Pending Account Approval Queue'
              : filterTab === 'active'
              ? 'Approved Workspace Members'
              : 'All Registered Workspace Users'}
          </CardTitle>
          <CardDescription>
            Admins can approve signups or request account deletions with written justification for SuperAdmin review.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading user accounts...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No user accounts found matching this filter.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y border-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Requested Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar src={u.avatar_url} name={u.full_name} size="sm" />
                        <div>
                          <span className="font-semibold text-slate-900 block">{u.full_name}</span>
                          {u.is_superadmin && (
                            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wide">
                              Master SuperAdmin
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          u.role === 'SuperAdmin'
                            ? 'primary'
                            : u.role === 'Admin'
                            ? 'warning'
                            : u.role === 'Manager'
                            ? 'success'
                            : 'neutral'
                        }
                      >
                        {u.role}
                      </Badge>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          u.status === 'Approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : u.status === 'Pending'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : u.status === 'Suspended'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-500">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Recent'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {!u.is_superadmin && (
                        <div className="flex items-center justify-end gap-1.5">
                          {u.status === 'Pending' && (
                            <>
                              <Button
                                variant="primary"
                                size="sm"
                                className="text-[11px] bg-emerald-600 hover:bg-emerald-700 border-none"
                                onClick={() => handleUpdateStatus(u.id, 'Approved')}
                                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                className="text-[11px]"
                                onClick={() => handleUpdateStatus(u.id, 'Rejected')}
                                leftIcon={<XCircle className="w-3.5 h-3.5" />}
                              >
                                Reject
                              </Button>
                            </>
                          )}

                          {u.status === 'Approved' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[11px] text-rose-600 border-rose-200 hover:bg-rose-50"
                              onClick={() => setSelectedUserForDeletion(u)}
                            >
                              Request Deletion
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Deletion Request Modal (Admin must write reason) */}
      {selectedUserForDeletion && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Submit Account Deletion Request
              </h3>
              <button
                onClick={() => setSelectedUserForDeletion(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Admins cannot directly delete users. Submitting this request will immediately{' '}
              <strong className="text-slate-900 font-semibold">Suspend</strong> access for{' '}
              <strong className="text-brand-600">{selectedUserForDeletion.full_name}</strong> and forward your written reason to the SuperAdmin for permanent deletion approval.
            </p>

            <form onSubmit={handleCreateDeletionRequest} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Mandatory Written Reason for Deletion
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Employee requested offboarding / Policy violation details..."
                  value={deletionReason}
                  onChange={(e) => setDeletionReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-medium"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="flex-1 text-xs"
                  onClick={() => setSelectedUserForDeletion(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  size="md"
                  className="flex-1 text-xs font-semibold"
                  isLoading={isSubmittingRequest}
                  leftIcon={<Send className="w-3.5 h-3.5" />}
                >
                  Submit to SuperAdmin
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
