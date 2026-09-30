import { MaterialItem, MaterialMovement, Mold } from '../types/gmao';
import { sqliteApi } from './sqliteApi';

export const api = {
  // ─── Materials ────────────────────────────────────────────────────────────
  async getMaterials(): Promise<MaterialItem[]> {
    // Errors propagate: no localStorage fallback (that masked the real problem)
    return sqliteApi.getMaterials();
  },

  async getMaterialMovements(type?: 'in' | 'out'): Promise<MaterialMovement[]> {
    return sqliteApi.getMaterialMovements(type);
  },

  async getMaterialHistory(itemRef: string): Promise<MaterialMovement[]> {
    const all = await this.getMaterialMovements();
    return all
      .filter((m) => m.itemRef.trim().toUpperCase() === itemRef.trim().toUpperCase())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async createMaterialMovement(payload: {
    itemRef: string;
    description?: string;
    subFamily?: string;
    unit?: string;
    quantity: number;
    movementType: 'in' | 'out';
    location?: string;
    date: string;
    notes?: string;
    performedBy?: string;
  }): Promise<MaterialMovement> {
    const cleanRef = payload.itemRef.trim().toUpperCase();
    const cleanQty = Number(payload.quantity) || 0;
    const cleanUnit = payload.unit?.trim() || 'kg';

    const newMov: MaterialMovement = {
      id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      itemRef: cleanRef,
      description: payload.description?.trim() || '',
      subFamily: payload.subFamily?.trim() || '',
      unit: cleanUnit,
      quantity: cleanQty,
      movementType: payload.movementType,
      location: payload.location?.trim() || '',
      date: payload.date || new Date().toISOString().split('T')[0],
      notes: payload.notes?.trim() || '',
      performedBy: payload.performedBy?.trim() || 'Admin (GMAO)',
      createdAt: new Date().toISOString(),
    };

    // Errors (insufficient stock, unknown item) now propagate to the UI
    return sqliteApi.addMaterialMovement(newMov);
  },

  async updateMaterialMovement(
    id: string,
    updates: Partial<MaterialMovement>
  ): Promise<MaterialMovement> {
    // Single atomic PUT — server reverses old movement, validates, applies new one
    return sqliteApi.updateMaterialMovement(id, updates);
  },

  async deleteMaterialMovement(id: string): Promise<{ success: boolean }> {
    // Errors propagate; server reverses stock on delete
    await sqliteApi.deleteMaterialMovement(id);
    return { success: true };
  },

  async updateMaterial(
    itemRef: string,
    updates: Partial<MaterialItem>
  ): Promise<MaterialItem> {
    const all = await this.getMaterials();
    const cleanRef = itemRef.trim().toUpperCase();
    const existing = all.find((m) => m.item.trim().toUpperCase() === cleanRef);
    if (!existing) {
      throw new Error(`Article ${itemRef} introuvable`);
    }
    const updated: MaterialItem = {
      ...existing,
      ...updates,
      item: (updates.item || existing.item).trim().toUpperCase(),
    };
    return sqliteApi.saveMaterial(updated);
  },

  async deleteMaterial(itemRef: string): Promise<{ success: boolean }> {
    await sqliteApi.deleteMaterial(itemRef);
    return { success: true };
  },

  /**
   * Sends ONE request to the batch endpoint (all-or-nothing).
   * The old loop (one POST per row) triggered the full-state auto-save N times and
   * caused each DB write to reload the file — now it is a single atomic operation.
   */
  async batchMaterialMovements(
    rows: any[],
    type: 'in' | 'out',
    performedBy?: string
  ): Promise<{ success: boolean; message: string; count: number }> {
    if (!rows || rows.length === 0) {
      throw new Error('Aucune ligne à traiter');
    }
    const result = await sqliteApi.batchMaterialMovements(rows, type, performedBy);
    return {
      success: true,
      message: result.message || `${result.count} mouvement(s) importé(s) avec succès`,
      count: result.count,
    };
  },

  /**
   * resetToInitial — only callable from an explicit admin button, never automatically.
   */
  async resetToInitial(): Promise<void> {
    await sqliteApi.resetDatabase();
  },

  // ─── Spare Parts / Stock Magasin ─────────────────────────────────────────
  async getSpareParts() {
    return sqliteApi.getSpareParts();
  },
  async createSparePart(part: any) {
    return sqliteApi.createSparePart(part);
  },
  async updateSparePart(id: string, updates: any) {
    return sqliteApi.updateSparePart(id, updates);
  },
  async deleteSparePart(id: string) {
    return sqliteApi.deleteSparePart(id);
  },
  async batchImportSpareParts(rows: any[], mode?: 'upsert' | 'skip') {
    return sqliteApi.batchImportSpareParts(rows, mode);
  },

  // ─── Molds ───────────────────────────────────────────────────────────────
  async getMolds(): Promise<Mold[]> {
    return sqliteApi.getMolds();
  },
  async saveMold(mold: Mold): Promise<Mold> {
    return sqliteApi.saveMold(mold);
  },
  async createMold(mold: Mold): Promise<Mold> {
    return sqliteApi.createMold(mold);
  },
  async deleteMold(id: string): Promise<void> {
    return sqliteApi.deleteMold(id);
  },
};

export default api;
