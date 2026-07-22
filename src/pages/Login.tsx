import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Mail, Lock, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

export const Login: React.FC = () => {
  const { signIn, isDemo } = useAuth();
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

  const handleQuickDemo = async () => {
    setIsLoading(true);
    setError(null);
    await signIn('alex.morgan@taskflow.io', 'demo123456');
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
          Enter your credentials to access your workspace
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
          placeholder="alex.morgan@taskflow.io"
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

      {/* Demo helper card */}
      <div className="pt-4 border-t border-slate-100 text-center space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Testing without Supabase keys?</span>
        </div>
        <Button
          variant="secondary"
          size="md"
          className="w-full text-xs font-semibold bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200/80"
          onClick={handleQuickDemo}
          isLoading={isLoading}
          leftIcon={<Sparkles className="w-3.5 h-3.5 text-brand-600" />}
        >
          Instant Demo Login (One-Click)
        </Button>
      </div>
    </div>
  );
};
