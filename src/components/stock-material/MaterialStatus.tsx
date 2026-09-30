import React, { useState, useEffect } from 'react';
import {
  Layers,
  Search,
  FileSpreadsheet,
  History,
  ArrowDownLeft,
  ArrowUpRight,
  X,
  Calendar,
  MapPin,
  RefreshCw,
  Filter,
  Tag,
  Pencil,
  Trash2,
  AlertTriangle,
  Save,
  Gauge
} from 'lucide-react';

import { toast } from 'sonner';
import { format } from 'date-fns';
import { api } from '../../services/api';
import { MaterialItem, MaterialMovement } from '../../types';
import TableFooter from '../common/TableFooter';
import { exportToXLSX } from '../../lib/exportUtils';
import { useAuth } from '../../contexts/AuthContext';

// ── Edit Modal ────────────────────────────────────────────────────────────────
interface EditMaterialModalProps {
  item: MaterialItem;
  onClose: () => void;
  onSaved: () => void;
}

function EditMaterialModal({ item, onClose, onSaved }: EditMaterialModalProps) {
  const [description, setDescription] = useState(item.description || '');
  const [subFamily, setSubFamily] = useState(item.subFamily || '');
  const [unit, setUnit] = useState(item.unit || 'kg');
  const [location, setLocation] = useState(item.location || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateMaterial(item.item, { description, subFamily, unit, location });
      toast.success(`Article "${item.item}" updated successfully`);
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error('Error updating: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-blue-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Pencil size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Modifier l'article</h3>
              <p className="text-xs text-gray-500 font-mono mt-0.5">{item.item}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">Description</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Description de l'article..."
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-blue-500 focus:bg-white transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">Sous-Famille</label>
            <input type="text" value={subFamily} onChange={e => setSubFamily(e.target.value)}
              placeholder="Sous-famille..."
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-blue-500 focus:bg-white transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Unit</label>
              <select value={unit} onChange={e => setUnit(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-blue-500 focus:bg-white transition-colors">
                {['kg', 'g', 'L', 'mL', 'pcs', 'm', 'cm', 'mm', 't', 'sac', 'boîte'].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Emplacement</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                placeholder="Emplacement..."
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-blue-500 focus:bg-white transition-colors" />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/80 flex items-center justify-end gap-3">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-bold transition-colors cursor-pointer">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-xs disabled:opacity-60 cursor-pointer">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirmation Modal ──────────────────────────────────────────────────
interface DeleteMaterialModalProps {
  item: MaterialItem;
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteMaterialModal({ item, onClose, onDeleted }: DeleteMaterialModalProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteMaterial(item.item);
      toast.success(`Article "${item.item}" and all its movements deleted`);
      onDeleted();
      onClose();
    } catch (err: any) {
      toast.error('Erreur lors de la suppression: ' + (err.message || err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-red-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Delete Material Item</h3>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
              Are you sure you want to delete material item{' '}
              <span className="font-mono font-black text-gray-900">{item.item}</span>{' '}
              and <strong>all its transactions</strong>? This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/80 flex items-center justify-end gap-3">
          <button onClick={onClose} disabled={deleting}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-bold transition-colors cursor-pointer">Cancel</button>
          <button onClick={handleDelete} disabled={deleting}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-xs disabled:opacity-60 cursor-pointer">
            {deleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function MaterialStatus() {
  const { user } = useAuth();
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'responsable technique' || user?.role === 'responsable maintenance';

  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Movement history modal state
  const [selectedItemForHistory, setSelectedItemForHistory] = useState<MaterialItem | null>(null);
  const [historyMovements, setHistoryMovements] = useState<MaterialMovement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Edit & Delete modal state
  const [editingItem, setEditingItem] = useState<MaterialItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<MaterialItem | null>(null);

  const loadMaterials = async () => {
    setLoading(true);
    try {
      const data = await api.getMaterials();
      setMaterials(data);
    } catch (err: any) {
      toast.error('Error loading stock inventory: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  // Fetch history when an item is selected
  const handleOpenHistory = async (item: MaterialItem) => {
    setSelectedItemForHistory(item);
    setLoadingHistory(true);
    try {
      const moves = await api.getMaterialHistory(item.item);
      setHistoryMovements(moves);
    } catch (err: any) {
      toast.error('Erreur lors du chargement de l’historique: ' + (err.message || err));
    } finally {
      setLoadingHistory(false);
    }
  };

  // Filter materials based on search term and stock filter
  const filteredMaterials = materials.filter(m => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      m.item.toLowerCase().includes(q) ||
      (m.description && m.description.toLowerCase().includes(q)) ||
      (m.subFamily && m.subFamily.toLowerCase().includes(q)) ||
      (m.location && m.location.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (stockFilter === 'in_stock') return m.currentStock > 0;
    if (stockFilter === 'out_of_stock') return m.currentStock <= 0;
    return true;
  });

  // Export current stock table: exports currently filtered/searched view by default
  const handleExportStock = () => {
    if (filteredMaterials.length === 0) {
      toast.info('No items to export for this selection');
      return;
    }
    const exportData = filteredMaterials.map(m => ({
      'Material Item Code': m.item,
      'Description': m.description || '',
      'Sous-Famille': m.subFamily || '',
      'Stock Actuel': m.currentStock,
      'Unit': m.unit || 'kg',
      'Emplacement Principal': m.location || '',
      'Last Movement': m.lastMovementDate ? format(new Date(m.lastMovementDate), 'yyyy-MM-dd') : '—',
      'Statut': m.currentStock > 0 ? 'En Stock' : 'Rupture'
    }));
    exportToXLSX(exportData, `etat_stock_matiere_${format(new Date(), 'yyyy-MM-dd')}.xlsx`, 'StockMatiere');
    toast.success(`${filteredMaterials.length} item(s) exported successfully`);
  };

  const paginatedMaterials = filteredMaterials.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const inStockCount = materials.filter(m => m.currentStock > 0).length;
  const outOfStockCount = materials.filter(m => m.currentStock <= 0).length;
  const totalStockKg = materials.reduce((acc, m) => acc + (Number(m.currentStock) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl">
        <div>

        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadMaterials}
            className="p-2.5 bg-white hover:bg-gray-50 text-gray-600 border border-gray-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            title="Refresh data"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleExportStock}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
            title="Export filtered view"
          >
            <FileSpreadsheet size={15} />
            <span>Exporter Excel</span>
          </button>
        </div>
      </div>

      {/* Main Stock Table Container */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        {/* Controls: Search & Filter Chips */}
        <div className="p-5 border-b border-gray-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50">
          {/* Filters */}
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-gray-400 mr-1" />
            <button
              onClick={() => { setStockFilter('all'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${stockFilter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
            >
              Tous ({materials.length})
            </button>
            <button
              onClick={() => { setStockFilter('in_stock'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${stockFilter === 'in_stock'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
            >
              In Stock ({inStockCount})
            </button>
            <button
              onClick={() => { setStockFilter('out_of_stock'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${stockFilter === 'out_of_stock'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
            >
              Out Of Stock ({outOfStockCount})
            </button>
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-80">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by part number, desc, sub-family, location..."
              className="w-full pl-9 pr-3.5 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:border-blue-600 shadow-2xs"
            />
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        {/* Stock Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/90 text-gray-600 uppercase font-semibold text-[11px] border-b border-gray-200">
              <tr>
                <th className="px-5 py-3">Item</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Sub Family</th>
                <th className="px-5 py-3">Current Stock</th>
                <th className="px-5 py-3">Unit</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Last Movement</th>
                <th className="px-5 py-3 text-right">History</th>
                {isAdminOrManager && (
                  <th className="px-5 py-3 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {paginatedMaterials.length > 0 ? (
                paginatedMaterials.map((m) => (
                  <tr
                    key={m.item}
                    className="hover:bg-blue-50/40 transition-colors group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md text-xs group-hover:bg-blue-100 group-hover:text-blue-900 transition-colors">
                          {m.item}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-700 max-w-xs truncate" title={m.description || ''}>
                      {m.description || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {m.subFamily ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                          <Tag size={11} />
                          {m.subFamily}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono">
                      <span className={`px-2.5 py-1 rounded-lg font-black text-xs ${m.currentStock > 0
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                        {m.currentStock.toLocaleString('fr-FR')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-gray-500 uppercase text-[11px]">
                      {m.unit || 'kg'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-700">
                      {m.location ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={12} className="text-gray-400" /> {m.location}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-gray-400" />
                        {m.lastMovementDate ? format(new Date(m.lastMovementDate), 'yyyy-MM-dd') : '—'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenHistory(m)}
                        className="px-2.5 py-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg font-bold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <History size={13} />
                        <span>Details</span>
                      </button>
                    </td>
                    {isAdminOrManager && (
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingItem(m)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Modifier cet article"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingItem(m)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete this item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isAdminOrManager ? 9 : 8} className="px-5 py-8 text-center text-gray-400">
                    {loading ? 'Loading raw materials stock...' : 'No items found in raw materials inventory.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Shared TableFooter */}
        <TableFooter
          totalItems={filteredMaterials.length}
          pageSize={pageSize}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Movement History Modal / Detail Drawer */}
      {selectedItemForHistory && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-blue-50/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <History size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-lg text-gray-900">{selectedItemForHistory.item}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${selectedItemForHistory.currentStock > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
                      }`}>
                      Stock : {selectedItemForHistory.currentStock} {selectedItemForHistory.unit || 'kg'}
                    </span>
                    {selectedItemForHistory.subFamily && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                        {selectedItemForHistory.subFamily}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selectedItemForHistory.description || 'Chronological history of raw material ins and outs'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedItemForHistory(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: History Table */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingHistory ? (
                <div className="py-12 text-center text-gray-400 space-y-2">
                  <RefreshCw size={24} className="animate-spin mx-auto text-blue-600" />
                  <p className="text-xs font-semibold">Chargement des mouvements...</p>
                </div>
              ) : historyMovements.length > 0 ? (
                <div className="border border-gray-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-600 uppercase font-semibold text-[11px] border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Type</th>
                        <th className="px-4 py-2.5">Quantity</th>
                        <th className="px-4 py-2.5">Location</th>
                        <th className="px-4 py-2.5">Operator</th>
                        <th className="px-4 py-2.5">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {historyMovements.map((m) => {
                        const isInput = m.movementType === 'in';
                        return (
                          <tr key={m.id} className="hover:bg-gray-50/70 transition-colors">
                            <td className="px-4 py-2.5 text-gray-600 font-semibold font-mono">
                              {m.date}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${isInput
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                                }`}>
                                {isInput ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />}
                                {isInput ? 'In' : 'Out'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-mono font-bold">
                              <span className={isInput ? 'text-emerald-700' : 'text-amber-700'}>
                                {isInput ? `+${m.quantity}` : `-${m.quantity}`} {selectedItemForHistory.unit || 'kg'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-gray-700">
                              {m.location || '—'}
                            </td>
                            <td className="px-4 py-2.5 text-gray-600">
                              {m.performedBy || 'System'}
                            </td>
                            <td className="px-4 py-2.5 text-gray-500 italic">
                              {m.notes || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-gray-400 text-xs">
                  No transactions recorded for this item.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/80 flex items-center justify-end">
              <button
                onClick={() => setSelectedItemForHistory(null)}
                className="px-5 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Material Modal */}
      {editingItem && (
        <EditMaterialModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={loadMaterials}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <DeleteMaterialModal
          item={deletingItem}
          onClose={() => setDeletingItem(null)}
          onDeleted={loadMaterials}
        />
      )}
    </div>
  );
}
export { MaterialStatus };
