import React, { useState, useEffect, useMemo } from 'react';
import {
  AuditLogEntry,
  AuditCategory,
  AuditAction,
  AppUser,
} from '../types/gmao';
import {
  getAuditLogs,
  resetAuditLogsToSeed,
  exportAuditLogsToCSV,
} from '../lib/auditLogger';
import { exportToXLSX } from '../lib/exportUtils';
import {
  ShieldAlert,
  Search,
  Filter,
  Download,
  FileSpreadsheet,
  FileCode,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Calendar,
  Layers,
  Wrench,
  Boxes,
  Send,
  FileText,
  Truck,
  Users,
  Database,
  ArrowRight,
  Clock,
  Activity,
  Check,
  X,
  ChevronDown,
} from 'lucide-react';
import { PaginationBar } from '../components/PaginationBar';

interface AuditTrailViewProps {
  currentUser?: AppUser;
  onRefresh?: () => void;
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({
  currentUser,
  onRefresh,
}) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AuditCategory | 'All'>('All');
  const [selectedAction, setSelectedAction] = useState<AuditAction | 'All'>('All');
  const [selectedSeverity, setSelectedSeverity] = useState<'All' | 'info' | 'success' | 'warning' | 'danger'>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [selectedLogForDetails, setSelectedLogForDetails] = useState<AuditLogEntry | null>(null);

  // Load audit logs and subscribe to real-time custom event
  const refreshLogs = () => {
    setLogs(getAuditLogs());
  };

