import React, { useState, useMemo } from 'react';
import { AppUser, UserRole } from '../types/gmao';
import {
  Users,
  UserCheck,
  UserX,
  Shield,
  Search,
  Plus,
  Edit2,
  CheckCircle2,
  AlertCircle,
  X,
  Phone,
  Mail,
  Building2,
  Clock,
  KeyRound,
  ShieldCheck,
  Check,
  Info,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';

interface UsersViewProps {
  users: AppUser[];
  onAddUser: (user: AppUser) => void;
  onUpdateUser: (user: AppUser) => void;
  onToggleStatus: (userId: string) => void;
  onDeleteUser?: (userId: string) => void;
  currentUser: AppUser;
  onSwitchCurrentUser: (user: AppUser) => void;
}

export const ROLE_CONFIG: Record<
  UserRole,
  {
    label: string;
    badgeBg: string;
    badgeText: string;
    border: string;
    description: string;
  }
> = {
  admin: {
    label: 'Admin',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-900',
    border: 'border-blue-300',
    description: 'Full system privileges, user administration, security audit, database configuration.',
  },
  'responsable technique': {
    label: 'Responsable Technique',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-900',
    border: 'border-purple-300',
    description: 'Technical direction, major tooling/mold approvals, equipment commissioning, engineering CapEx.',
  },
  'responsable maintenance': {
    label: 'Responsable Maintenance',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-900',
    border: 'border-emerald-300',
    description: 'GMAO supervision, OT work order approvals, technician assignment, spare parts safety stock signoff.',
  },
  'responsable production': {
    label: 'Responsable Production',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-900',
    border: 'border-orange-300',
    description: 'Injection shopfloor supervision, line breakdown declaration (IR), TRS/OEE tracking, mold changeover scheduling.',
  },
  technician: {
    label: 'Technician',
    badgeBg: 'bg-cyan-100',
    badgeText: 'text-cyan-900',
    border: 'border-cyan-300',
    description: 'Shopfloor mechanical, electrical, and hydraulic execution, filling intervention reports, stock parts deduction.',
  },
  'methode maintenance': {
    label: 'Méthode Maintenance',
    badgeBg: 'bg-fuchsia-100',
    badgeText: 'text-fuchsia-900',
    border: 'border-fuchsia-300',
    description: 'Reliability engineering, preventive maintenance planning, FMEA/AMDEC analysis, lubrication schedules.',
  },
  qhse: {
    label: 'QHSE',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-900',
    border: 'border-green-300',
    description: 'Quality, Health, Safety & Environment, LOTO lockout compliance, hazardous material management, safety audits.',
  },
};

export const UsersView: React.FC<UsersViewProps> = ({
  users,
  onAddUser,
  onUpdateUser,
  onToggleStatus,
  onDeleteUser,
  currentUser,
  onSwitchCurrentUser,
}) => {
  const isAdmin = currentUser.role === 'admin' || currentUser.role?.toLowerCase()?.includes('admin');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | 'All'>('All');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('technician');
  const [department, setDepartment] = useState('Service Maintenance Usine');
  const [shift, setShift] = useState<AppUser['shift']>('Shift 1 (Morning)');
  const [specialty, setSpecialty] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q) ||
        (u.specialty && u.specialty.toLowerCase().includes(q));

      const matchRole = selectedRole === 'All' || u.role === selectedRole;
      return matchSearch && matchRole;
    });
  }, [users, searchQuery, selectedRole]);

  const activeCount = users.filter((u) => u.status === 'Active').length;
  const inactiveCount = users.length - activeCount;

  const handleOpenAddForm = () => {
    setEditingUserId(null);
    setName('');
    setUsername('');
    setPassword('');
    setShowPassword(false);
    setEmail('');
    setPhone('+216 ');
    setRole('technician');
    setDepartment('Service Maintenance Usine');
    setShift('Shift 1 (Morning)');
    setSpecialty('');
    setStatus('Active');
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (user: AppUser) => {
    setEditingUserId(user.id);
    setName(user.name);
    setUsername(user.username);
    setPassword(user.password || '');
    setShowPassword(false);
    setEmail(user.email);
    setPhone(user.phone);
    setRole(user.role);
    setDepartment(user.department);
    setShift(user.shift);
    setSpecialty(user.specialty || '');
    setStatus(user.status);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingUserId(null);
    setPassword('');
    setShowPassword(false);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !username) return;

    if (editingUserId) {
      const existing = users.find((u) => u.id === editingUserId);
      if (existing) {
        onUpdateUser({
          ...existing,
          name,
          username,
          password: password ? password : existing.password,
          email,
          phone,
          role,
          department,
          shift,
          specialty,
          status,
        });
      }
    } else {
      const newUser: AppUser = {
        id: `usr-${Date.now()}`,
        name,
        username,
        password: password.trim() ? password.trim() : undefined,
        email,
        phone,
        role,
        department,
        shift,
        specialty,
        status,
        lastLogin: 'Never logged in',
        avatarColor: ROLE_CONFIG[role].badgeText.includes('blue')
          ? '#2563eb'
          : ROLE_CONFIG[role].badgeText.includes('purple')
          ? '#7c3aed'
          : ROLE_CONFIG[role].badgeText.includes('orange')
          ? '#ea580c'
          : '#059669',
      };
      onAddUser(newUser);
    }

    handleCloseForm();
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Banner: Active User Switcher / Simulator */}
      <div className="bg-white rounded-3xl p-5 border border-neutral-300 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-xs"
            style={{ backgroundColor: currentUser.avatarColor || '#2563eb' }}
          >
            {currentUser.name
              .split(' ')
              .map((n) => n[0])
              .join('')}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-tight">
                Active Session
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                  ROLE_CONFIG[currentUser.role]?.badgeBg
                } ${ROLE_CONFIG[currentUser.role]?.badgeText} ${
                  ROLE_CONFIG[currentUser.role]?.border
                }`}
              >
                {ROLE_CONFIG[currentUser.role]?.label}
              </span>
            </div>
            <h2 className="text-lg font-black text-neutral-900">{currentUser.name}</h2>
            <p className="text-xs text-neutral-500">
              {currentUser.department} · {currentUser.email}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-neutral-600">Simulate Role:</span>
          <select
            value={currentUser.id}
            onChange={(e) => {
              const selected = users.find((u) => u.id === e.target.value);
              if (selected) onSwitchCurrentUser(selected);
            }}
            className="bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-xl px-3 py-1.5 text-xs font-bold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {ROLE_CONFIG[u.role]?.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Header & Add User Action */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-neutral-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Personnel & Access Management</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Manage plant personnel credentials, user roles, department assignments, and system status
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={isFormOpen ? handleCloseForm : handleOpenAddForm}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
              isFormOpen
                ? 'bg-neutral-800 text-white hover:bg-neutral-900'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isFormOpen ? (
              <>
                <X className="w-4 h-4" />
                <span>Close Form</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Add New User</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* INLINE ADD / EDIT FORM (ZERO-POPUP) */}
      {isFormOpen && (
        <div className="bg-white rounded-3xl p-6 border border-neutral-300 shadow-xs animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between border-b pb-4 mb-4">
            <div>
              <h3 className="text-lg font-black text-neutral-900">
                {editingUserId ? 'Edit Plant User Profile' : 'Register New GMAO User'}
              </h3>
              <p className="text-xs text-neutral-500">
                Configure identity, system role, department assignment, and work shift
              </p>
            </div>
            <button
              onClick={handleCloseForm}
              className="p-1.5 text-neutral-500 hover:text-neutral-900 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Karim Trabelsi"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ktrabelsi"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-neutral-700 uppercase flex items-center gap-1">
                    <KeyRound className="w-3 h-3 text-blue-600" />
                    <span>Password</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={editingUserId ? '•••••••• (leave blank to keep)' : 'Enter password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-neutral-500 mt-1">
                  {editingUserId ? 'Leave blank to preserve current' : 'Account login credential'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@thermoplastics-tunisia.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                  System Role (7 Standard Roles)
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-sm font-bold text-neutral-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="admin">admin (Administrateur)</option>
                  <option value="responsable technique">responsable technique</option>
                  <option value="responsable maintenance">responsable maintenance</option>
                  <option value="responsable production">responsable production</option>
                  <option value="technician">technician (Technicien)</option>
                  <option value="methode maintenance">methode maintenance</option>
                  <option value="qhse">qhse (Qualité Sécurité)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                  Department
                </label>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Service Maintenance Usine"
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                  Shift Assignment
                </label>
                <select
                  value={shift}
                  onChange={(e) => setShift(e.target.value as AppUser['shift'])}
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="Shift 1 (Morning)">Shift 1 (Morning 06:00 - 14:00)</option>
                  <option value="Shift 2 (Evening)">Shift 2 (Evening 14:00 - 22:00)</option>
                  <option value="Shift 3 (Night)">Shift 3 (Night 22:00 - 06:00)</option>
                  <option value="General (Day)">General (Day 08:00 - 17:00)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+216 XX XXX XXX"
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                  Technical Specialty / Responsibilities
                </label>
                <input
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="e.g. Engel Hydraulics, Injection Mold Maintenance, LOTO safety"
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                  Account Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="Active">Active (Permitted to log in)</option>
                  <option value="Inactive">Inactive (Suspended)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={handleCloseForm}
                className="px-5 py-2 rounded-xl text-neutral-700 hover:bg-neutral-100 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
              >
                {editingUserId ? 'Save User Changes' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* USERS DIRECTORY */}
      <div className="space-y-4">
          {/* Search & Role Filters */}
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
            <div className="relative max-w-md w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, username, email, specialty..."
                className="w-full pl-10 pr-4 py-2 bg-white rounded-xl text-sm font-medium border border-neutral-300 shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  'All',
                  'admin',
                  'responsable technique',
                  'responsable maintenance',
                  'responsable production',
                  'technician',
                  'methode maintenance',
                  'qhse',
                ] as const
              ).map((r) => {
                const isSelected = selectedRole === r;
                return (
                  <button
                    key={r}
                    onClick={() => setSelectedRole(r)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border ${
                      isSelected
                        ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                        : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                    }`}
                  >
                    {r === 'All' ? 'All Roles' : ROLE_CONFIG[r]?.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-[#ebeeed] rounded-3xl border border-neutral-400/80 shadow-xs overflow-hidden flex flex-col justify-between min-h-[500px]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-300 text-sm font-bold text-neutral-900 bg-black/5">
                    <th className="py-4 px-5">User</th>
                    <th className="py-4 px-4">Role</th>
                    <th className="py-4 px-5">Department & Specialty</th>
                    <th className="py-4 px-4">Shift</th>
                    <th className="py-4 px-4">Status</th>
                    <th className="py-4 px-4">Last Login</th>
                    <th className="py-4 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-300/70 text-sm font-medium text-neutral-800">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-neutral-500">
                        No users found matching the query.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const roleConfig = ROLE_CONFIG[u.role] || ROLE_CONFIG.technician;
                      const isCurrent = currentUser.id === u.id;

                      return (
                        <tr key={u.id} className="hover:bg-white/40 transition-colors">
                          <td className="py-3.5 px-5 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-xs"
                                style={{ backgroundColor: u.avatarColor || '#2563eb' }}
                              >
                                {u.name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')}
                              </div>
                              <div>
                                <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                                  <span>{u.name}</span>
                                  {isCurrent && (
                                    <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full font-bold">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-neutral-500 font-mono flex items-center gap-1.5 flex-wrap">
                                  <span>@{u.username}</span>
                                  <span>·</span>
                                  <span>{u.email}</span>
                                  {u.password ? (
                                    <span
                                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200"
                                      title="Password configured"
                                    >
                                      <KeyRound className="w-2.5 h-2.5" />
                                      <span>Password set</span>
                                    </span>
                                  ) : (
                                    <span
                                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200"
                                      title="No password required"
                                    >
                                      <KeyRound className="w-2.5 h-2.5" />
                                      <span>No password</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${roleConfig.badgeBg} ${roleConfig.badgeText} ${roleConfig.border}`}
                            >
                              {roleConfig.label}
                            </span>
                          </td>

                          <td className="py-3.5 px-5 max-w-xs">
                            <div className="font-semibold text-neutral-900 truncate">
                              {u.department}
                            </div>
                            <div className="text-xs text-neutral-500 truncate mt-0.5">
                              {u.specialty || 'General technical duties'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="text-xs font-medium text-neutral-700 bg-white/70 px-2 py-0.5 rounded-lg border border-neutral-200">
                              {u.shift}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <button
                              onClick={() => onToggleStatus(u.id)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                                u.status === 'Active'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                                  : 'bg-red-100 text-red-800 border border-red-300 hover:bg-red-200'
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  u.status === 'Active' ? 'bg-emerald-600' : 'bg-red-600'
                                }`}
                              />
                              <span>{u.status}</span>
                            </button>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-neutral-600">
                            {u.lastLogin}
                          </td>

                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => onSwitchCurrentUser(u)}
                                className="px-2.5 py-1 bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-bold rounded-lg border border-neutral-300 transition-colors shadow-xs"
                                title="Switch session to this user"
                              >
                                Switch
                              </button>
                              <button
                                onClick={() => handleOpenEditForm(u)}
                                className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-xs"
                                title="Edit User"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => setUserToDelete(u)}
                                  disabled={u.id === currentUser.id}
                                  className={`p-1.5 rounded-lg transition-colors shadow-xs ${
                                    u.id === currentUser.id
                                      ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                                      : 'bg-red-600 hover:bg-red-700 text-white'
                                  }`}
                                  title={u.id === currentUser.id ? 'Cannot delete current logged-in user' : 'Delete User'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom info bar */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-neutral-300 text-xs font-bold text-neutral-800 bg-white/40 rounded-b-3xl">
              <div>
                Total Registered Personnel: <span className="font-mono text-neutral-900">{users.length}</span> (Active: {activeCount}, Inactive: {inactiveCount})
              </div>
              <div className="text-neutral-500">
                Thermoplastics Tunisia · Identity & Access Management (IAM)
              </div>
            </div>
          </div>
        </div>

      {/* DELETE CONFIRMATION MODAL */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center font-bold">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-neutral-900">Delete User</h3>
                <p className="text-xs text-neutral-500">This action is permanent and cannot be undone.</p>
              </div>
            </div>

            <p className="text-sm text-neutral-700">
              Are you sure you want to permanently delete user <strong className="text-neutral-900">{userToDelete.name}</strong> ({userToDelete.username})?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl text-neutral-700 hover:bg-neutral-100 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteUser && userToDelete) {
                    onDeleteUser(userToDelete.id);
                  }
                  setUserToDelete(null);
                }}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
