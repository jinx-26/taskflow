import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { UserProfile, UserRole, UserStatus } from '../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Input } from '../components/ui/Input';
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
  Trash2,
  Check,
} from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const { user, profile } = useAuth();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'pending' | 'active' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

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
      setUsers((data || []) as UserProfile[]);
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

    // Optimistic UI update
    setUsers((prev) =>
      prev.map((u) => (u.id === targetUserId ? { ...u, status: newStatus } : u))
    );

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', targetUserId)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error('Supabase RLS blocked the status update. Please ensure schema script was executed in SQL Editor.');
      }

      setActionSuccess(`User status updated to ${newStatus}`);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update user status');
      fetchUsers(); // Rollback to server state
    }
  };

  const handleUpdateRole = async (targetUserId: string, newRole: UserRole) => {
    setActionError(null);
    setActionSuccess(null);

    // Optimistic UI update
    setUsers((prev) =>
      prev.map((u) => (u.id === targetUserId ? { ...u, role: newRole } : u))
    );

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', targetUserId)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error('Supabase RLS blocked the role update.');
      }

      setActionSuccess(`User role updated to ${newRole}`);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update user role');
      fetchUsers(); // Rollback
    }
  };

  const handleDeleteUser = async (targetUserId: string, targetName: string) => {
    if (!window.confirm(`Are you sure you want to delete user "${targetName}"?`)) return;

    setActionError(null);
    setActionSuccess(null);

    // Optimistic UI update
    setUsers((prev) => prev.filter((u) => u.id !== targetUserId));

    try {
      const { error } = await supabase.from('profiles').delete().eq('id', targetUserId);
      if (error) throw error;

      setActionSuccess(`Deleted user profile for ${targetName}`);
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete user profile');
      fetchUsers();
    }
  };

  const pendingUsers = users.filter((u) => u.status === 'Pending');
  const activeUsers = users.filter((u) => u.status === 'Approved');

  const displayedUsers = users.filter((u) => {
    if (filterTab === 'pending' && u.status !== 'Pending') return false;
    if (filterTab === 'active' && u.status !== 'Approved') return false;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchName = u.full_name.toLowerCase().includes(query);
      const matchRole = u.role.toLowerCase().includes(query);
      if (!matchName && !matchRole) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl animate-in fade-in-50 duration-200">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
              HFCL Administration
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold text-slate-500">Master Control</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-1">
            <Shield className="w-6 h-6 text-amber-600" />
            Admin User Onboarding & Access Control
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="warning">{pendingUsers.length} Pending Signups</Badge>
          <Badge variant="primary">{activeUsers.length} Active Employees</Badge>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)}>✕</button>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-50 text-rose-800 rounded-xl text-xs font-bold border border-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)}>✕</button>
        </div>
      )}

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-soft-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setFilterTab('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              filterTab === 'pending'
                ? 'bg-amber-600 text-white border-amber-600 shadow-soft-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Pending Signups ({pendingUsers.length})
          </button>
          <button
            onClick={() => setFilterTab('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              filterTab === 'active'
                ? 'bg-amber-600 text-white border-amber-600 shadow-soft-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Active Employees ({activeUsers.length})
          </button>
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              filterTab === 'all'
                ? 'bg-amber-600 text-white border-amber-600 shadow-soft-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Accounts ({users.length})
          </button>
        </div>

        <div className="w-full sm:w-72">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search employee name or role..."
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>
      </div>

      {/* Users Table */}
      <Card className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase bg-slate-50/50">
              <th className="p-3">Employee</th>
              <th className="p-3">Assigned Role</th>
              <th className="p-3">Approval Status</th>
              <th className="p-3">Registered Date</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400">
                  No employee profiles match the selected filter tab.
                </td>
              </tr>
            ) : (
              displayedUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.full_name} src={u.avatar_url} size="sm" />
                      <div>
                        <span className="font-bold text-slate-900 block">{u.full_name}</span>
                        <span className="text-[10px] text-slate-400">{u.id}</span>
                      </div>
                    </div>
                  </td>

                  <td className="p-3">
                    <select
                      value={u.role}
                      onChange={(e) => handleUpdateRole(u.id, e.target.value as UserRole)}
                      className="rounded-lg border border-slate-200 p-1 text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="Admin">Admin</option>
                      <option value="Manager">Manager</option>
                      <option value="Lead">Lead</option>
                      <option value="Member">Member</option>
                    </select>
                  </td>

                  <td className="p-3">
                    <Badge
                      variant={
                        u.status === 'Approved'
                          ? 'primary'
                          : u.status === 'Pending'
                          ? 'warning'
                          : 'neutral'
                      }
                    >
                      {u.status}
                    </Badge>
                  </td>

                  <td className="p-3 text-slate-500">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Recent'}
                  </td>

                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {u.status === 'Pending' && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs border-none"
                            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                            onClick={() => handleUpdateStatus(u.id, 'Approved')}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-rose-600 hover:bg-rose-50 font-semibold text-xs border-rose-200"
                            leftIcon={<XCircle className="w-3.5 h-3.5" />}
                            onClick={() => handleUpdateStatus(u.id, 'Rejected')}
                          >
                            Reject
                          </Button>
                        </>
                      )}

                      {u.status === 'Approved' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-amber-700 hover:bg-amber-50 text-xs"
                          onClick={() => handleUpdateStatus(u.id, 'Suspended')}
                        >
                          Suspend
                        </Button>
                      )}

                      {u.status === 'Suspended' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-emerald-700 hover:bg-emerald-50 text-xs"
                          onClick={() => handleUpdateStatus(u.id, 'Approved')}
                        >
                          Unsuspend
                        </Button>
                      )}

                      <button
                        onClick={() => handleDeleteUser(u.id, u.full_name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete User Profile"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
