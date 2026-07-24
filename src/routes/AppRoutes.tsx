import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';
import { ApprovalGate } from './ApprovalGate';
import { RoleGuard } from './RoleGuard';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';

import { Login } from '../pages/Login';
import { ForgotPassword } from '../pages/ForgotPassword';
import { ResetPassword } from '../pages/ResetPassword';
import { Dashboard } from '../pages/Dashboard';
import { Projects } from '../pages/Projects';
import { Tasks } from '../pages/Tasks';
import { Teams } from '../pages/Teams';
import { Calendar } from '../pages/Calendar';
import { Notifications } from '../pages/Notifications';
import { Settings } from '../pages/Settings';
import { AdminPanel } from '../pages/AdminPanel';
import { SuperAdminPanel } from '../pages/SuperAdminPanel';
import { SuperAdminInit } from '../pages/SuperAdminInit';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Unauthenticated Routes (Login & Forgot Password) */}
      <Route element={<PublicRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>
      </Route>

      {/* Password Reset Route (Exempt from PublicRoute to allow recovery sessions) */}
      <Route element={<AuthLayout />}>
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      {/* Secret SuperAdmin Dynamic Initialization Route */}
      <Route element={<ProtectedRoute />}>
        <Route path="/super-init-key-9918a94" element={<SuperAdminInit />} />
      </Route>

      {/* Protected Main Application Routes (Requires Auth & Approval Gate) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<ApprovalGate />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings" element={<Settings />} />

            {/* Secret Obfuscated Admin Panel Route */}
            <Route element={<RoleGuard allowedRoles={['Admin', 'SuperAdmin']} />}>
              <Route path="/sys-admin-panel-k3m8" element={<AdminPanel />} />
            </Route>

            {/* Secret Obfuscated SuperAdmin Panel Route */}
            <Route element={<RoleGuard allowedRoles={['SuperAdmin']} />}>
              <Route path="/super-ctrl-sec-7x9q" element={<SuperAdminPanel />} />
            </Route>
          </Route>
        </Route>
      </Route>

      {/* Fallback Redirects */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};
