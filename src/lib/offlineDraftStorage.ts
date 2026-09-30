// Offline Caching & Draft Management System for Tablet Workshop
import { useState, useEffect } from 'react';
import { InterventionReport, InterventionRequest } from '../types/gmao';

export interface InterventionReportDraft {
  orderId: string;
  refOT: string;
  equipmentId?: string;
  equipmentName?: string;
  techName: string;
  failureCat: 'mechanical' | 'electrical' | 'hydraulic' | 'mold' | 'other';
  failureSub: string;
  rootCause: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  actions: string[];
  consumedParts: Array<{
    partId: string;
    partNumber: string;
    name: string;
    qty: number;
    unitPrice: number;
  }>;
  moldLocation?: 'local' | 'external';
  moldStatusAfter?: 'In Stock' | 'In Use' | 'Exported';
  statusAfter: 'operational' | 'down' | 'idle';
  difficulties: string;
  updatedAt: string;
}

export interface DIDraft {
  equipmentType: 'Machine' | 'Mold' | 'Other';
  targetId: string;
  otherName: string;
  description: string;
  priority: 'Medium' | 'High' | 'Urgent';
  requesterName: string;
  updatedAt: string;
}

export interface OfflineQueueItem {
  id: string;
  type: 'report' | 'request';
  data: InterventionReport | InterventionRequest;
  timestamp: string;
  status: 'pending' | 'synced' | 'failed';
  summary: string;
}

const DRAFT_PREFIX = 'tt_gmao_report_draft_';
const DI_DRAFT_KEY = 'tt_gmao_di_draft';
const OFFLINE_QUEUE_KEY = 'tt_gmao_offline_outbox_queue';

// =========================================================================
// REPORT DRAFTS STORAGE
// =========================================================================

export const saveReportDraft = (orderId: string, draft: Partial<InterventionReportDraft>): void => {
  if (typeof window === 'undefined' || !orderId) return;
  try {
    const dataWithTimestamp: InterventionReportDraft = {
      orderId,
      refOT: draft.refOT || '',
      equipmentId: draft.equipmentId,
      equipmentName: draft.equipmentName,
      techName: draft.techName || '',
      failureCat: draft.failureCat || 'mechanical',
      failureSub: draft.failureSub || '',
      rootCause: draft.rootCause || '',
      startTime: draft.startTime || '',
      endTime: draft.endTime || '',
      durationMinutes: draft.durationMinutes || 60,
      actions: draft.actions || [],
      consumedParts: draft.consumedParts || [],
      moldLocation: draft.moldLocation,
      moldStatusAfter: draft.moldStatusAfter,
      statusAfter: draft.statusAfter || 'operational',
      difficulties: draft.difficulties || '',
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(`${DRAFT_PREFIX}${orderId}`, JSON.stringify(dataWithTimestamp));
  } catch (err) {
    console.warn('[OfflineStorage] Error saving report draft:', err);
  }
};

export const getReportDraft = (orderId: string): InterventionReportDraft | null => {
  if (typeof window === 'undefined' || !orderId) return null;
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${orderId}`);
    if (!raw) return null;
    return JSON.parse(raw) as InterventionReportDraft;
  } catch (err) {
    console.warn('[OfflineStorage] Error reading report draft:', err);
    return null;
  }
};

export const clearReportDraft = (orderId: string): void => {
  if (typeof window === 'undefined' || !orderId) return;
  try {
    localStorage.removeItem(`${DRAFT_PREFIX}${orderId}`);
  } catch (err) {
    console.warn('[OfflineStorage] Error clearing report draft:', err);
  }
};

export const hasReportDraft = (orderId: string): boolean => {
  if (typeof window === 'undefined' || !orderId) return false;
  return Boolean(localStorage.getItem(`${DRAFT_PREFIX}${orderId}`));
};

// =========================================================================
// DEMANDE D'INTERVENTION (DI) DRAFT STORAGE
// =========================================================================

export const saveDIDraft = (draft: Partial<DIDraft>): void => {
  if (typeof window === 'undefined') return;
  try {
    const fullDraft: DIDraft = {
      equipmentType: draft.equipmentType || 'Machine',
      targetId: draft.targetId || '',
      otherName: draft.otherName || '',
      description: draft.description || '',
      priority: draft.priority || 'High',
      requesterName: draft.requesterName || '',
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(DI_DRAFT_KEY, JSON.stringify(fullDraft));
  } catch (err) {
    console.warn('[OfflineStorage] Error saving DI draft:', err);
  }
};

export const getDIDraft = (): DIDraft | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DI_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DIDraft;
  } catch (err) {
    console.warn('[OfflineStorage] Error reading DI draft:', err);
    return null;
  }
};

export const clearDIDraft = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(DI_DRAFT_KEY);
  } catch (err) {
    console.warn('[OfflineStorage] Error clearing DI draft:', err);
  }
};

// =========================================================================
// OFFLINE OUTBOX QUEUE (Store requests & reports created while offline)
// =========================================================================

export const getOfflineQueue = (): OfflineQueueItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineQueueItem[];
  } catch (err) {
    console.warn('[OfflineStorage] Error getting offline queue:', err);
    return [];
  }
};

export const addToOfflineQueue = (
  type: 'report' | 'request',
  data: InterventionReport | InterventionRequest,
  summary: string
): OfflineQueueItem => {
  const current = getOfflineQueue();
  const newItem: OfflineQueueItem = {
    id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type,
    data,
    timestamp: new Date().toISOString(),
    status: 'pending',
    summary,
  };
  const updated = [newItem, ...current];
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[OfflineStorage] Error adding to offline queue:', err);
  }
  return newItem;
};

export const removeFromOfflineQueue = (id: string): void => {
  const current = getOfflineQueue();
  const updated = current.filter((item) => item.id !== id);
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[OfflineStorage] Error removing from queue:', err);
  }
};

export const clearOfflineQueue = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch (err) {
    console.warn('[OfflineStorage] Error clearing offline queue:', err);
  }
};

// =========================================================================
// REACT HOOK FOR REALTIME ONLINE/OFFLINE STATUS
// =========================================================================

export function useOnlineStatus(): {
  isOnline: boolean;
  lastChanged: Date;
  testConnection: () => Promise<boolean>;
} {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [lastChanged, setLastChanged] = useState<Date>(new Date());

  const testConnection = async (): Promise<boolean> => {
    if (!navigator.onLine) {
      setIsOnline(false);
      return false;
    }
    try {
      // Lightweight fetch with cache busting to test genuine network access
      const res = await fetch(`/metadata.json?_t=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
      });
      const online = res.ok || res.status === 304;
      setIsOnline(online);
      return online;
    } catch {
      // If fetch fails in offline mode
      setIsOnline(false);
      return false;
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastChanged(new Date());
    };
    const handleOffline = () => {
      setIsOnline(false);
      setLastChanged(new Date());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, lastChanged, testConnection };
}
