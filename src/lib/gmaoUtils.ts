import { Machine } from '../types/gmao';

export const cn = (...classes: (string | boolean | undefined | null)[]): string => {
  return classes.filter(Boolean).join(' ');
};

export const formatHoursToDays = (hours: number): string => {
  if (isNaN(hours) || hours <= 0) return '0h';
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = Math.floor(hours / 24);
  const remHours = Math.round(hours % 24);
  return `${hours.toLocaleString()}h (${days}j ${remHours}h)`;
};

export const calculateMachineLiveHours = (machine: Machine): number => {
  return machine.currentHours || machine.totalOperatingHours || 0;
};

export const parseMoldImages = (val?: string | string[]): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // not json, return single string
    }
    return [val];
  }
  return [];
};

export const exportToCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((item) =>
    headers
      .map((header) => {
        const val = item[header] ?? '';
        return `"${String(val).replace(/"/g, '""')}"`;
      })
      .join(',')
  );
  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.click();
};

/**
 * Generates sequential reference for Intervention Requests:
 * Format: IR-YYYY-XXXX (e.g. IR-2026-0001, IR-2026-0002... and when year changes to 2027: IR-2027-0001)
 */
export const generateNextIRRef = (
  existingRequests: { refIR?: string }[],
  targetDate?: string
): string => {
  const year = targetDate ? new Date(targetDate).getFullYear() : new Date().getFullYear();
  const prefix = `IR-${year}-`;
  let maxSeq = 0;

  for (const req of existingRequests) {
    if (req.refIR && req.refIR.startsWith(prefix)) {
      const parts = req.refIR.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
};

/**
 * Generates sequential reference for Maintenance Orders:
 * Format: OT-YYYY-XXXX (e.g. OT-2026-0001, OT-2026-0002... and when year changes to 2027: OT-2027-0001)
 */
export const generateNextOTRef = (
  existingOrders: { refOT?: string }[],
  targetDate?: string
): string => {
  const year = targetDate ? new Date(targetDate).getFullYear() : new Date().getFullYear();
  const prefix = `OT-${year}-`;
  let maxSeq = 0;

  for (const ord of existingOrders) {
    if (ord.refOT && ord.refOT.startsWith(prefix)) {
      const parts = ord.refOT.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
};

/**
 * Generates sequential reference for Intervention Reports:
 * Format: REP-YYYY-XXXX (e.g. REP-2026-0001, REP-2026-0002... and when year changes to 2027: REP-2027-0001)
 */
export const generateNextReportRef = (
  existingReports: { refReport?: string }[],
  targetDate?: string
): string => {
  const year = targetDate ? new Date(targetDate).getFullYear() : new Date().getFullYear();
  const prefix = `REP-${year}-`;
  let maxSeq = 0;

  for (const rep of existingReports) {
    if (rep.refReport && rep.refReport.startsWith(prefix)) {
      const parts = rep.refReport.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
};

/**
 * Generates sequential reference for Production Orders (OF):
 * Format: OF-YYYY-XXXX (e.g. OF-2026-0001, OF-2026-0002... and when year changes to 2027: OF-2027-0001)
 */
export const generateNextOFRef = (
  existingOFs: { ofNumber?: string; ofReference?: string }[],
  targetDate?: string
): string => {
  const year = targetDate ? new Date(targetDate).getFullYear() : new Date().getFullYear();
  const prefix = `OF-${year}-`;
  let maxSeq = 0;

  for (const ofItem of existingOFs || []) {
    const rawRef = (ofItem.ofNumber || (ofItem as any).ofReference || '').trim().toUpperCase();
    if (rawRef.startsWith(prefix)) {
      const parts = rawRef.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    } else {
      const match = rawRef.match(/OF-?(\d{4})-(\d+)/i) || rawRef.match(/OF-?(\d+)/i);
      if (match) {
        const num = parseInt(match[match.length - 1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
};

/**
 * Checks if a machine has had no meter reading in the specified threshold (default 7 days).
 */
export const isMeterReadingStale = (machine: Machine, thresholdDays = 7): boolean => {
  if (!machine.lastMeterReadingDate) {
    return true; // No reading ever recorded, requires attention
  }
  const lastTime = new Date(machine.lastMeterReadingDate).getTime();
  if (isNaN(lastTime)) return true;
  const elapsedDays = (Date.now() - lastTime) / (1000 * 3600 * 24);
  return elapsedDays >= thresholdDays;
};

/**
 * Calculates calendar hours elapsed since a date string.
 */
export const getElapsedCalendarHours = (lastDateStr?: string): number => {
  if (!lastDateStr) return 168; // Default 7 days if unrecorded
  const lastTime = new Date(lastDateStr).getTime();
  if (isNaN(lastTime)) return 168;
  const elapsedMs = Math.max(0, Date.now() - lastTime);
  return Math.round((elapsedMs / (1000 * 3600)) * 10) / 10;
};

/**
 * Validates and calculates statistics for a meter reading candidate.
 */
export const calculateReadingStats = (
  lastHours: number,
  lastDateStr: string | undefined,
  newHours: number
) => {
  const deltaHours = Number((newHours - lastHours).toFixed(1));
  const elapsedCalendarHours = getElapsedCalendarHours(lastDateStr);
  const elapsedCalendarDays = Math.max(0.1, Math.round((elapsedCalendarHours / 24) * 10) / 10);
  const averageHoursPerDay =
    deltaHours > 0 ? Number((deltaHours / elapsedCalendarDays).toFixed(1)) : 0;

  // Validation checks:
  // 1. Hard block: new value cannot be less than last recorded reading
  const isLowerThanLast = newHours < lastHours;

  // 2. Soft warning: delta exceeds elapsed calendar hours (impossible to run more than 24h per calendar day)
  const exceedsCalendarHours = deltaHours > Math.max(1, elapsedCalendarHours);

  return {
    deltaHours,
    elapsedCalendarHours,
    elapsedCalendarDays,
    averageHoursPerDay,
    isLowerThanLast,
    exceedsCalendarHours,
  };
};

