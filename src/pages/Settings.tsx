import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { useAuth } from '../hooks/useAuth';
import { Settings as SettingsIcon, User, Key, Shield, Check, Lock, Camera } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Link } from 'react-router-dom';

export const Settings: React.FC = () => {
  const { user, profile, userRole, userStatus } = useAuth();
  const [name, setName] = useState(profile?.full_name || user?.user_metadata?.full_name || 'Workspace User');
  const [email] = useState(user?.email || 'user@hfcl.com');
  const [password, setPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [saved, setSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const isAdminOrSuper = userRole === 'SuperAdmin' || userRole === 'Admin';

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (isSupabaseConfigured && user) {
      try {
        await supabase
          .from('profiles')
          .update({ full_name: name, avatar_url: avatarUrl })
          .eq('id', user.id);

        if (password.trim()) {
          await supabase.auth.updateUser({ password: password.trim() });
          setPassword('');
        }
      } catch (err) {
        console.error('Error updating settings:', err);
      }
    }

    setIsSubmitting(false);
    setMsg('Settings and profile updated successfully!');
    setTimeout(() => setMsg(''), 3000);
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !isSupabaseConfigured) return;

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `avatars/${user.id}_${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage.from('task-attachments').upload(filePath, file);

      if (!error && data) {
        const { data: pubData } = supabase.storage.from('task-attachments').getPublicUrl(filePath);
        setAvatarUrl(pubData.publicUrl);
      }
    } catch (err) {
      console.warn('Avatar upload fallback:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-brand-700 uppercase tracking-wider bg-brand-50 px-2 py-0.5 rounded border border-brand-200/60">
            Preferences
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-xs font-semibold text-slate-500">Account & Security</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-1">
          <SettingsIcon className="w-6 h-6 text-brand-600" />
          Settings
        </h1>
      </div>

      {msg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 font-bold">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{msg}</span>
        </div>
      )}

      {/* Account Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <User className="w-4 h-4 text-brand-600" />
            Profile Details
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Manage your display name, profile photo, and password security.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="flex items-center gap-4 pb-2">
              <Avatar src={avatarUrl} name={name} size="lg" />
              <div>
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors">
                    <Camera className="w-3.5 h-3.5 text-brand-600" />
                    Change Profile Photo
                  </span>
                  <input type="file" accept="image/*" onChange={handleAvatarFileChange} className="hidden" />
                </label>
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
                helperText="Email address tied to your HFCL account."
              />
            </div>

            <div className="pt-2 border-t border-slate-100">
              <Input
                type="password"
                label="New Security Password"
                placeholder="Leave blank to keep current password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" variant="primary" size="md" className="text-xs font-bold" isLoading={isSubmitting}>
                Save Profile Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Admin Panel Access Link */}
      {isAdminOrSuper && (
        <Card className="bg-amber-50/50 border-amber-200">
          <CardHeader>
            <CardTitle className="text-base font-bold text-amber-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-600" />
              Admin User Onboarding & Approval Panel
            </CardTitle>
            <CardDescription className="text-xs text-amber-700">
              Approve pending employee signups, manage role permissions, and handle deletion requests.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to={userRole === 'SuperAdmin' ? '/super-ctrl-sec-7x9q' : '/sys-admin-panel-k3m8'}>
              <Button variant="primary" size="sm" className="bg-amber-600 hover:bg-amber-700 border-none text-white font-bold text-xs">
                Open Admin Approval Panel →
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
