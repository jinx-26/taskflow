import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Mail, Lock, ArrowRight, AlertCircle, Shield, Briefcase, UserCheck } from 'lucide-react';

export const Login: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setError(null);

    const { error: authError } = await signIn(email, password);

    setIsLoading(false);
    if (authError) {
      setError(authError.message || 'Failed to sign in. Please check your credentials.');
    } else {
      navigate('/dashboard');
    }
  };

  const handleRoleLogin = async (demoEmail: string, role: string) => {
    setIsLoading(true);
    setError(null);
    await signIn(demoEmail, 'demo123456', role);
    setIsLoading(false);
    navigate('/dashboard');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Welcome back
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Sign in to your TaskFlow enterprise workspace
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5 animate-in fade-in-50">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email Address"
          type="email"
          placeholder="marcus.vance@taskflow.io"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail className="w-4 h-4" />}
          autoComplete="email"
          required
        />

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            autoComplete="current-password"
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full font-semibold shadow-soft"
          isLoading={isLoading}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          Sign In to Workspace
        </Button>
      </form>

      {/* Role Quick Login Buttons */}
      <div className="pt-4 border-t border-slate-100 text-center space-y-3">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
          One-Click Demo Role Accounts
        </span>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs bg-purple-50/50 hover:bg-purple-100 text-purple-800 border-purple-200/80 font-semibold"
            onClick={() => handleRoleLogin('marcus.vance@taskflow.io', 'Manager')}
            isLoading={isLoading}
            leftIcon={<Briefcase className="w-3.5 h-3.5 text-purple-600" />}
          >
            👔 Manager Account
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="text-xs bg-blue-50/50 hover:bg-blue-100 text-brand-800 border-brand-200/80 font-semibold"
            onClick={() => handleRoleLogin('alex.morgan@taskflow.io', 'Member')}
            isLoading={isLoading}
            leftIcon={<UserCheck className="w-3.5 h-3.5 text-brand-600" />}
          >
            🧑‍💻 Member Account
          </Button>
        </div>
      </div>
    </div>
  );
};