  useEffect(() => {
    refreshLogs();

    const handleMovement = () => {
      refreshLogs();
    };

    window.addEventListener('gmao_audit_movement', handleMovement);
    return () => window.removeEventListener('gmao_audit_movement', handleMovement);
  }, []);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Category filter
      if (selectedCategory !== 'All' && log.category !== selectedCategory) {
        return false;
      }
      // Action filter
      if (selectedAction !== 'All' && log.action !== selectedAction) {
        return false;
      }
      // Severity filter
      if (selectedSeverity !== 'All' && log.severity !== selectedSeverity) {
        return false;
      }
      // Date filters
      if (startDate && log.timestamp.slice(0, 10) < startDate) {
        return false;
      }
      if (endDate && log.timestamp.slice(0, 10) > endDate) {
        return false;
      }
      // Search text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTarget = log.targetRef?.toLowerCase().includes(q);
        const matchesUser = log.user?.toLowerCase().includes(q);
        const matchesDetails = log.details?.toLowerCase().includes(q);
        const matchesReason = log.rejectionReason?.toLowerCase().includes(q);
        const matchesAction = log.action?.toLowerCase().includes(q);
        const matchesCat = log.category?.toLowerCase().includes(q);
        if (
          !matchesTarget &&
          !matchesUser &&
          !matchesDetails &&
          !matchesReason &&
          !matchesAction &&
          !matchesCat
        ) {
          return false;
        }
      }
      return true;
    });
  }, [logs, selectedCategory, selectedAction, selectedSeverity, startDate, endDate, searchQuery]);

  // Paginated items
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // KPI Metrics
  const totalCount = logs.length;
  const validationCount = logs.filter((l) => l.action === 'VALIDATE').length;
  const rejectionCount = logs.filter((l) => l.action === 'REJECT').length;
  const stockMovementsCount = logs.filter((l) => l.action === 'STOCK_IN' || l.action === 'STOCK_OUT').length;
  const criticalCount = logs.filter((l) => l.severity === 'danger' || l.severity === 'warning').length;

  const handleReset = () => {
    if (window.confirm('Reset audit log history to initial factory seed events?')) {
      resetAuditLogsToSeed();
      refreshLogs();
    }
  };

  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GMAO_Audit_Log_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    const data = filteredLogs.map((l) => ({
      Timestamp: l.timestamp.replace('T', ' ').slice(0, 19),
      Category: l.category,
      Action: l.action,
      'Target Reference': l.targetRef,
      'User & Role': l.user,
      Severity: l.severity.toUpperCase(),
      Details: l.details,
      'Rejection Reason': l.rejectionReason || '-',
      'Previous State': l.previousState || '-',
      'New State': l.newState || '-',
    }));
    exportToXLSX(data, `GMAO_Audit_Trail_${new Date().toISOString().slice(0, 10)}.xlsx`, 'Audit Trail');
  };

  // Helper for Category badge with icon
  const getCategoryBadge = (category: AuditCategory) => {
    switch (category) {
      case 'Intervention Request':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200">
            <Send className="w-3 h-3 text-blue-700" />
            <span>IR Ticket</span>
          </span>
        );
      case 'Maintenance Order':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-100 text-purple-900 border border-purple-200">
            <Wrench className="w-3 h-3 text-purple-700" />
            <span>Work Order (OT)</span>
          </span>
        );
      case 'Intervention Report':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
            <FileText className="w-3 h-3 text-indigo-700" />
            <span>Report (PV)</span>
          </span>
        );
      case 'Machine Fleet':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
            <Activity className="w-3 h-3 text-slate-700" />
            <span>Machine</span>
          </span>
        );
      case 'Mold Tooling':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-violet-100 text-violet-900 border border-violet-200">
            <Layers className="w-3 h-3 text-violet-700" />
            <span>Mold</span>
          </span>
        );
      case 'Stock Material':
      case 'Stock Magasin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <Boxes className="w-3 h-3 text-amber-700" />
            <span>{category === 'Stock Material' ? 'Raw Resin' : 'Spare Part'}</span>
          </span>
        );
      case 'Delivery Note':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-100 text-teal-900 border border-teal-200">
            <Truck className="w-3 h-3 text-teal-700" />
            <span>Delivery Note</span>
          </span>
        );
      case 'System Backup':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            <Database className="w-3 h-3 text-emerald-700" />
            <span>Backup / System</span>
          </span>
        );
      case 'Users & IAM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-900 border border-rose-200">
            <Users className="w-3 h-3 text-rose-700" />
            <span>User / IAM</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-neutral-100 text-neutral-800 border border-neutral-300">
            <span>{category}</span>
          </span>
        );
    }
  };

  // Helper for Action badge
  const getActionBadge = (action: AuditAction) => {
    switch (action) {
      case 'CREATE':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200">
            Create
          </span>
        );
      case 'VALIDATE':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-300">
            Validate
          </span>
        );
      case 'REJECT':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-red-100 text-red-900 border border-red-300">
            Reject
          </span>
        );
      case 'STATUS_CHANGE':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-amber-50 text-amber-900 border border-amber-300">
            Status
          </span>
        );
      case 'STOCK_IN':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-300">
            Stock In
          </span>
        );
      case 'STOCK_OUT':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-orange-50 text-orange-800 border border-orange-300">
            Stock Out
          </span>
        );
      case 'BACKUP_CREATE':
      case 'BACKUP_RESTORE':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-400">
            {action === 'BACKUP_CREATE' ? 'Backup' : 'Restore'}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-neutral-100 text-neutral-800 border border-neutral-300">
            {action}
          </span>
        );
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-neutral-300/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-neutral-900 text-white rounded-2xl flex items-center justify-center font-bold shadow-xs">
              <ShieldAlert className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-neutral-900 tracking-tight">
                  Journal d'Audit &amp; Traçabilité (Activity &amp; Movement Log)
                </h2>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Logging Active
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Every ticket creation, validation, rejection with reason, status transition, stock movement, and backup is recorded.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-neutral-50 text-neutral-800 rounded-xl text-xs font-bold border border-neutral-300 shadow-2xs transition-all cursor-pointer"
            title="Download formatted Excel spreadsheet"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Excel (.xlsx)</span>
          </button>

          <button
            onClick={() => exportAuditLogsToCSV(filteredLogs)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-neutral-50 text-neutral-800 rounded-xl text-xs font-bold border border-neutral-300 shadow-2xs transition-all cursor-pointer"
            title="Download CSV export"
          >
            <Download className="w-4 h-4 text-blue-700" />
            <span>CSV</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-neutral-50 text-neutral-800 rounded-xl text-xs font-bold border border-neutral-300 shadow-2xs transition-all cursor-pointer"
            title="Export JSON payload"
          >
            <FileCode className="w-4 h-4 text-amber-700" />
            <span>JSON</span>
          </button>

          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-2 text-neutral-600 hover:text-red-700 hover:bg-red-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Reset to factory seed events"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-neutral-300/80 shadow-2xs">
          <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
            Total Movements
          </div>
          <div className="text-2xl font-black text-neutral-900 mt-1 font-mono tabular-nums">
            {totalCount}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5">Recorded in session</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-300/80 shadow-2xs">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Validations</span>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1 font-mono tabular-nums">
            {validationCount}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5">Approved steps</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-300/80 shadow-2xs">
          <div className="text-[11px] font-bold text-red-700 uppercase tracking-wider flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" />
            <span>Rejections</span>
          </div>
          <div className="text-2xl font-black text-red-700 mt-1 font-mono tabular-nums">
            {rejectionCount}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5">With mandatory reasons</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-300/80 shadow-2xs">
          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
            <Boxes className="w-3.5 h-3.5" />
            <span>Stock In / Out</span>
          </div>
          <div className="text-2xl font-black text-amber-800 mt-1 font-mono tabular-nums">
            {stockMovementsCount}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5">Inventory flows</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-300/80 shadow-2xs col-span-2 sm:col-span-1">
          <div className="text-[11px] font-bold text-orange-700 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Alerts &amp; Critical</span>
          </div>
          <div className="text-2xl font-black text-orange-700 mt-1 font-mono tabular-nums">
            {criticalCount}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5">Breakdowns &amp; issues</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-neutral-300 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by ticket ref (IR, OT), user name, reason, or details..."
              className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-semibold text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-xs font-bold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Date pickers */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1 bg-neutral-50 px-2.5 py-1.5 rounded-xl border border-neutral-300">
              <span className="text-neutral-400 font-medium">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent font-mono text-neutral-800 focus:outline-none text-xs"
              />
            </div>
            <div className="flex items-center gap-1 bg-neutral-50 px-2.5 py-1.5 rounded-xl border border-neutral-300">
              <span className="text-neutral-400 font-medium">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent font-mono text-neutral-800 focus:outline-none text-xs"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-xs text-neutral-500 hover:text-neutral-900 underline font-semibold"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <div className="flex items-center gap-1 text-neutral-500 font-semibold mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value as any);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-800 cursor-pointer"
          >
            <option value="All">All Categories ({logs.length})</option>
            <option value="Intervention Request">Intervention Requests (IR)</option>
            <option value="Maintenance Order">Work Orders (OT)</option>
            <option value="Intervention Report">Intervention Reports (PV)</option>
            <option value="Machine Fleet">Machine Fleet</option>
            <option value="Mold Tooling">Mold Tooling</option>
            <option value="Stock Material">Stock Material (Resin)</option>
            <option value="Stock Magasin">Stock Magasin (Spare Parts)</option>
            <option value="Delivery Note">Delivery Notes (BL)</option>
            <option value="System Backup">System Backup &amp; Restore</option>
            <option value="Users & IAM">Users &amp; Roles</option>
          </select>

          {/* Action Filter */}
          <select
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value as any);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-800 cursor-pointer"
          >
            <option value="All">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="VALIDATE">VALIDATE</option>
            <option value="REJECT">REJECT</option>
            <option value="STATUS_CHANGE">STATUS_CHANGE</option>
            <option value="STOCK_IN">STOCK_IN</option>
            <option value="STOCK_OUT">STOCK_OUT</option>
            <option value="UPDATE">UPDATE</option>
            <option value="BACKUP_CREATE">BACKUP_CREATE</option>
            <option value="BACKUP_RESTORE">BACKUP_RESTORE</option>
          </select>

          {/* Severity Filter */}
          <select
            value={selectedSeverity}
            onChange={(e) => {
              setSelectedSeverity(e.target.value as any);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-800 cursor-pointer"
          >
            <option value="All">All Severities</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="danger">Danger (Rejections &amp; Stops)</option>
          </select>

          {/* Results count */}
          <div className="ml-auto text-neutral-500 font-mono text-[11px]">
            Showing <strong className="text-neutral-900">{filteredLogs.length}</strong> of {totalCount} movements
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-[#ebeeed] rounded-3xl border border-neutral-400/80 shadow-xs overflow-hidden flex flex-col justify-between min-h-[520px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-300 text-xs font-bold text-neutral-900 bg-black/5 uppercase tracking-wider">
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-3">Action</th>
                <th className="py-3.5 px-4">Target Ref</th>
                <th className="py-3.5 px-5">Performed By</th>
                <th className="py-3.5 px-5">Movement Description</th>
                <th className="py-3.5 px-4">Status / Rejection</th>
                <th className="py-3.5 px-3 text-center">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-300/70 text-xs font-medium text-neutral-800">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-neutral-500">
                    <ShieldAlert className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
                    <p className="font-bold text-sm text-neutral-700">No audit movements matching filters</p>
                    <p className="text-xs text-neutral-400 mt-1">Try clearing your search query or date range.</p>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const formattedDate = log.timestamp.slice(0, 10);
                  const formattedTime = log.timestamp.slice(11, 19);

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLogForDetails(log)}
                      className="hover:bg-white/50 transition-colors cursor-pointer"
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 font-mono text-[11px] tabular-nums whitespace-nowrap text-neutral-700">
                        <div className="font-bold text-neutral-900">{formattedDate}</div>
                        <div className="text-[10px] text-neutral-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-neutral-400" />
                          <span>{formattedTime}</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getCategoryBadge(log.category)}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>

                      {/* Target Ref */}
                      <td className="py-3 px-4 font-mono font-bold text-blue-700 whitespace-nowrap">
                        {log.targetRef || '-'}
                      </td>

                      {/* Performed By */}
                      <td className="py-3 px-5 whitespace-nowrap">
                        <div className="font-bold text-neutral-900">{log.user}</div>
                      </td>

                      {/* Details */}
                      <td className="py-3 px-5 max-w-md">
                        <div className="font-semibold text-neutral-900 leading-snug line-clamp-2">
                          {log.details}
                        </div>
                        {log.metadata && (
                          <div className="text-[10px] text-neutral-500 mt-0.5 flex flex-wrap gap-2">
                            {Object.entries(log.metadata).map(([k, v]) => (
                              <span key={k} className="bg-black/5 px-1.5 py-0.5 rounded font-mono">
                                {k}: {String(v)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Status / Rejection reason */}
                      <td className="py-3 px-4 max-w-xs">
                        {log.rejectionReason ? (
                          <div className="text-[11px] text-red-800 bg-red-50 p-2 rounded-xl border border-red-200 flex items-start gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold block uppercase text-[9px] text-red-700">Motif Refus:</span>
                              <span className="leading-tight block font-medium line-clamp-2">
                                {log.rejectionReason}
                              </span>
                            </div>
                          </div>
                        ) : log.previousState && log.newState ? (
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-600">
                            <span className="px-1.5 py-0.5 bg-neutral-200 rounded text-neutral-700 font-semibold">
                              {log.previousState}
                            </span>
                            <ArrowRight className="w-3 h-3 text-neutral-400" />
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-900 rounded font-semibold border border-emerald-300">
                              {log.newState}
                            </span>
                          </div>
                        ) : log.newState ? (
                          <span className="px-2 py-0.5 bg-neutral-100 text-neutral-800 rounded font-mono text-[11px] font-semibold border border-neutral-300">
                            {log.newState}
                          </span>
                        ) : (
                          <span className="text-neutral-400 font-mono text-xs">-</span>
                        )}
                      </td>

                      {/* Severity */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-full ${
                            log.severity === 'danger'
                              ? 'bg-red-500 ring-4 ring-red-100'
                              : log.severity === 'warning'
                              ? 'bg-amber-500 ring-4 ring-amber-100'
                              : log.severity === 'success'
                              ? 'bg-emerald-500 ring-4 ring-emerald-100'
                              : 'bg-blue-400 ring-4 ring-blue-100'
                          }`}
                          title={`Severity: ${log.severity}`}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination */}
        <div className="p-3 bg-white/60 border-t border-neutral-300/80">
          <PaginationBar
            currentPage={currentPage}
            totalItems={filteredLogs.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {/* Log Details Modal / Drawer if row clicked */}
      {selectedLogForDetails && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full border border-neutral-300 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-lg text-neutral-900">
                  Movement Record Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedLogForDetails(null)}
                className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg hover:bg-neutral-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-neutral-50 p-3 rounded-2xl border border-neutral-200">
                <div>
                  <span className="text-neutral-400 font-bold uppercase text-[10px] block">Record ID</span>
                  <span className="font-mono font-bold text-neutral-800">{selectedLogForDetails.id}</span>
                </div>
                <div>
                  <span className="text-neutral-400 font-bold uppercase text-[10px] block">Timestamp</span>
                  <span className="font-mono font-bold text-neutral-800">
                    {selectedLogForDetails.timestamp.replace('T', ' ').slice(0, 19)}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400 font-bold uppercase text-[10px] block">Category &amp; Action</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {getCategoryBadge(selectedLogForDetails.category)}
                    {getActionBadge(selectedLogForDetails.action)}
                  </div>
                </div>
                <div>
                  <span className="text-neutral-400 font-bold uppercase text-[10px] block">Target Entity</span>
                  <span className="font-mono font-bold text-blue-700 text-sm">
                    {selectedLogForDetails.targetRef || 'N/A'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-neutral-400 font-bold uppercase text-[10px] block mb-1">
                  Operator / Responsible
                </span>
                <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200 font-bold text-neutral-900">
                  {selectedLogForDetails.user}
                </div>
              </div>

              <div>
                <span className="text-neutral-400 font-bold uppercase text-[10px] block mb-1">
                  Movement Narrative
                </span>
                <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 font-medium text-neutral-800 leading-relaxed">
                  {selectedLogForDetails.details}
                </div>
              </div>

              {selectedLogForDetails.rejectionReason && (
                <div>
                  <span className="text-red-700 font-bold uppercase text-[10px] block mb-1">
                    Rejection Justification (Motif du Refus)
                  </span>
                  <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-red-900 font-bold leading-relaxed">
                    {selectedLogForDetails.rejectionReason}
                  </div>
                </div>
              )}

              {selectedLogForDetails.metadata && (
                <div>
                  <span className="text-neutral-400 font-bold uppercase text-[10px] block mb-1">
                    Metadata Payload
                  </span>
                  <pre className="bg-neutral-900 text-emerald-400 p-3 rounded-xl font-mono text-[11px] overflow-x-auto">
                    {JSON.stringify(selectedLogForDetails.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLogForDetails(null)}
                className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
