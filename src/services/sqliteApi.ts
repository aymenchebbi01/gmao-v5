import {
  Machine,
  Mold,
  InterventionRequest,
  MaintenanceOrder,
  InterventionReport,
  StockItem,
  StockMovement,
  MaterialItem,
  MaterialMovement,
  DeliveryNote,
  CalendarEvent,
  AppUser,
  MoldMaintenance,
  AuditLogEntry,
  GMAOBackupSnapshotSummary,
  ProductionOrderOF,
} from '../types/gmao';

export interface SqliteDbStats {
  engine: string;
  filePath: string;
  fileSizeBytes: number;
  tables: Record<string, number>;
  totalRows: number;
  lastPersisted: string;
}

export interface SqlQueryResult {
  columns: string[];
  values: any[][];
  rows: Record<string, any>[];
  rowsAffected?: number;
}

export interface BackupFile {
  filename: string;
  size: number;
  createdAt: string;
  mtime: number;
  tag: 'auto' | 'manual' | 'safety' | 'upload' | 'other';
}

export interface BackupConfig {
  autoBackupEnabled: boolean;
  intervalHours: number;
  maxBackupsToKeep: number;
  lastBackupTime?: string;
  nextBackupTime?: string;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const { headers: extraHeaders, ...rest } = options || {};
  const res = await fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(extraHeaders as Record<string, string> | undefined),
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    let parsedMsg = errorText;
    try {
      const errObj = JSON.parse(errorText);
      parsedMsg = errObj.error || errObj.message || errorText;
    } catch {
      // use raw text
    }
    throw new Error(parsedMsg || `HTTP error ${res.status}`);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const sqliteApi = {
  // DB System & Queries
  async getStats(): Promise<SqliteDbStats> {
    const data = await fetchJson<{ ok: boolean; stats: SqliteDbStats }>('/api/sqlite/info');
    return data.stats;
  },

  async runQuery(sql: string, params: any[] = []): Promise<SqlQueryResult> {
    const data = await fetchJson<{ ok: boolean; result: SqlQueryResult }>('/api/sqlite/query', {
      method: 'POST',
      body: JSON.stringify({ sql, params }),
    });
    return data.result;
  },

  async resetDatabase(): Promise<{ message: string; stats: SqliteDbStats }> {
    const data = await fetchJson<{ ok: boolean; message: string; stats: SqliteDbStats }>('/api/sqlite/reset', {
      method: 'POST',
    });
    return { message: data.message, stats: data.stats };
  },

  downloadDatabaseUrl(): string {
    return '/api/sqlite/download';
  },

  // Full state
  async getFullState(): Promise<any> {
    const data = await fetchJson<{ ok: boolean; data: any }>('/api/full-state');
    return data.data;
  },

  async saveFullState(state: any): Promise<any> {
    const data = await fetchJson<{ ok: boolean; data: any }>('/api/full-state', {
      method: 'POST',
      body: JSON.stringify(state),
    });
    return data.data;
  },

  // Machines
  async getMachines(): Promise<Machine[]> {
    return fetchJson<Machine[]>('/api/machines');
  },
  async saveMachine(machine: Machine): Promise<Machine> {
    return fetchJson<Machine>(`/api/machines/${machine.id}`, {
      method: 'PUT',
      body: JSON.stringify(machine),
    });
  },
  async createMachine(machine: Machine): Promise<Machine> {
    return fetchJson<Machine>('/api/machines', {
      method: 'POST',
      body: JSON.stringify(machine),
    });
  },
  async deleteMachine(id: string): Promise<void> {
    await fetchJson(`/api/machines/${id}`, { method: 'DELETE' });
  },

  // Molds
  async getMolds(): Promise<Mold[]> {
    return fetchJson<Mold[]>('/api/molds');
  },
  async saveMold(mold: Mold): Promise<Mold> {
    return fetchJson<Mold>(`/api/molds/${mold.id}`, {
      method: 'PUT',
      body: JSON.stringify(mold),
    });
  },
  async createMold(mold: Mold): Promise<Mold> {
    return fetchJson<Mold>('/api/molds', {
      method: 'POST',
      body: JSON.stringify(mold),
    });
  },
  async deleteMold(id: string): Promise<void> {
    await fetchJson(`/api/molds/${id}`, { method: 'DELETE' });
  },

  // Intervention Requests
  async getInterventionRequests(): Promise<InterventionRequest[]> {
    return fetchJson<InterventionRequest[]>('/api/intervention-requests');
  },
  async saveInterventionRequest(ir: InterventionRequest): Promise<InterventionRequest> {
    return fetchJson<InterventionRequest>(`/api/intervention-requests/${ir.id}`, {
      method: 'PUT',
      body: JSON.stringify(ir),
    });
  },
  async createInterventionRequest(ir: InterventionRequest): Promise<InterventionRequest> {
    return fetchJson<InterventionRequest>('/api/intervention-requests', {
      method: 'POST',
      body: JSON.stringify(ir),
    });
  },
  async deleteInterventionRequest(id: string): Promise<void> {
    await fetchJson(`/api/intervention-requests/${id}`, { method: 'DELETE' });
  },

  // Maintenance Orders
  async getMaintenanceOrders(): Promise<MaintenanceOrder[]> {
    return fetchJson<MaintenanceOrder[]>('/api/maintenance-orders');
  },
  async saveMaintenanceOrder(order: MaintenanceOrder): Promise<MaintenanceOrder> {
    return fetchJson<MaintenanceOrder>(`/api/maintenance-orders/${order.id}`, {
      method: 'PUT',
      body: JSON.stringify(order),
    });
  },
  async createMaintenanceOrder(order: MaintenanceOrder): Promise<MaintenanceOrder> {
    return fetchJson<MaintenanceOrder>('/api/maintenance-orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  },
  async deleteMaintenanceOrder(id: string): Promise<void> {
    await fetchJson(`/api/maintenance-orders/${id}`, { method: 'DELETE' });
  },

  // Intervention Reports
  async getInterventionReports(): Promise<InterventionReport[]> {
    return fetchJson<InterventionReport[]>('/api/intervention-reports');
  },
  async saveInterventionReport(report: InterventionReport): Promise<InterventionReport> {
    return fetchJson<InterventionReport>(`/api/intervention-reports/${report.id}`, {
      method: 'PUT',
      body: JSON.stringify(report),
    });
  },
  async createInterventionReport(report: InterventionReport): Promise<InterventionReport> {
    return fetchJson<InterventionReport>('/api/intervention-reports', {
      method: 'POST',
      body: JSON.stringify(report),
    });
  },
  async deleteInterventionReport(id: string): Promise<void> {
    await fetchJson(`/api/intervention-reports/${id}`, { method: 'DELETE' });
  },

  // Stock Items / Spare Parts
  async getStockItems(): Promise<StockItem[]> {
    const items = await fetchJson<StockItem[]>('/api/stock-items');
    return items.map((item) => ({
      ...item,
      sku: item.sku || item.partNumber,
      stock: item.stock !== undefined ? item.stock : item.currentQty,
      minStock: item.minStock !== undefined ? item.minStock : item.minQty,
      location: item.location || item.shelfLocation,
    }));
  },
  async saveStockItem(item: StockItem): Promise<StockItem> {
    const normalized: StockItem = {
      ...item,
      partNumber: item.partNumber || item.sku || '',
      sku: item.sku || item.partNumber || '',
      currentQty: item.currentQty !== undefined ? item.currentQty : (item.stock || 0),
      stock: item.stock !== undefined ? item.stock : (item.currentQty || 0),
      minQty: item.minQty !== undefined ? item.minQty : (item.minStock || 0),
      minStock: item.minStock !== undefined ? item.minStock : (item.minQty || 0),
      shelfLocation: item.shelfLocation || item.location || '',
      location: item.location || item.shelfLocation || '',
    };
    return fetchJson<StockItem>(`/api/stock-items/${item.id}`, {
      method: 'PUT',
      body: JSON.stringify(normalized),
    });
  },
  async createStockItem(item: StockItem): Promise<StockItem> {
    const normalized: StockItem = {
      ...item,
      partNumber: item.partNumber || item.sku || '',
      sku: item.sku || item.partNumber || '',
      currentQty: item.currentQty !== undefined ? item.currentQty : (item.stock || 0),
      stock: item.stock !== undefined ? item.stock : (item.currentQty || 0),
      minQty: item.minQty !== undefined ? item.minQty : (item.minStock || 0),
      minStock: item.minStock !== undefined ? item.minStock : (item.minQty || 0),
      shelfLocation: item.shelfLocation || item.location || '',
      location: item.location || item.shelfLocation || '',
    };
    return fetchJson<StockItem>('/api/stock-items', {
      method: 'POST',
      body: JSON.stringify(normalized),
    });
  },
  async deleteStockItem(id: string): Promise<void> {
    await fetchJson(`/api/stock-items/${id}`, { method: 'DELETE' });
  },

  // Spare Parts Aliases
  async getSpareParts(): Promise<StockItem[]> {
    return this.getStockItems();
  },
  async createSparePart(part: Partial<StockItem>): Promise<StockItem> {
    const id = part.id || `PART-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const fullPart: StockItem = {
      id,
      name: part.name || '',
      partNumber: part.partNumber || part.sku || `SKU-${Date.now()}`,
      sku: part.sku || part.partNumber || `SKU-${Date.now()}`,
      category: part.category || 'Mechanical',
      currentQty: part.currentQty !== undefined ? part.currentQty : (part.stock || 0),
      stock: part.stock !== undefined ? part.stock : (part.currentQty || 0),
      minQty: part.minQty !== undefined ? part.minQty : (part.minStock || 5),
      minStock: part.minStock !== undefined ? part.minStock : (part.minQty || 5),
      unit: part.unit || 'pcs',
      unitPrice: part.unitPrice || 25,
      shelfLocation: part.shelfLocation || part.location || 'Warehouse PDR',
      location: part.location || part.shelfLocation || 'Warehouse PDR',
      compatibleMachines: part.compatibleMachines || ['ALL'],
      createdAt: part.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return this.createStockItem(fullPart);
  },
  async updateSparePart(id: string, updates: Partial<StockItem>): Promise<StockItem> {
    const existingList = await this.getStockItems();
    const existing = existingList.find((p) => p.id === id);
    if (!existing) throw new Error(`Pièce ${id} introuvable`);
    const merged: StockItem = {
      ...existing,
      ...updates,
      id,
      partNumber: updates.partNumber || updates.sku || existing.partNumber,
      sku: updates.sku || updates.partNumber || existing.sku || existing.partNumber,
      currentQty: updates.currentQty !== undefined ? updates.currentQty : (updates.stock !== undefined ? updates.stock : existing.currentQty),
      stock: updates.stock !== undefined ? updates.stock : (updates.currentQty !== undefined ? updates.currentQty : existing.currentQty),
      minQty: updates.minQty !== undefined ? updates.minQty : (updates.minStock !== undefined ? updates.minStock : existing.minQty),
      minStock: updates.minStock !== undefined ? updates.minStock : (updates.minQty !== undefined ? updates.minQty : existing.minQty),
      shelfLocation: updates.shelfLocation || updates.location || existing.shelfLocation,
      location: updates.location || updates.shelfLocation || existing.shelfLocation,
      updatedAt: new Date().toISOString(),
    };
    return this.saveStockItem(merged);
  },
  async deleteSparePart(id: string): Promise<void> {
    return this.deleteStockItem(id);
  },
  async batchImportSpareParts(
    rows: any[],
    mode: 'upsert' | 'skip' = 'upsert'
  ): Promise<{ success: boolean; message: string; count: number }> {
    const current = await this.getStockItems();
    let count = 0;

    for (const r of rows) {
      const sku = (r.sku || r.partNumber || '').trim();
      if (!sku) continue;

      const existing = current.find(
        (p) => (p.partNumber || p.sku || '').trim().toLowerCase() === sku.toLowerCase()
      );

      if (existing) {
        if (mode === 'skip') continue;
        await this.updateSparePart(existing.id, {
          name: r.name || existing.name,
          category: r.category || existing.category,
          shelfLocation: r.location || existing.shelfLocation,
          location: r.location || existing.location,
          currentQty: r.stock !== undefined ? r.stock : existing.currentQty,
          stock: r.stock !== undefined ? r.stock : existing.currentQty,
          minQty: r.minStock !== undefined ? r.minStock : existing.minQty,
          minStock: r.minStock !== undefined ? r.minStock : existing.minQty,
          unit: r.unit || existing.unit,
        });
        count++;
      } else {
        await this.createSparePart({
          name: r.name || sku,
          partNumber: sku,
          sku: sku,
          category: r.category || 'Mechanical',
          shelfLocation: r.location || 'Warehouse PDR',
          location: r.location || 'Warehouse PDR',
          currentQty: r.stock || 0,
          stock: r.stock || 0,
          minQty: r.minStock || 5,
          minStock: r.minStock || 5,
          unit: r.unit || 'pcs',
        });
        count++;
      }
    }

    return {
      success: true,
      message: `${count} pièces traitées avec succès dans la base SQLite`,
      count,
    };
  },

  // Stock Movements
  async getStockMovements(): Promise<StockMovement[]> {
    return fetchJson<StockMovement[]>('/api/stock-movements');
  },
  async addStockMovement(movement: StockMovement): Promise<StockMovement> {
    return fetchJson<StockMovement>('/api/stock-movements', {
      method: 'POST',
      body: JSON.stringify(movement),
    });
  },

  // Raw Materials
  async getMaterials(): Promise<MaterialItem[]> {
    return fetchJson<MaterialItem[]>('/api/materials');
  },
  async saveMaterial(material: MaterialItem): Promise<MaterialItem> {
    return fetchJson<MaterialItem>(`/api/materials/${encodeURIComponent(material.item)}`, {
      method: 'PUT',
      body: JSON.stringify(material),
    });
  },
  async createMaterial(material: MaterialItem): Promise<MaterialItem> {
    return fetchJson<MaterialItem>('/api/materials', {
      method: 'POST',
      body: JSON.stringify(material),
    });
  },
  async deleteMaterial(itemRef: string): Promise<void> {
    await fetchJson(`/api/materials/${encodeURIComponent(itemRef)}`, { method: 'DELETE' });
  },

  // Material Movements
  async getMaterialMovements(type?: 'in' | 'out'): Promise<MaterialMovement[]> {
    const url = type ? `/api/material-movements?type=${type}` : '/api/material-movements';
    return fetchJson<MaterialMovement[]>(url);
  },
  async addMaterialMovement(movement: MaterialMovement): Promise<MaterialMovement> {
    return fetchJson<MaterialMovement>('/api/material-movements', {
      method: 'POST',
      body: JSON.stringify(movement),
    });
  },
  async updateMaterialMovement(id: string, updates: Partial<MaterialMovement>): Promise<MaterialMovement> {
    const data = await fetchJson<{ movement: MaterialMovement }>(`/api/material-movements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return data.movement;
  },
  async batchMaterialMovements(
    movements: any[],
    movementType: 'in' | 'out',
    performedBy?: string
  ): Promise<{ count: number; message: string }> {
    const headers: Record<string, string> = {};
    if (performedBy) headers['x-user-name'] = encodeURIComponent(performedBy);
    return fetchJson<{ count: number; message: string }>('/api/material-movements/batch', {
      method: 'POST',
      headers,
      body: JSON.stringify({ movements, movementType }),
    });
  },
  async deleteMaterialMovement(id: string): Promise<void> {
    await fetchJson(`/api/material-movements/${id}`, { method: 'DELETE' });
  },

  // Delivery Notes
  async getDeliveryNotes(): Promise<DeliveryNote[]> {
    return fetchJson<DeliveryNote[]>('/api/delivery-notes');
  },
  async saveDeliveryNote(dn: DeliveryNote): Promise<DeliveryNote> {
    return fetchJson<DeliveryNote>(`/api/delivery-notes/${dn.id}`, {
      method: 'PUT',
      body: JSON.stringify(dn),
    });
  },
  async createDeliveryNote(dn: DeliveryNote): Promise<DeliveryNote> {
    return fetchJson<DeliveryNote>('/api/delivery-notes', {
      method: 'POST',
      body: JSON.stringify(dn),
    });
  },
  async deleteDeliveryNote(id: string): Promise<void> {
    await fetchJson(`/api/delivery-notes/${id}`, { method: 'DELETE' });
  },

  // Calendar Events
  async getCalendarEvents(): Promise<CalendarEvent[]> {
    return fetchJson<CalendarEvent[]>('/api/calendar-events');
  },
  async saveCalendarEvent(ev: CalendarEvent): Promise<CalendarEvent> {
    return fetchJson<CalendarEvent>(`/api/calendar-events/${ev.id}`, {
      method: 'PUT',
      body: JSON.stringify(ev),
    });
  },
  async createCalendarEvent(ev: CalendarEvent): Promise<CalendarEvent> {
    return fetchJson<CalendarEvent>('/api/calendar-events', {
      method: 'POST',
      body: JSON.stringify(ev),
    });
  },
  async deleteCalendarEvent(id: string): Promise<void> {
    await fetchJson(`/api/calendar-events/${id}`, { method: 'DELETE' });
  },

  // Users
  async getUsers(): Promise<AppUser[]> {
    return fetchJson<AppUser[]>('/api/users');
  },
  async saveUser(user: AppUser): Promise<AppUser> {
    return fetchJson<AppUser>(`/api/users/${user.id}`, {
      method: 'PUT',
      body: JSON.stringify(user),
    });
  },
  async createUser(user: AppUser): Promise<AppUser> {
    return fetchJson<AppUser>('/api/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  },
  async deleteUser(id: string): Promise<void> {
    await fetchJson(`/api/users/${id}`, { method: 'DELETE' });
  },

  // Mold Maintenances
  async getMoldMaintenances(): Promise<MoldMaintenance[]> {
    return fetchJson<MoldMaintenance[]>('/api/mold-maintenances');
  },
  async saveMoldMaintenance(mm: MoldMaintenance): Promise<MoldMaintenance> {
    return fetchJson<MoldMaintenance>(`/api/mold-maintenances/${mm.id}`, {
      method: 'PUT',
      body: JSON.stringify(mm),
    });
  },
  async createMoldMaintenance(mm: MoldMaintenance): Promise<MoldMaintenance> {
    return fetchJson<MoldMaintenance>('/api/mold-maintenances', {
      method: 'POST',
      body: JSON.stringify(mm),
    });
  },
  async deleteMoldMaintenance(id: string): Promise<void> {
    await fetchJson(`/api/mold-maintenances/${id}`, { method: 'DELETE' });
  },

  // Audit Logs
  async getAuditLogs(): Promise<AuditLogEntry[]> {
    return fetchJson<AuditLogEntry[]>('/api/audit-logs');
  },
  async addAuditLog(entry: AuditLogEntry): Promise<AuditLogEntry> {
    return fetchJson<AuditLogEntry>('/api/audit-logs', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  },
  async clearAuditLogs(): Promise<void> {
    await fetchJson('/api/audit-logs', { method: 'DELETE' });
  },

  // Snapshots
  async getSnapshots(): Promise<GMAOBackupSnapshotSummary[]> {
    return fetchJson<GMAOBackupSnapshotSummary[]>('/api/snapshots');
  },
  async getSnapshotById(id: string): Promise<any> {
    return fetchJson<any>(`/api/snapshots/${id}`);
  },
  async saveSnapshot(snapshot: any): Promise<void> {
    await fetchJson('/api/snapshots', {
      method: 'POST',
      body: JSON.stringify(snapshot),
    });
  },
  // Production Orders (OFs)
  async getOFs(): Promise<ProductionOrderOF[]> {
    return fetchJson<ProductionOrderOF[]>('/api/ofs');
  },
  async saveOF(ofItem: ProductionOrderOF): Promise<ProductionOrderOF> {
    return fetchJson<ProductionOrderOF>('/api/ofs', {
      method: 'POST',
      body: JSON.stringify(ofItem),
    });
  },
  async updateOF(id: string, updates: Partial<ProductionOrderOF>): Promise<ProductionOrderOF> {
    return fetchJson<ProductionOrderOF>(`/api/ofs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },
  async deleteOF(id: string): Promise<void> {
    await fetchJson(`/api/ofs/${id}`, { method: 'DELETE' });
  },
  async uploadPdf(file: File): Promise<{ url: string; filename: string; size: number }> {
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const base64 = await base64Promise;
    return fetchJson<{ url: string; filename: string; size: number }>('/api/upload-pdf', {
      method: 'POST',
      body: JSON.stringify({ filename: file.name, base64 }),
    });
  },

  // Physical SQLite Backups
  async getBackups(): Promise<BackupFile[]> {
    return fetchJson<BackupFile[]>('/api/backups');
  },
  async getBackupConfig(): Promise<BackupConfig> {
    return fetchJson<BackupConfig>('/api/backups/config');
  },
  async updateBackupConfig(config: Partial<BackupConfig>): Promise<BackupConfig> {
    return fetchJson<BackupConfig>('/api/backups/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },
  async createBackup(label?: string): Promise<{ success: boolean; filename: string }> {
    return fetchJson<{ success: boolean; filename: string }>('/api/backups/create', {
      method: 'POST',
      body: JSON.stringify({ label }),
    });
  },
  async deleteBackup(filename: string): Promise<void> {
    await fetchJson(`/api/backups/${encodeURIComponent(filename)}`, { method: 'DELETE' });
  },
  async restoreBackup(filename: string): Promise<{ success: boolean; message: string }> {
    return fetchJson<{ success: boolean; message: string }>(`/api/backups/restore/${encodeURIComponent(filename)}`, {
      method: 'POST',
    });
  },
  async restoreUploadedBackup(file: File): Promise<{ success: boolean; message: string; filename?: string }> {
    const arrayBuffer = await file.arrayBuffer();
    const res = await fetch('/api/backups/restore-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sqlite3',
      },
      body: arrayBuffer,
    });
    if (!res.ok) {
      const err = await res.text();
      let msg = err;
      try {
        const parsed = JSON.parse(err);
        msg = parsed.error || parsed.message || err;
      } catch {}
      throw new Error(msg || 'Échec de la restauration');
    }
    return res.json();
  },
};

export default sqliteApi;
