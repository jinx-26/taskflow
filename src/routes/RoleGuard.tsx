import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../types';

interface RoleGuardProps {
  allowedRoles: UserRole[];
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles }) => {
  const { user, profile, userRole } = useAuth();

  const isSuperAdmin = user?.email?.toLowerCase() === 'jignesh.giri2005@gmail.com' || profile?.is_superadmin;

  if (isSuperAdmin || allowedRoles.includes(userRole)) {
    return <Outlet />;
  }

  // Redirect unauthorized roles back to main dashboard
  return <Navigate to="/dashboard" replace />;
};
