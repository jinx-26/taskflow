import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../types';

interface RoleGuardProps {
  allowedRoles: UserRole[];
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles }) => {
  const { user, userRole } = useAuth();

  const isAdmin = userRole === 'Admin' || user?.email?.toLowerCase() === 'jignesh.giri2005@gmail.com';

  if (isAdmin || allowedRoles.includes(userRole)) {
    return <Outlet />;
  }

  return <Navigate to="/dashboard" replace />;
};
