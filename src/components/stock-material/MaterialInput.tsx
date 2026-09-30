import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowDownLeft,
  Plus,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  Search,
  Trash2,
  Edit2,
  Layers,
  Calendar,
  MapPin,
  Scale,
  FileText,
  User,
  RefreshCw,
  X,
  Tag
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { api } from '../../services/api';
import { MaterialItem, MaterialMovement } from '../../types';
import TableFooter from '../common/TableFooter';
import { exportToXLSX } from '../../lib/exportUtils';
import { useAuth } from '../../contexts/AuthContext';

export default function MaterialInput() {
  const { user } = useAuth();

  // Reference materials & movement records
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [movements, setMovements] = useState<MaterialMovement[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Manual form state
  const [selectedItem, setSelectedItem] = useState('');
  const [description, setDescription] = useState('');
  const [subFamily, setSubFamily] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [unit, setUnit] = useState('kg');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Autocomplete dropdown in Add Modal
  const [itemSearch, setItemSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState<MaterialMovement | null>(null);
  const [editItemRef, setEditItemRef] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSubFamily, setEditSubFamily] = useState('');
  const [editQuantity, setEditQuantity] = useState<number | ''>('');
  const [editUnit, setEditUnit] = useState('kg');
  const [editLocation, setEditLocation] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editPerformedBy, setEditPerformedBy] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Excel import state
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [invalidRows, setInvalidRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingPreviewRowIndex, setEditingPreviewRowIndex] = useState<number | null>(null);
  const [isEditingInvalid, setIsEditingInvalid] = useState(false);
  const [editPreviewForm, setEditPreviewForm] = useState({
    itemRef: '',
    description: '',
    subFamily: '',
    quantity: 0,
    unit: 'kg',
    location: '',
    notes: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  // Table state
  const [tableSearch, setTableSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mats, moves] = await Promise.all([
        api.getMaterials(),
        api.getMaterialMovements('in')
      ]);
      setMaterials(mats);
      setMovements(moves);
    } catch (err: any) {
      toast.error('Erreur lors du chargement des données: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Close autocomplete dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-fill fields when an item is selected from dropdown
  const handleSelectItem = (m: MaterialItem) => {
    setSelectedItem(m.item);
    setItemSearch(m.item);
    setDescription(m.description || '');
    setSubFamily(m.subFamily || '');
    setUnit(m.unit || 'kg');
    setLocation(m.location || '');
    setIsDropdownOpen(false);
  };

  const handleOpenAddModal = () => {
    setSelectedItem('');
    setItemSearch('');
    setDescription('');
    setSubFamily('');
    setQuantity('');
    setUnit('kg');
    setLocation('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setNotes('');
    setIsAddModalOpen(true);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanItem = (selectedItem || itemSearch).trim().toUpperCase();
    if (!cleanItem) {
      toast.error('Veuillez sélectionner ou saisir une référence matière');
      return;
    }
    const numQty = Number(quantity);
    if (isNaN(numQty) || numQty < 0) {
      toast.error('La quantité doit être supérieure ou égale à 0');
      return;
    }

    setSubmitting(true);
    try {
      await api.createMaterialMovement({
        itemRef: cleanItem,
        description: description.trim(),
        subFamily: subFamily.trim(),
        unit: unit.trim() || 'kg',
        quantity: numQty,
        movementType: 'in',
        location: location.trim(),
        date,
        notes: notes.trim(),
        performedBy: user?.name || 'Magasinier',
      });

      toast.success(`In matière de ${numQty} ${unit} pour "${cleanItem}" enregistrée avec succès.`);
      setIsAddModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Excel Import Helpers ───────────────────────────────────────────────────
  const downloadTemplate = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const templateData = [
      {
        Item: '',
        Description: '',
        SubFamily: '',
        Unit: '',
        Quantity: '',
        Location: '',
        Date: today,
        Notes: ''
      },
    ];
    exportToXLSX(templateData, 'modele_entree_matiere.xlsx', 'EntreeMatiere');
    toast.success('Modèle téléchargé avec succès');
  };

  const processFile = (selectedFile: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });

        if (!json || json.length === 0) {
          toast.error('Le fichier est vide');
          return;
        }

        const valid: any[] = [];
        const invalid: any[] = [];

        json.forEach((row, index) => {
          const itemRef = String(
            row.Item || row.item || row.Reference || row['Référence'] || row.Article || row.Code || row['Item;Quantity;Location']?.split(';')[0] || ''
          ).trim().toUpperCase();

          const desc = String(
            row.Description || row.description || row['Désignation'] || row.Designation || row.Desc || ''
          ).trim();

          const subFam = String(
            row.SubFamily || row.subFamily || row['Sous-Famille'] || row['Sous Famille'] || row['Sub Family'] || row.Famille || ''
          ).trim();

          const u = String(
            row.Unit || row.unit || row['Unité'] || row.Unite || row.UOM || 'kg'
          ).trim();

          let rawQty = row.Quantity ?? row.quantity ?? row.Qte ?? row['Qté'] ?? row['Quantité'];
          if (rawQty === undefined && row['Item;Quantity;Location']) {
            rawQty = row['Item;Quantity;Location'].split(';')[1];
          }

          let loc = String(row.Location || row.location || row.Emplacement || row.Lieu || '').trim();
          if (!loc && row['Item;Quantity;Location']) {
            loc = String(row['Item;Quantity;Location'].split(';')[2] || '').trim();
          }

          const parsedQty = (rawQty === undefined || rawQty === null || String(rawQty).trim() === '')
            ? 0
            : parseFloat(String(rawQty).replace(',', '.'));
          const reasons: string[] = [];

          if (!itemRef) reasons.push('Référence article manquante');
          if (isNaN(parsedQty) || parsedQty < 0) reasons.push('Quantité invalide (doit être >= 0)');

          if (reasons.length === 0) {
            valid.push({
              index: index + 1,
              itemRef,
              description: desc,
              subFamily: subFam,
              unit: u || 'kg',
              quantity: parsedQty,
              location: loc,
              date: row.Date ? String(row.Date).trim() : format(new Date(), 'yyyy-MM-dd'),
              notes: row.Notes ? String(row.Notes).trim() : 'Import Excel'
            });
          } else {
            invalid.push({
              index: index + 1,
              itemRef: itemRef || 'N/A',
              description: desc,
              subFamily: subFam,
              unit: u || 'kg',
              quantity: rawQty || 0,
              location: loc,
              date: row.Date ? String(row.Date).trim() : format(new Date(), 'yyyy-MM-dd'),
              notes: row.Notes ? String(row.Notes).trim() : 'Import Excel',
              reason: reasons.join(', ')
            });
          }
        });

        setPreviewRows(valid);
        setInvalidRows(invalid);
        setFile(selectedFile);
      } catch (err: any) {
        toast.error('Erreur de lecture du fichier: ' + err.message);
        setPreviewRows([]);
        setInvalidRows([]);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleDeletePreviewRow = (index: number, isInvalid = false) => {
    if (isInvalid) {
      setInvalidRows(prev => prev.filter((_, i) => i !== index));
    } else {
      setPreviewRows(prev => prev.filter((_, i) => i !== index));
    }
    toast.info('Row removed');
  };

  const handleStartEditPreviewRow = (row: any, index: number, isInvalid = false) => {
    setEditingPreviewRowIndex(index);
    setIsEditingInvalid(isInvalid);
    setEditPreviewForm({
      itemRef: row.itemRef || '',
      description: row.description || '',
      subFamily: row.subFamily || '',
      quantity: Number(row.quantity) || 0,
      unit: row.unit || 'kg',
      location: row.location || '',
      notes: row.notes || '',
      date: row.date || format(new Date(), 'yyyy-MM-dd')
    });
  };

  const handleSaveEditPreviewRow = () => {
    if (editingPreviewRowIndex === null) return;
    const trimmedRef = editPreviewForm.itemRef.trim().toUpperCase();
    const qty = Number(editPreviewForm.quantity);

    if (!trimmedRef) {
      toast.error("Material item reference is mandatory");
      return;
    }
    if (isNaN(qty) || qty < 0) {
      toast.error("La quantité doit être un nombre positif (>= 0)");
      return;
    }

    const targetList = isEditingInvalid ? invalidRows : previewRows;
    const originalRow = targetList[editingPreviewRowIndex];
    const updatedRow = {
      index: originalRow?.index || editingPreviewRowIndex + 1,
      itemRef: trimmedRef,
      description: editPreviewForm.description.trim(),
      subFamily: editPreviewForm.subFamily.trim(),
      unit: editPreviewForm.unit || 'kg',
      quantity: qty,
      location: editPreviewForm.location.trim(),
      date: editPreviewForm.date || format(new Date(), 'yyyy-MM-dd'),
      notes: editPreviewForm.notes.trim() || 'Import Excel (Modifié)'
    };

    if (isEditingInvalid) {
      setInvalidRows(prev => prev.filter((_, i) => i !== editingPreviewRowIndex));
      setPreviewRows(prev => [...prev, updatedRow]);
      toast.success("Ligne corrigée et ajoutée aux lignes valides");
    } else {
      setPreviewRows(prev => prev.map((r, i) => i === editingPreviewRowIndex ? updatedRow : r));
      toast.success("Ligne mise à jour");
    }

    setEditingPreviewRowIndex(null);
  };

  const handleBatchCommit = async () => {
    if (previewRows.length === 0) return;
    setImporting(true);
    try {
      const res = await api.batchMaterialMovements(previewRows, 'in');
      toast.success(res.message || `${previewRows.length} entrées importées avec succès`);
      setFile(null);
      setPreviewRows([]);
      setInvalidRows([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsImportModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'importation");
    } finally {
      setImporting(false);
    }
  };

  const handleOpenEditModal = (m: MaterialMovement) => {
    setEditingMovement(m);
    setEditItemRef(m.itemRef);
    setEditDescription(m.description || '');
    setEditSubFamily(m.subFamily || '');
    setEditQuantity(m.quantity);
    setEditUnit(m.unit || 'kg');
    setEditLocation(m.location || '');
    setEditDate(m.date || format(new Date(), 'yyyy-MM-dd'));
    setEditNotes(m.notes || '');
    setEditPerformedBy(m.performedBy || '');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMovement) return;
    if (!editItemRef.trim()) {
      toast.error("Please enter material item reference");
      return;
    }
    if (editQuantity === '' || Number(editQuantity) < 0) {
      toast.error('Veuillez saisir une quantité valide (>= 0)');
      return;
    }

    setEditSubmitting(true);
    try {
      await api.updateMaterialMovement(editingMovement.id, {
        itemRef: editItemRef.trim().toUpperCase(),
        description: editDescription.trim(),
        subFamily: editSubFamily.trim(),
        quantity: Number(editQuantity),
        unit: editUnit.trim() || 'kg',
        location: editLocation.trim(),
        date: editDate,
        notes: editNotes.trim(),
        performedBy: editPerformedBy.trim()
      });
      toast.success("Receipt movement updated successfully");
      setIsEditModalOpen(false);
      setEditingMovement(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la modification');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteMovement = async (id: string) => {
    if (!window.confirm('Voulez-vous annuler ce mouvement d’entrée ? Le stock correspondant sera déduit.')) return;
    try {
      await api.deleteMaterialMovement(id);
      toast.success('Mouvement annulé et stock mis à jour');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'annulation");
    }
  };

  // Filtered movements for table and export
  const filteredMovements = movements.filter(m => {
    const q = tableSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      m.itemRef.toLowerCase().includes(q) ||
      (m.description && m.description.toLowerCase().includes(q)) ||
      (m.subFamily && m.subFamily.toLowerCase().includes(q)) ||
      (m.location && m.location.toLowerCase().includes(q)) ||
      (m.performedBy && m.performedBy.toLowerCase().includes(q)) ||
      (m.notes && m.notes.toLowerCase().includes(q))
    );
  });

  // Export movement records: exports the currently filtered/searched view by default
  const handleExportMovements = () => {
    if (filteredMovements.length === 0) {
      toast.info('No movements to export for this selection');
      return;
    }
    const exportData = filteredMovements.map(m => ({
      'Date': m.date,
      'Item Reference': m.itemRef,
      'Description': m.description || '',
      'Sous-Famille': m.subFamily || '',
      'Quantity': m.quantity,
      'Unit': m.unit || 'kg',
      'Type': 'In',
      'Emplacement': m.location || '',
      'Recorded By': m.performedBy || '',
      'Remarques / N° BL': m.notes || '',
      'Record Date': m.createdAt ? format(new Date(m.createdAt), 'yyyy-MM-dd HH:mm') : ''
    }));
    exportToXLSX(exportData, `entree_matiere_${format(new Date(), 'yyyy-MM-dd')}.xlsx`, 'EntreesMatiere');
    toast.success(`${filteredMovements.length} receipt(s) exported successfully`);
  };

  const paginatedMovements = filteredMovements.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const filteredDropdownItems = materials.filter(m =>
    m.item.toLowerCase().includes(itemSearch.toLowerCase()) ||
    (m.description && m.description.toLowerCase().includes(itemSearch.toLowerCase())) ||
    (m.subFamily && m.subFamily.toLowerCase().includes(itemSearch.toLowerCase()))
  );

  // Known sub-families list for datalist suggestions
  const existingSubFamilies = Array.from(new Set(materials.map(m => m.subFamily).filter(Boolean))) as string[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl">
        <div className="flex items-center gap-2.5">

        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            <Plus size={16} />
            <span>Add</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors shadow-2xs cursor-pointer"
          >
            <Upload size={15} className="text-gray-500" />
            <span>Import</span>
          </button>

          <button
            onClick={handleExportMovements}
            className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors shadow-2xs cursor-pointer"
            title="Export filtered data"
          >
            <FileSpreadsheet size={15} className="text-emerald-600" />
            <span>Exporter Excel</span>
          </button>

          <button
            onClick={loadData}
            className="p-2 bg-white hover:bg-gray-50 text-gray-600 border border-gray-300 rounded-xl text-xs font-semibold flex items-center transition-colors shadow-2xs cursor-pointer"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Movements History Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-gray-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Material Inputs History</h2>
            <p className="text-xs text-gray-500">
              {filteredMovements.length} input(s) found
            </p>
          </div>

          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => {
                setTableSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by item, desc, sub-family, location..."
              className="w-full pl-9 pr-3.5 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:border-blue-600 shadow-2xs"
            />
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/90 text-gray-600 uppercase font-semibold text-[11px] border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">SubFamily</th>
                <th className="px-4 py-3">Quantity In</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">By</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {paginatedMovements.length > 0 ? (
                paginatedMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-gray-400" />
                        {m.date}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md text-xs">
                        {m.itemRef}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate" title={m.description || ''}>
                      {m.description || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {m.subFamily ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                          <Tag size={10} />
                          {m.subFamily}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md">
                        +{m.quantity} {m.unit || 'kg'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {m.location ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={12} className="text-gray-400" /> {m.location}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <User size={12} className="text-gray-400" /> {m.performedBy || 'System'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 italic max-w-xs truncate" title={m.notes || ''}>
                      {m.notes || '—'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEditModal(m)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Modifier ce mouvement"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteMovement(m.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Annuler ce mouvement"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-gray-400">
                    {loading ? 'Loading receipts...' : 'Aucun mouvement d’entrée matière trouvé.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <TableFooter
          totalItems={filteredMovements.length}
          pageSize={pageSize}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* ── Modal: Ajouter une In ────────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">New Material Input</h3>
                  <p className="text-[11px] text-gray-500">Enregistrement d'une réception matière ou déchargement silo</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleManualSubmit} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Référence Article with Autocomplete */}
                <div className="sm:col-span-2 relative" ref={dropdownRef}>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Item <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={itemSearch}
                      onChange={(e) => {
                        setItemSearch(e.target.value);
                        setSelectedItem(e.target.value);
                        setIsDropdownOpen(true);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      placeholder="Tapez ou sélectionnez un article..."
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:border-blue-600 focus:bg-white transition-all uppercase font-mono"
                    />
                    <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>

                  {/* Dropdown Options */}
                  {isDropdownOpen && (
                    <div className="absolute z-20 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg text-xs divide-y divide-gray-50">
                      {filteredDropdownItems.length > 0 ? (
                        filteredDropdownItems.map((m) => (
                          <div
                            key={m.item}
                            onClick={() => handleSelectItem(m)}
                            className="px-3.5 py-2 hover:bg-emerald-50 cursor-pointer flex items-center justify-between"
                          >
                            <div>
                              <span className="font-bold text-gray-900 font-mono">{m.item}</span>
                              {m.description && <span className="text-gray-500 ml-2 text-[11px]">({m.description})</span>}
                              {m.subFamily && (
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
                                  {m.subFamily}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-bold font-mono">
                              Stock: {m.currentStock} {m.unit || 'kg'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-center text-gray-400 text-xs">
                          Nouvelle référence : <strong className="text-gray-700 uppercase font-mono">{itemSearch}</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: Polypropylène Homopolymère MFI 25..."
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:border-blue-600 focus:bg-white transition-all"
                  />
                </div>

                {/* Sous-Famille (Sub-Family) */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Sub-Family
                  </label>
                  <input
                    type="text"
                    list="subfamily-suggestions-input"
                    value={subFamily}
                    onChange={(e) => setSubFamily(e.target.value)}
                    placeholder="Ex: Matière Première, Colorant, Additif..."
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:border-blue-600 focus:bg-white transition-all"
                  />
                  <datalist id="subfamily-suggestions-input">
                    {existingSubFamilies.map(sf => (
                      <option key={sf} value={sf} />
                    ))}
                  </datalist>
                </div>

                {/* Quantité & Unité */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0.00"
                      className="flex-1 px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:border-blue-600 focus:bg-white transition-all font-mono"
                    />
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-24 px-2.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:border-blue-600 focus:bg-white"
                    >
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="t">t</option>
                      <option value="L">L</option>
                      <option value="pcs">pcs</option>
                      <option value="m">m</option>
                    </select>
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Location
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Ex: Silo A, Magasin MP..."
                      className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:border-blue-600 focus:bg-white transition-all"
                    />
                    <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Date de Réception
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:border-blue-600 focus:bg-white transition-all font-mono"
                    />
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>

                {/* Notes / BL */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Notes / BL
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex: BL-4521, Total Petrochem..."
                      className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:border-blue-600 focus:bg-white transition-all"
                    />
                    <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 bg-white hover:bg-gray-100 text-gray-700 font-semibold rounded-xl text-xs border border-gray-300 transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  {submitting ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  <span>Enregistrer l'In</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Importer Excel ────────────────────────────────────────────── */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Upload size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Import Materials (Excel / CSV)</h3>
                  <p className="text-[11px] text-gray-500">Intégration par lot de réceptions matières</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadTemplate}
                  className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Download Excel template"
                >
                  <Download size={14} className="text-gray-500" />
                  <span>Excel Template</span>
                </button>
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Dropzone */}
              <div className="border-2 border-dashed border-gray-200 hover:border-blue-400 rounded-2xl p-6 text-center bg-gray-50/50 transition-colors">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  id="excel-material-input-modal-upload"
                />
                <label htmlFor="excel-material-input-modal-upload" className="cursor-pointer space-y-2 block">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-xs">
                    <FileSpreadsheet size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-800">
                      {file ? file.name : 'Click to select Excel / CSV file'}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Colonnes : <span className="font-mono font-bold text-gray-600">Item, Description, SubFamily, Unit, Quantity, Location</span>
                    </p>
                  </div>
                </label>
              </div>

              {/* Preview Table Container */}
              {(previewRows.length > 0 || invalidRows.length > 0) && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-700">Total : {previewRows.length + invalidRows.length} lignes</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1 text-[11px]">
                        <CheckCircle2 size={12} /> {previewRows.length} valide(s)
                      </span>
                      {invalidRows.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold flex items-center gap-1 text-[11px]">
                          <AlertCircle size={12} /> {invalidRows.length} invalide(s)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-100 text-gray-600 uppercase font-semibold text-[10px] sticky top-0">
                        <tr>
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">Item</th>
                          <th className="px-3 py-2">Description</th>
                          <th className="px-3 py-2">SubFamily</th>
                          <th className="px-3 py-2">Quantity</th>
                          <th className="px-3 py-2">Location</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {previewRows.map((r, idx) => (
                          <tr key={`valid-${idx}`} className="hover:bg-emerald-50/40 transition-colors">
                            <td className="px-3 py-1.5 text-gray-400 font-mono">{r.index}</td>
                            <td className="px-3 py-1.5 font-bold text-gray-900 font-mono">{r.itemRef}</td>
                            <td className="px-3 py-1.5 text-gray-600 truncate max-w-xs">{r.description || '—'}</td>
                            <td className="px-3 py-1.5 text-gray-600">{r.subFamily || '—'}</td>
                            <td className="px-3 py-1.5 font-mono font-semibold text-emerald-700">+{r.quantity} {r.unit}</td>
                            <td className="px-3 py-1.5 text-gray-600">{r.location || '—'}</td>
                            <td className="px-3 py-1.5 font-mono text-gray-600">{r.date || '—'}</td>
                            <td className="px-3 py-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 size={10} /> Valide
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditPreviewRow(r, idx, false)}
                                  className="p-1 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors cursor-pointer"
                                  title="Modifier cette ligne avant validation"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePreviewRow(idx, false)}
                                  className="p-1 hover:bg-red-100 text-red-500 rounded-lg transition-colors cursor-pointer"
                                  title="Remove this row"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {invalidRows.map((r, idx) => (
                          <tr key={`invalid-${idx}`} className="bg-red-50/40 text-red-900">
                            <td className="px-3 py-1.5 text-red-400 font-mono">{r.index}</td>
                            <td className="px-3 py-1.5 font-bold font-mono">{r.itemRef}</td>
                            <td className="px-3 py-1.5 text-gray-600">{r.description || '—'}</td>
                            <td className="px-3 py-1.5 text-gray-600">{r.subFamily || '—'}</td>
                            <td className="px-3 py-1.5 font-mono">{r.quantity}</td>
                            <td className="px-3 py-1.5">{r.location || '—'}</td>
                            <td className="px-3 py-1.5 font-mono text-gray-600">{r.date || '—'}</td>
                            <td className="px-3 py-1.5 text-red-700 font-semibold text-[10px]">
                              {r.reason}
                            </td>
                            <td className="px-3 py-1.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditPreviewRow(r, idx, true)}
                                  className="p-1 hover:bg-amber-100 text-amber-700 rounded-lg transition-colors cursor-pointer"
                                  title="Corriger cette ligne pour la valider"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePreviewRow(idx, true)}
                                  className="p-1 hover:bg-red-100 text-red-500 rounded-lg transition-colors cursor-pointer"
                                  title="Remove this row"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 font-semibold rounded-xl text-xs border border-gray-300 transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleBatchCommit}
                  disabled={importing || previewRows.length === 0}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  {importing ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>Commit Import ({previewRows.length})</span>
                </button>
              </div>
            </div>

            {/* Quick Edit Preview Row Modal */}
            {editingPreviewRowIndex !== null && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-100 space-y-4 animate-in zoom-in-95">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <h4 className="text-sm font-black text-gray-900">
                      Modifier la ligne importée (#{isEditingInvalid ? (invalidRows[editingPreviewRowIndex]?.index || editingPreviewRowIndex + 1) : (previewRows[editingPreviewRowIndex]?.index || editingPreviewRowIndex + 1)})
                    </h4>
                    <button
                      type="button"
                      onClick={() => setEditingPreviewRowIndex(null)}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Item Ref *</label>
                      <input
                        type="text"
                        value={editPreviewForm.itemRef}
                        onChange={e => setEditPreviewForm({ ...editPreviewForm, itemRef: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-mono uppercase font-bold"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-bold text-gray-700 block mb-1">Quantity *</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={editPreviewForm.quantity}
                          onChange={e => setEditPreviewForm({ ...editPreviewForm, quantity: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-gray-700 block mb-1">Unit</label>
                        <input
                          type="text"
                          value={editPreviewForm.unit}
                          onChange={e => setEditPreviewForm({ ...editPreviewForm, unit: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Description</label>
                      <input
                        type="text"
                        value={editPreviewForm.description}
                        onChange={e => setEditPreviewForm({ ...editPreviewForm, description: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-bold text-gray-700 block mb-1">Sub-Family</label>
                        <input
                          type="text"
                          value={editPreviewForm.subFamily}
                          onChange={e => setEditPreviewForm({ ...editPreviewForm, subFamily: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-gray-700 block mb-1">Location</label>
                        <input
                          type="text"
                          value={editPreviewForm.location}
                          onChange={e => setEditPreviewForm({ ...editPreviewForm, location: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Notes</label>
                      <input
                        type="text"
                        value={editPreviewForm.notes}
                        onChange={e => setEditPreviewForm({ ...editPreviewForm, notes: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Date</label>
                      <input
                        type="date"
                        value={editPreviewForm.date}
                        onChange={e => setEditPreviewForm({ ...editPreviewForm, date: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setEditingPreviewRowIndex(null)}
                      className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEditPreviewRow}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Modifier une In */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Edit2 size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Edit Material Input</h3>
                  <p className="text-[11px] text-gray-500">Mise à jour du mouvement d'entrée matière</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleEditSubmit} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Référence Article */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Item Ref <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editItemRef}
                    onChange={(e) => setEditItemRef(e.target.value.toUpperCase())}
                    placeholder="EX: MAT-001"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:border-blue-600 focus:bg-white transition-all uppercase font-mono"
                  />
                </div>

                {/* Description */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Description de la matière..."
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:border-blue-600 focus:bg-white transition-all"
                  />
                </div>

                {/* Sous-famille */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Sub-Family
                  </label>
                  <input
                    type="text"
                    list="edit-subfamilies-list"
                    value={editSubFamily}
                    onChange={(e) => setEditSubFamily(e.target.value)}
                    placeholder="ex: PP, PEHD, COLORANT..."
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:border-blue-600 focus:bg-white transition-all"
                  />
                  <datalist id="edit-subfamilies-list">
                    {existingSubFamilies.map((sf, idx) => (
                      <option key={idx} value={sf} />
                    ))}
                  </datalist>
                </div>

                {/* Emplacement */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="ex: Magasin MP, Allée A..."
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:border-blue-600 focus:bg-white transition-all"
                  />
                </div>

                {/* Quantité */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Quantity In <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:border-blue-600 focus:bg-white transition-all font-mono"
                  />
                </div>

                {/* Unité */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Unit
                  </label>
                  <select
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:border-blue-600 focus:bg-white transition-all"
                  >
                    <option value="kg">kg (Kilogrammes)</option>
                    <option value="g">g (Grammes)</option>
                    <option value="pcs">pcs (Pièces)</option>
                    <option value="sac">sac (Sacs)</option>
                    <option value="L">L (Litres)</option>
                    <option value="m">m (Mètres)</option>
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:border-blue-600 focus:bg-white transition-all font-mono"
                  />
                </div>

                {/* Enregistré Par */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Performed By
                  </label>
                  <input
                    type="text"
                    value={editPerformedBy}
                    onChange={(e) => setEditPerformedBy(e.target.value)}
                    placeholder="Operator / manager name"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:border-blue-600 focus:bg-white transition-all"
                  />
                </div>

                {/* Remarques */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="N° BL fournisseur, remarques qualité, etc."
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:border-blue-600 focus:bg-white transition-all resize-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 font-semibold rounded-xl text-xs border border-gray-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  {editSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export { MaterialInput };
