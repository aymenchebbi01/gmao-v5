import React, { useState, useRef, useEffect } from 'react';
import { Menu, Plus, RotateCw, FileDown, Bell, User, ChevronDown, Check, Shield, LogOut } from 'lucide-react';
import { AppUser } from '../types/gmao';

interface TopHeaderProps {
  title: string;
  onToggleSidebar: () => void;
  onRefresh?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  onDownloadReport?: () => void;
  extraAction?: React.ReactNode;
  currentUser?: AppUser;
  onOpenUsers?: () => void;
  users?: AppUser[];
  onSwitchUser?: (user: AppUser) => void;
  onLogout?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  title,
  onToggleSidebar,
  onRefresh,
  onAdd,
  addLabel = 'Add',
  onDownloadReport,
  extraAction,
  currentUser,
  onOpenUsers,
  users = [],
  onSwitchUser,
  onLogout,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = currentUser
    ? currentUser.name
      .split(' ')
      .map((n) => n[0])
      .join('')
    : 'AC';

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-300/60 bg-[#ebeeed]/90 backdrop-blur sticky top-0 z-20">
      {/* Left: Hamburger & Page Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 -ml-1 text-neutral-800 hover:text-neutral-950 hover:bg-black/5 rounded-lg transition-colors"
          title="Toggle Navigation"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-black text-neutral-900 tracking-tight font-sans">
          {title}
        </h1>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {onDownloadReport && (
          <button
            onClick={onDownloadReport}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold rounded-xl shadow-sm transition-all transform active:scale-[0.98]"
          >
            <FileDown className="w-4 h-4" />
            <span>Download Report</span>
          </button>
        )}

        {onAdd && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-6 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-bold rounded-xl shadow-sm transition-all transform active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>{addLabel}</span>
          </button>
        )}

        {extraAction}

        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 text-neutral-700 hover:text-neutral-950 hover:bg-black/5 rounded-xl transition-transform active:rotate-180 duration-300"
            title="Refresh Data"
            aria-label="Refresh Data"
          >
            <RotateCw className="w-5 h-5" />
          </button>
        )}

        {/* User Pill & Fast Role Switcher */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 pl-3 py-1 pr-2 border-l border-neutral-300 text-xs text-neutral-600 hover:bg-black/5 rounded-xl transition-colors cursor-pointer"
            title="Switch role / user"
          >
            <div
              className="w-7 h-7 rounded-full text-white font-bold flex items-center justify-center text-xs shadow-xs"
              style={{ backgroundColor: currentUser?.avatarColor || '#2563eb' }}
            >
              {initials}
            </div>
            <div className="text-left leading-tight hidden sm:block">
              <span className="font-bold text-neutral-900 block truncate max-w-[120px]">
                {currentUser?.name || 'A. Chebbi'}
              </span>
              <span className="text-[10px] text-blue-700 font-semibold capitalize block truncate max-w-[120px]">
                {currentUser?.role || 'Admin'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
          </button>

          {/* Quick Role & User Selector Dropdown */}
          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-neutral-300 p-2 z-50 text-xs animate-in fade-in slide-in-from-top-2">


              {onLogout && (
                <div className="pt-2 mt-2 border-t border-neutral-100">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full text-left p-2 rounded-xl flex items-center gap-2 text-red-600 hover:bg-red-50 font-bold transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Se déconnecter</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
