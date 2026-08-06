import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../types';

interface RoleGuardProps {
  allowedRoles: UserRole[];
}

// Role is sourced exclusively from the database profile record via AuthContext.
// No email-string comparisons — the database is the single source of truth.
export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles }) => {
  const { userRole } = useAuth();

  if (allowedRoles.includes(userRole)) {
    return <Outlet />;
  }

  return <Navigate to="/dashboard" replace />;
};
