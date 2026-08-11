import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { MfaSetup } from '../components/common/MfaSetup';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { useAuth } from '../hooks/useAuth';
import { Settings as SettingsIcon, User, Shield, Check, Lock, Camera, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { PASSWORD_MIN, PASSWORD_MAX } from '../lib/passwordPolicy';

// ─── Avatar upload policy ─────────────────────────────────────────────────────
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB — enforced in code, not just UI text
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export const Settings: React.FC = () => {
  const { user, profile, userRole } = useAuth();
  const [name, setName] = useState(profile?.full_name || user?.user_metadata?.full_name || 'Workspace User');
  const [email] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');

  const isAdmin = userRole === 'Admin';

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg(text);
    setMsgType(type);
    if (type === 'success') setTimeout(() => setMsg(''), 3500);
  };

  // ─── Save profile & optional password ─────────────────────────────────────
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    setMsg('');

    // Password validation — only if the user typed something
    if (password) {
      if (password.length < PASSWORD_MIN) {
        showMsg(`Password must be at least ${PASSWORD_MIN} characters.`, 'error');
        setIsSubmitting(false);
        return;
      }
      if (password.length > PASSWORD_MAX) {
        showMsg(`Password must not exceed ${PASSWORD_MAX} characters.`, 'error');
        setIsSubmitting(false);
        return;
      }
      if (password !== confirmPassword) {
        showMsg('Passwords do not match.', 'error');
        setIsSubmitting(false);
        return;
      }

      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) {
        showMsg(`Failed to update password: ${pwErr.message}`, 'error');
        setIsSubmitting(false);
        return;
      }
      setPassword('');
      setConfirmPassword('');
    }

    // Profile row update
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ full_name: name.trim(), avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    setIsSubmitting(false);
    if (profileErr) {
      showMsg('Failed to save profile changes.', 'error');
    } else {
      showMsg('Settings and profile updated successfully!');
    }
  };

  // ─── Avatar upload — validated MIME type, size cap, signed URL ────────────
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate MIME type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      showMsg('Only JPG, PNG, GIF, or WebP images are allowed.', 'error');
      return;
    }
    // Validate file size
    if (file.size > MAX_AVATAR_BYTES) {
      showMsg('Image must be smaller than 2 MB.', 'error');
      return;
    }

    // Derive extension from MIME type (not filename) to prevent extension spoofing
    const safeExt = MIME_TO_EXT[file.type];
    const filePath = `avatars/${user.id}_${Date.now()}.${safeExt}`;

    try {
      const { data, error } = await supabase.storage
        .from('task-attachments')
        .upload(filePath, file, { contentType: file.type, upsert: true });

      if (error) {
        showMsg('Failed to upload avatar. Please try again.', 'error');
        return;
      }

      if (data) {
        // Bucket is private — use a signed URL (7-day expiry is fine for avatars)
        const { data: signedData, error: signErr } = await supabase.storage
          .from('task-attachments')
          .createSignedUrl(filePath, 60 * 60 * 24 * 7);

        if (!signErr && signedData) {
          setAvatarUrl(signedData.signedUrl);
        }
      }
    } catch (err) {
      console.warn('Avatar upload error:', err);
      showMsg('Avatar upload failed.', 'error');
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
          <span className="text-xs font-semibold text-slate-500">Account &amp; Security</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-1">
          <SettingsIcon className="w-6 h-6 text-brand-600" />
          Settings
        </h1>
      </div>

      {msg && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 font-bold border ${
            msgType === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {msgType === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          ) : (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
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
            {/* Avatar */}
            <div className="flex items-center gap-4 pb-2">
              <Avatar src={avatarUrl} name={name} size="lg" />
              <div>
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors">
                    <Camera className="w-3.5 h-3.5 text-brand-600" />
                    Change Profile Photo
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                  />
                </label>
                <p className="text-[11px] text-slate-400 mt-1">JPG, PNG, GIF or WebP. Max 2 MB.</p>
              </div>
            </div>

            {/* Name & Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
              <Input
                label="Email Address"
                value={email}
                disabled
                helperText="Email address is managed by your workspace administrator."
              />
            </div>

            {/* Password change */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Change Password — leave blank to keep current
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="password"
                  label="New Password"
                  placeholder={`${PASSWORD_MIN}–${PASSWORD_MAX} characters`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
                  maxLength={PASSWORD_MAX}
                  autoComplete="new-password"
                />
                <Input
                  type="password"
                  label="Confirm New Password"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
                  maxLength={PASSWORD_MAX}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" variant="primary" size="md" className="text-xs font-bold" isLoading={isSubmitting}>
                Save Profile Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Multi-factor authentication enrollment (required for Admin/Manager) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900">
            Two-Factor Authentication
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MfaSetup />
        </CardContent>
      </Card>

      {/* Admin Panel Access Link */}
      {isAdmin && (
        <Card className="bg-amber-50/50 border-amber-200">
          <CardHeader>
            <CardTitle className="text-base font-bold text-amber-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-600" />
              Admin User Onboarding &amp; Approval Panel
            </CardTitle>
            <CardDescription className="text-xs text-amber-700">
              Approve pending employee signups, manage role permissions, and handle deletion requests.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/sys-admin-panel-k3m8">
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
