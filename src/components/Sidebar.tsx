import React from 'react';
import {
  Menu,
  Home,
  LogOut,
  Sliders,
  Calendar as CalendarIcon,
  BarChart3,
  Boxes,
  ClipboardList,
  Wrench,
  Cpu,
  Layers,
  FileCheck2,
  Users as UsersIcon,
  Box,
  FileText,
  ShieldAlert,
  Database,
} from 'lucide-react';

import { AppUser } from '../types/gmao';

export type ViewKey =
  | 'dashboard'
  | 'tablet'
  | 'machines'
  | 'mold-list'
  | 'intervention-request'
  | 'new-intervention-request'
  | 'maintenance-orders'
  | 'new-maintenance-order'
  | 'machine-maintenance'
  | 'mold-maintenance'
  | 'other-maintenances'
  | 'intervention-reports'
  | 'intervention-report-fill'
  | 'report-details'
  | 'stock-material'
  | 'input-material'
  | 'output-material'
  | 'material-status'
  | 'stock-magasin'
  | 'bon-livraison'
  | 'analysis-kpis'
  | 'calendar'
  | 'audit-report'
  | 'users'
  | 'ot-pdf-report'
  | 'audit-trail'
  | 'backup-restore'
  | 'ofs'
  | 'archives';

interface SidebarProps {
  currentView: ViewKey;
  onNavigate: (view: ViewKey) => void;
  isOpen: boolean;
  onToggle: () => void;
  onLogout: () => void;
  currentUser?: AppUser;
  counts?: {
    waitingRequests: number;
    waitingOrders: number;
    waitingReports: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  isOpen,
  onToggle,
  onLogout,
  currentUser,
  counts,
}) => {
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role?.toLowerCase()?.includes('admin');
  // Helper to render an interface item with identical styling, padding, and elevation as Dashboard
  const renderItem = (
    view: ViewKey,
    label: string,
    Icon: React.ComponentType<{ className?: string }> | undefined,
    isActive: boolean,
    badgeCount?: number
  ) => {
    return (
      <button
        onClick={() => onNavigate(view)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-all cursor-pointer ${isActive
          ? 'bg-white text-neutral-900 shadow-sm font-bold'
          : 'text-neutral-900 hover:text-neutral-950 hover:bg-black/10 font-medium'
          }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {Icon && <Icon className="w-5 h-5 shrink-0" />}
          <span className="text-sm tracking-tight truncate">{label}</span>
        </div>
        {badgeCount !== undefined && badgeCount > 0 && (
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${isActive
              ? 'bg-amber-100 text-amber-900 border border-amber-300'
              : 'bg-amber-200 text-amber-900'
              }`}
          >
            {badgeCount}
          </span>
        )}
      </button>
    );
  };

  // Helper to render a section label flanked by horizontal divider lines
  const renderSectionLabel = (label: string) => (
    <div className="flex items-center gap-2 px-3.5 py-1">
      <div className="h-px flex-1 bg-black/15" />
      <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider whitespace-nowrap">
        {label}
      </span>
      <div className="h-px flex-1 bg-black/15" />
    </div>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Panel */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col justify-between transition-all duration-300 select-none shadow-sm ${isOpen ? 'w-64 sm:w-72' : 'w-16'
          }`}
        style={{
          backgroundColor: '#8f9f95', // Exact sage green/slate tone from SideBar.png
          color: '#1a2420',
        }}
      >
        {/* Top Header / Hamburger row */}
        <div className="flex items-center justify-between px-4 h-16 shrink-0 border-b border-black/5">
          {isOpen ? (
            <>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-wide text-neutral-900 uppercase">
                  GMAO TPM
                </span>
              </div>
              <button
                onClick={onToggle}
                className="p-2 text-neutral-900 hover:bg-black/10 rounded-lg transition-colors cursor-pointer"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button
              onClick={onToggle}
              className="p-2 text-neutral-900 hover:bg-black/10 rounded-lg transition-colors mx-auto cursor-pointer"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Scrollable Navigation Items */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 px-2">
          {/* Dashboard Item */}
          {isOpen ? (
            renderItem('dashboard', 'Dashboard', Home, currentView === 'dashboard')
          ) : (
            <div className="flex justify-center">
              <button
                onClick={() => onNavigate('dashboard')}
                className={`p-3 rounded-xl transition-all cursor-pointer ${currentView === 'dashboard'
                  ? 'bg-white text-neutral-900 shadow-md'
                  : 'text-neutral-900 hover:bg-black/10'
                  }`}
                title="Dashboard"
              >
                <Home className="w-5 h-5" />
              </button>
            </div>
          )}


          {isOpen ? (
            <div className="space-y-4 pt-1">
              {/* SECTION: Machine & Mold */}
              <div className="space-y-1">
                {renderSectionLabel('Machine & Mold')}
                <div className="space-y-1">
                  {renderItem('machines', 'Machines', undefined, currentView === 'machines')}
                  {renderItem('mold-list', 'Mold List', undefined, currentView === 'mold-list')}
                </div>
              </div>

              {/* SECTION: Intervention Requests & Orders */}
              <div className="space-y-1">
                {renderSectionLabel('Work & Requests')}
                <div className="space-y-1">
                  {renderItem(
                    'intervention-request',
                    'Intervention Requests',
                    undefined,
                    currentView === 'intervention-request' || currentView === 'new-intervention-request',
                    counts?.waitingRequests
                  )}
                  {renderItem(
                    'archives',
                    'Archive (DI)',
                    undefined,
                    currentView === 'archives'
                  )}
                  {renderItem(
                    'maintenance-orders',
                    'Work Orders (OT)',
                    undefined,
                    currentView === 'maintenance-orders' ||
                    currentView === 'new-maintenance-order' ||
                    currentView === 'ot-pdf-report',
                    counts?.waitingOrders
                  )}
                  {renderItem(
                    'ofs',
                    'OFs (Production)',
                    undefined,
                    currentView === 'ofs'
                  )}
                  {renderItem(
                    'intervention-reports',
                    'Intervention Reports',
                    undefined,
                    currentView === 'intervention-reports' ||
                    currentView === 'intervention-report-fill' ||
                    currentView === 'report-details',
                    counts?.waitingReports
                  )}
                </div>
              </div>

              {/* SECTION: Maintenance Tracking */}
              <div className="space-y-1">
                {renderSectionLabel('Maintenance')}
                <div className="space-y-1">
                  {renderItem('machine-maintenance', 'Machine Maintenance', undefined, currentView === 'machine-maintenance')}
                  {renderItem('mold-maintenance', 'Mold Maintenance', undefined, currentView === 'mold-maintenance')}
                  {renderItem('other-maintenances', 'Other Maintenances', undefined, currentView === 'other-maintenances')}
                </div>
              </div>

              {/* SECTION: Stock Material */}
              <div className="space-y-1">
                {renderSectionLabel('Stock Material')}
                <div className="space-y-1">
                  {renderItem(
                    'stock-material',
                    'Stock Status',
                    undefined,
                    currentView === 'stock-material' || currentView === 'material-status'
                  )}
                  {renderItem('input-material', 'Stock In', undefined, currentView === 'input-material')}
                  {renderItem('output-material', 'Stock Out', undefined, currentView === 'output-material')}
                </div>
              </div>

              {/* SECTION: Stock Magasin */}
              <div className="space-y-1">
                {renderSectionLabel('Stock Magasin')}
                <div className="space-y-1">
                  {renderItem('stock-magasin', 'Stock Magasin', undefined, currentView === 'stock-magasin')}
                  {renderItem('bon-livraison', 'Bon Livraison', undefined, currentView === 'bon-livraison')}
                </div>
              </div>

              {/* SECTION: Management & Analytics */}
              <div className="space-y-1">
                {renderSectionLabel('Management & Analytics')}
                <div className="space-y-1">
                  {renderItem('analysis-kpis', 'Analysis & KPIs', undefined, currentView === 'analysis-kpis')}
                  {renderItem('calendar', 'Preventive Schedule', undefined, currentView === 'calendar')}
                  {isAdmin && renderItem('audit-trail', 'Audit & Movements', undefined, currentView === 'audit-trail')}
                  {isAdmin && renderItem('backup-restore', 'Backup & Restore', undefined, currentView === 'backup-restore')}
                  {isAdmin && renderItem('users', 'Users', undefined, currentView === 'users')}
                </div>
              </div>
            </div>
          ) : (
            /* Collapsed Icon-only vertical navigation */
            <div className="flex flex-col items-center space-y-2 pt-2">
              <button
                onClick={() => onNavigate('machines')}
                title="Machines"
                className={`p-2.5 rounded-xl transition-all cursor-pointer ${currentView === 'machines'
                  ? 'bg-white text-neutral-900 shadow-md'
                  : 'text-neutral-900 hover:bg-black/10'
                  }`}
              >
              </button>
              <button
                onClick={() => onNavigate('mold-list')}
                title="Mold List"
                className={`p-2.5 rounded-xl transition-all cursor-pointer ${currentView === 'mold-list'
                  ? 'bg-white text-neutral-900 shadow-md'
                  : 'text-neutral-900 hover:bg-black/10'
                  }`}
              >
              </button>
              <button
                onClick={() => onNavigate('intervention-request')}
                title="Intervention Requests"
                className={`p-2.5 rounded-xl transition-all cursor-pointer relative ${currentView === 'intervention-request' || currentView === 'new-intervention-request'
                  ? 'bg-white text-neutral-900 shadow-md'
                  : 'text-neutral-900 hover:bg-black/10'
                  }`}
              >
                {counts && counts.waitingRequests > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500"></span>
                )}
              </button>
              <button
                onClick={() => onNavigate('maintenance-orders')}
                title="Work Orders"
                className={`p-2.5 rounded-xl transition-all cursor-pointer relative ${currentView === 'maintenance-orders' ||
                  currentView === 'new-maintenance-order' ||
                  currentView === 'ot-pdf-report'
                  ? 'bg-white text-neutral-900 shadow-md'
                  : 'text-neutral-900 hover:bg-black/10'
                  }`}
              >
                {counts && counts.waitingOrders > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500"></span>
                )}
              </button>
              <button
                onClick={() => onNavigate('intervention-reports')}
                title="Intervention Reports"
                className={`p-2.5 rounded-xl transition-all cursor-pointer relative ${currentView === 'intervention-reports' ||
                  currentView === 'intervention-report-fill' ||
                  currentView === 'report-details'
                  ? 'bg-white text-neutral-900 shadow-md'
                  : 'text-neutral-900 hover:bg-black/10'
                  }`}
              >
                {counts && counts.waitingReports > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500"></span>
                )}
              </button>
              <button
                onClick={() => onNavigate('machine-maintenance')}
                title="Machine Maintenance"
                className={`p-2.5 rounded-xl transition-all cursor-pointer ${currentView === 'machine-maintenance'
                  ? 'bg-white text-neutral-900 shadow-md'
                  : 'text-neutral-900 hover:bg-black/10'
                  }`}
              >
              </button>
              <button
                onClick={() => onNavigate('stock-magasin')}
                title="Stock Magasin"
                className={`p-2.5 rounded-xl transition-all cursor-pointer ${currentView === 'stock-magasin'
                  ? 'bg-white text-neutral-900 shadow-md'
                  : 'text-neutral-900 hover:bg-black/10'
                  }`}
              >
              </button>
              <button
                onClick={() => onNavigate('analysis-kpis')}
                title="Analysis & KPIs"
                className={`p-2.5 rounded-xl transition-all cursor-pointer ${currentView === 'analysis-kpis'
                  ? 'bg-white text-neutral-900 shadow-md'
                  : 'text-neutral-900 hover:bg-black/10'
                  }`}
              >
              </button>
              <button
                onClick={() => onNavigate('calendar')}
                title="Calendar"
                className={`p-2.5 rounded-xl transition-all cursor-pointer ${currentView === 'calendar'
                  ? 'bg-white text-neutral-900 shadow-md'
                  : 'text-neutral-900 hover:bg-black/10'
                  }`}
              >
              </button>
              {isAdmin && (
                <button
                  onClick={() => onNavigate('audit-trail')}
                  title="Audit & Movements"
                  className={`p-2.5 rounded-xl transition-all cursor-pointer relative ${currentView === 'audit-trail'
                    ? 'bg-white text-neutral-900 shadow-md'
                    : 'text-neutral-900 hover:bg-black/10'
                    }`}
                >
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => onNavigate('backup-restore')}
                  title="Backup & Restore"
                  className={`p-2.5 rounded-xl transition-all cursor-pointer ${currentView === 'backup-restore'
                    ? 'bg-white text-neutral-900 shadow-md'
                    : 'text-neutral-900 hover:bg-black/10'
                    }`}
                >
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => onNavigate('users')}
                  title="Users"
                  className={`p-2.5 rounded-xl transition-all cursor-pointer ${currentView === 'users'
                    ? 'bg-white text-neutral-900 shadow-md'
                    : 'text-neutral-900 hover:bg-black/10'
                    }`}
                >
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};