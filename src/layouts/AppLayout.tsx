import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar';
import { TopNav } from '../components/common/TopNav';
import { cn } from '../lib/utils';

export const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Container wrapper */}
      <div
        className={cn(
          'flex-1 flex flex-col transition-all duration-300 min-w-0',
          collapsed ? 'md:pl-20' : 'md:pl-64'
        )}
      >
        {/* Top Header */}
        <TopNav
          onOpenMobileSidebar={() => setMobileOpen(true)}
          collapsed={collapsed}
        />

        {/* Scrollable Main Content Region */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
