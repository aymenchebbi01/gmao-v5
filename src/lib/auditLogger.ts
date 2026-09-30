import { AuditLogEntry, AuditCategory, AuditAction } from '../types/gmao';

const AUDIT_STORAGE_KEY = 'gmao_audit_trail_v1';

// Clean initial audit logs for production usage
export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];

/**
 * Retrieve all logged movements from local storage or return empty array.
 */
export function getAuditLogs(): AuditLogEntry[] {
  if (typeof window === 'undefined') return INITIAL_AUDIT_LOGS;
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify([]));
    return [];
  } catch (err) {
    console.warn('[AuditLogger] Failed to parse logs from localStorage:', err);
    return [];
  }
}

/**
 * Log any app movement or event in the system.
 */
export function logMovement(
  entry: Omit<AuditLogEntry, 'id' | 'timestamp'> & { timestamp?: string }
): AuditLogEntry {
  const newEntry: AuditLogEntry = {
    id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: entry.timestamp || new Date().toISOString(),
    category: entry.category,
    action: entry.action,
    targetRef: entry.targetRef,
    user: entry.user,
    details: entry.details,
    previousState: entry.previousState,
    newState: entry.newState,
    rejectionReason: entry.rejectionReason,
    severity: entry.severity || 'info',
    metadata: entry.metadata,
  };

  if (typeof window !== 'undefined') {
    try {
      const existing = getAuditLogs();
      const updated = [newEntry, ...existing].slice(0, 1000); // retain last 1000 events
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));

      // Dispatch cross-component custom event so live tables auto-refresh
      window.dispatchEvent(
        new CustomEvent('gmao_audit_movement', { detail: newEntry })
      );
    } catch (err) {
      console.warn('[AuditLogger] Failed to save movement to localStorage:', err);
    }
  }

  return newEntry;
}

/**
 * Clear or reset audit logs back to factory seeds
 */
export function resetAuditLogsToSeed(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(INITIAL_AUDIT_LOGS));
    window.dispatchEvent(new CustomEvent('gmao_audit_movement', { detail: null }));
  } catch (err) {
    console.error('[AuditLogger] Error resetting audit logs:', err);
  }
}

/**
 * Export audit logs to formatted CSV file
 */
export function exportAuditLogsToCSV(logs: AuditLogEntry[]): void {
  const headers = [
    'Timestamp',
    'Category',
    'Action',
    'Target Ref',
    'User & Role',
    'Severity',
    'Details',
    'Rejection Reason',
    'Previous State',
    'New State',
  ];

  const escapeCSV = (val: any) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = logs.map((log) => [
    escapeCSV(log.timestamp),
    escapeCSV(log.category),
    escapeCSV(log.action),
    escapeCSV(log.targetRef),
    escapeCSV(log.user),
    escapeCSV(log.severity),
    escapeCSV(log.details),
    escapeCSV(log.rejectionReason || ''),
    escapeCSV(log.previousState || ''),
    escapeCSV(log.newState || ''),
  ]);

  const csvContent =
    'data:text/csv;charset=utf-8,\uFEFF' +
    [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute(
    'download',
    `GMAO_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
