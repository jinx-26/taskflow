import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { useAuth } from '../hooks/useAuth';
import { Settings as SettingsIcon, User, Key, Bell, Shield, Check } from 'lucide-react';

export const Settings: React.FC = () => {
  const { user, profile, userRole, userStatus } = useAuth();
  const [name, setName] = useState(profile?.full_name || user?.user_metadata?.full_name || 'Workspace User');
  const [email] = useState(user?.email || 'user@taskflow.io');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Preferences
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-xs font-semibold text-brand-600">Account & Security</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-1">
          <SettingsIcon className="w-6 h-6 text-brand-600" />
          Settings
        </h1>
      </div>

      {saved && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Settings saved successfully!</span>
        </div>
      )}

      {/* Account Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <User className="w-4 h-4 text-brand-600" />
            Profile Details
          </CardTitle>
          <CardDescription>
            Manage your display name, role, and public workspace profile
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex items-center gap-4 pb-2">
              <Avatar
                src={user?.user_metadata?.avatar_url}
                name={name}
                size="lg"
              />
              <div>
                <Button variant="outline" size="sm" className="text-xs">
                  Change Photo
                </Button>
                <p className="text-[11px] text-slate-400 mt-1">JPG, GIF or PNG. Max 2MB.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                label="Email Address"
                value={email}
                disabled
                helperText="Email address is tied to your Supabase account authentication."
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" variant="primary" size="md" className="text-xs font-semibold">
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Supabase Security Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand-600" />
            Supabase Security & Auth
          </CardTitle>
          <CardDescription>
            Session configuration and environment integration status
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div>
              <p className="text-xs font-bold text-slate-800">Workspace Role & Status</p>
              <p className="text-[11px] text-slate-500">
                Assigned Role: <strong className="font-semibold text-purple-600">{userRole}</strong> • Account Status: <strong className="font-semibold text-emerald-600">{userStatus}</strong>
              </p>
            </div>
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Active
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
