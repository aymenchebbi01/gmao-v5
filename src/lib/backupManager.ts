import {
  GMAOBackupPayload,
  GMAOBackupSnapshotSummary,
  Machine,
  Mold,
  InterventionRequest,
  MaintenanceOrder,
  InterventionReport,
  StockItem,
  StockMovement,
  DeliveryNote,
  CalendarEvent,
  AppUser,
  MoldMaintenance,
  AuditLogEntry,
} from '../types/gmao';
import { getAuditLogs, logMovement } from './auditLogger';

const SNAPSHOTS_KEY = 'gmao_local_snapshots_v1';

export interface FullGMAOState {
  machines: Machine[];
  molds: Mold[];
  requests: InterventionRequest[];
  orders: MaintenanceOrder[];
  reports: InterventionReport[];
  stock: StockItem[];
  stockMovements: StockMovement[];
  deliveryNotes: DeliveryNote[];
  calendarEvents: CalendarEvent[];
  users: AppUser[];
  moldMaintenances: MoldMaintenance[];
  auditLogs?: AuditLogEntry[];
}

/**
 * Builds a certified, complete GMAO system backup object
 */
export function createBackupPayload(
  state: FullGMAOState,
  user: string,
  notes?: string
): GMAOBackupPayload {
  const auditLogs = state.auditLogs || getAuditLogs();

  const backup: GMAOBackupPayload = {
    version: '2.4.0-tpm',
    backupId: `BCK-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    createdBy: user,
    notes: notes || 'Automated full system backup',
    counts: {
      machines: state.machines.length,
      molds: state.molds.length,
      requests: state.requests.length,
      orders: state.orders.length,
      reports: state.reports.length,
      stock: state.stock.length,
      stockMovements: state.stockMovements.length,
      deliveryNotes: state.deliveryNotes.length,
      calendarEvents: state.calendarEvents.length,
      users: state.users.length,
      moldMaintenances: state.moldMaintenances.length,
      auditLogs: auditLogs.length,
    },
    data: {
      machines: state.machines,
      molds: state.molds,
      requests: state.requests,
      orders: state.orders,
      reports: state.reports,
      stock: state.stock,
      stockMovements: state.stockMovements,
      deliveryNotes: state.deliveryNotes,
      calendarEvents: state.calendarEvents,
      users: state.users,
      moldMaintenances: state.moldMaintenances,
      auditLogs,
    },
  };

  return backup;
}

/**
 * Downloads the backup payload to the user's computer as a JSON file
 */
export function downloadBackupJSON(backup: GMAOBackupPayload): void {
  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = backup.createdAt.replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `Thermoplastics_Tunisia_GMAO_Backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Saves a local snapshot to browser storage for instant 1-click restore
 */
export function saveLocalSnapshot(
  backup: GMAOBackupPayload
): GMAOBackupSnapshotSummary {
  const jsonStr = JSON.stringify(backup);
  const sizeBytes = new Blob([jsonStr]).size;
  const totalRecords =
    backup.counts.machines +
    backup.counts.molds +
    backup.counts.requests +
    backup.counts.orders +
    backup.counts.reports +
    backup.counts.stock +
    backup.counts.deliveryNotes;

  const summary: GMAOBackupSnapshotSummary = {
    id: backup.backupId,
    createdAt: backup.createdAt,
    createdBy: backup.createdBy,
    notes: backup.notes,
    sizeBytes,
    totalRecords,
  };

  if (typeof window !== 'undefined') {
    try {
      // Save the full snapshot under its ID
      localStorage.setItem(`gmao_snapshot_data_${backup.backupId}`, jsonStr);

      // Save summary to list
      const summaries = getLocalSnapshotSummaries();
      const updated = [summary, ...summaries.filter((s) => s.id !== backup.backupId)].slice(0, 15);
      localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('[BackupManager] Failed to save snapshot locally:', err);
    }
  }

  return summary;
}

/**
 * Get all available local snapshot summaries
 */
export function getLocalSnapshotSummaries(): GMAOBackupSnapshotSummary[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[BackupManager] Failed to load snapshot summaries:', err);
    return [];
  }
}

/**
 * Get a specific local snapshot by ID
 */
export function getLocalSnapshotById(id: string): GMAOBackupPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`gmao_snapshot_data_${id}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('[BackupManager] Failed to load snapshot content:', err);
    return null;
  }
}

/**
 * Delete a local snapshot
 */
export function deleteLocalSnapshot(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`gmao_snapshot_data_${id}`);
    const summaries = getLocalSnapshotSummaries().filter((s) => s.id !== id);
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(summaries));
  } catch (err) {
    console.error('[BackupManager] Failed to delete snapshot:', err);
  }
}

/**
 * Validate an imported JSON string as a valid GMAO backup payload
 */
export function validateBackupFile(fileContent: string): {
  valid: boolean;
  payload?: GMAOBackupPayload;
  error?: string;
} {
  try {
    const parsed = JSON.parse(fileContent);

    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'Invalid JSON file structure.' };
    }

    if (!parsed.data || typeof parsed.data !== 'object') {
      return { valid: false, error: 'Missing core "data" root in backup file.' };
    }

    const { data } = parsed;

    // Check mandatory entities
    if (
      !Array.isArray(data.machines) ||
      !Array.isArray(data.molds) ||
      !Array.isArray(data.requests) ||
      !Array.isArray(data.orders)
    ) {
      return {
        valid: false,
        error: 'Backup file is missing required GMAO arrays (machines, molds, requests, orders).',
      };
    }

    // Reconstruct counts if missing or partial
    const counts = {
      machines: data.machines?.length || 0,
      molds: data.molds?.length || 0,
      requests: data.requests?.length || 0,
      orders: data.orders?.length || 0,
      reports: data.reports?.length || 0,
      stock: data.stock?.length || 0,
      stockMovements: data.stockMovements?.length || 0,
      deliveryNotes: data.deliveryNotes?.length || 0,
      calendarEvents: data.calendarEvents?.length || 0,
      users: data.users?.length || 0,
      moldMaintenances: data.moldMaintenances?.length || 0,
      auditLogs: data.auditLogs?.length || 0,
    };

    const payload: GMAOBackupPayload = {
      version: parsed.version || '2.0.0',
      backupId: parsed.backupId || `BCK-RESTORE-${Date.now()}`,
      createdAt: parsed.createdAt || new Date().toISOString(),
      createdBy: parsed.createdBy || 'Unknown User',
      notes: parsed.notes || 'Imported backup file',
      counts,
      data: {
        machines: data.machines || [],
        molds: data.molds || [],
        requests: data.requests || [],
        orders: data.orders || [],
        reports: data.reports || [],
        stock: data.stock || [],
        stockMovements: data.stockMovements || [],
        deliveryNotes: data.deliveryNotes || [],
        calendarEvents: data.calendarEvents || [],
        users: data.users || [],
        moldMaintenances: data.moldMaintenances || [],
        auditLogs: data.auditLogs || [],
      },
    };

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: `Malformed JSON format: ${err?.message || 'Syntax error'}` };
  }
}
