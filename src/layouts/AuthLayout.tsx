import React from 'react';
import { Outlet } from 'react-router-dom';
import { Layers, ShieldCheck } from 'lucide-react';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 relative flex flex-col justify-center items-center p-4 sm:p-6 overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-brand-100/50 via-slate-50/20 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="relative w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-500 flex items-center justify-center text-white font-extrabold shadow-soft-lg">
            <Layers className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            TaskFlow
          </h1>
          <p className="text-xs text-slate-500 font-medium max-w-xs">
            Enterprise project workspace & task orchestration engine
          </p>
        </div>

        {/* Auth Content Card */}
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-soft-lg p-6 sm:p-8">
          <Outlet />
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Protected by Supabase Auth & 256-bit SSL</span>
        </div>
      </div>
    </div>
  );
};
