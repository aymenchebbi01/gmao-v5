import React, { useState, useMemo, useEffect } from 'react';
import {
  Wrench,
  Plus,
  Search,
  Box,
  Building2,
  Image as ImageIcon,
  Upload,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  Download,
  X,
  Save,
  Check,
  RotateCw,
  ArrowLeft,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { Mold, MoldMaintenance, RepairLocation, MoldMaintenanceStatus, AppUser } from '../types/gmao';
import { PaginationBar } from '../components/PaginationBar';
import { generateMoldMaintenancePdf } from '../lib/moldMaintenancePdf';
import { sqliteApi } from '../services/sqliteApi';
import { toast } from 'sonner';

interface MoldMaintenanceViewProps {
  molds: Mold[];
  initialRecords?: MoldMaintenance[];
  onRecordsChange?: (records: MoldMaintenance[]) => void;
  onDeleteRecord?: (id: string) => void;
  onSaveRecord?: (record: MoldMaintenance) => void;
  currentUser?: AppUser;
}

export const MoldMaintenanceView: React.FC<MoldMaintenanceViewProps> = ({
  molds,
  initialRecords = [],
  onRecordsChange,
  onDeleteRecord,
  onSaveRecord,
  currentUser,
}) => {
  const canEdit =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'responsable maintenance' ||
    currentUser?.role === 'responsable technique' ||
    currentUser?.role === 'technician';

  const [records, setRecords] = useState<MoldMaintenance[]>(initialRecords);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Sync records with initialRecords prop when it changes
  useEffect(() => {
    if (initialRecords) {
      setRecords(initialRecords);
    }
  }, [initialRecords]);

  // Confirmation modal state for deletion
  const [recordToDelete, setRecordToDelete] = useState<MoldMaintenance | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form View State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Form Data
  const [formData, setFormData] = useState<{
    id: string;
    moldId: string;
    moldNumber: string;
    date: string;
    repairLocation: RepairLocation;
    status: MoldMaintenanceStatus;
    issueDescription: string;
    supplierName: string;
    devisUrl: string;
    actionsPerformed: string[];
    imageUrl: string;
  }>({
    id: '',
    moldId: molds[0]?.id || '',
    moldNumber: molds[0]?.moldNumber || molds[0]?.ref || 'MLD-405',
    date: new Date().toISOString().split('T')[0],
    repairLocation: 'local',
    status: 'in_progress',
    issueDescription: '',
    supplierName: '',
    devisUrl: '',
    actionsPerformed: [''],
    imageUrl: '',
  });

  // Close-out Modal State (Matching User's Provided Code)
  const [recordToClose, setRecordToClose] = useState<MoldMaintenance | null>(null);
  const [closeStatusChoice, setCloseStatusChoice] = useState<'In Stock' | 'In Use'>('In Stock');

  const handleOpenCreateForm = () => {
    setRecordToClose(null);
    setIsEditMode(false);
    setFormData({
      id: '',
      moldId: molds[0]?.id || '',
      moldNumber: molds[0]?.moldNumber || molds[0]?.ref || 'MLD-405',
      date: new Date().toISOString().split('T')[0],
      repairLocation: 'local',
      status: 'in_progress',
      issueDescription: '',
      supplierName: '',
      devisUrl: '',
      actionsPerformed: [''],
      imageUrl: '',
    });
    setIsFormOpen(true);
  };

  const handleEditClick = (record: MoldMaintenance) => {
    setRecordToClose(null);
    setIsEditMode(true);
    setFormData({
      id: record.id,
      moldId: record.moldId,
      moldNumber: record.moldNumber,
      date: record.date || new Date().toISOString().split('T')[0],
      repairLocation: record.repairLocation || 'local',
      status: record.status || 'in_progress',
      issueDescription: record.issueDescription || '',
      supplierName: record.supplierName || '',
      devisUrl: record.devisUrl || '',
      actionsPerformed:
        record.actionsPerformed && record.actionsPerformed.length > 0
          ? record.actionsPerformed
          : [''],
      imageUrl: record.imageUrl || '',
    });
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setIsEditMode(false);
  };

  const handleAddActionField = () => {
    setFormData((prev) => ({
      ...prev,
      actionsPerformed: [...prev.actionsPerformed, ''],
    }));
  };

  const handleRemoveActionField = (index: number) => {
    if (formData.actionsPerformed.length === 1) {
      setFormData((prev) => ({ ...prev, actionsPerformed: [''] }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      actionsPerformed: prev.actionsPerformed.filter((_, i) => i !== index),
    }));
  };

  const handleActionTextChange = (index: number, val: string) => {
    const updated = [...formData.actionsPerformed];
    updated[index] = val;
    setFormData((prev) => ({ ...prev, actionsPerformed: updated }));
  };

  const handleSaveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.moldId) return;
    if (!formData.issueDescription.trim()) return;

    const moldObj = molds.find((m) => m.id === formData.moldId);
    const moldNum = moldObj ? moldObj.moldNumber || moldObj.ref || 'MLD-XXX' : formData.moldNumber;
    const cleanActions = formData.actionsPerformed.map((a) => a.trim()).filter(Boolean);

    if (isEditMode && formData.id) {
      const updatedRecord: MoldMaintenance = {
        id: formData.id,
        moldId: formData.moldId,
        moldNumber: moldNum,
        date: formData.date,
        repairLocation: formData.repairLocation,
        status: formData.status,
        issueDescription: formData.issueDescription.trim(),
        supplierName: formData.repairLocation === 'external' ? formData.supplierName.trim() : undefined,
        devisUrl: formData.repairLocation === 'external' ? formData.devisUrl : undefined,
        actionsPerformed: cleanActions.length > 0 ? cleanActions : ['Maintenance effectuée'],
        imageUrl: formData.imageUrl || undefined,
      };

      const updatedList = records.map((r) => (r.id === formData.id ? updatedRecord : r));
      setRecords(updatedList);
      if (onRecordsChange) onRecordsChange(updatedList);
      if (onSaveRecord) onSaveRecord(updatedRecord);

      try {
        await sqliteApi.saveMoldMaintenance(updatedRecord);
        toast.success(`Fiche de maintenance ${moldNum} mise à jour avec succès.`);
      } catch (err) {
        console.error('[SQLite] Error updating mold maintenance:', err);
      }
    } else {
      const newRec: MoldMaintenance = {
        id: `mm-${Date.now()}`,
        moldId: formData.moldId,
        moldNumber: moldNum,
        date: formData.date,
        repairLocation: formData.repairLocation,
        status: 'in_progress',
        issueDescription: formData.issueDescription.trim(),
        supplierName: formData.repairLocation === 'external' ? formData.supplierName.trim() : undefined,
        devisUrl: formData.repairLocation === 'external' ? formData.devisUrl : undefined,
        actionsPerformed: cleanActions.length > 0 ? cleanActions : ['Maintenance ouverte'],
        imageUrl: formData.imageUrl || undefined,
        costTnd: formData.repairLocation === 'external' ? 850 : 250,
      };

      const updatedList = [newRec, ...records];
      setRecords(updatedList);
      if (onRecordsChange) onRecordsChange(updatedList);
      if (onSaveRecord) onSaveRecord(newRec);

      // Update mold status to 'In Toolroom'
      const targetMold = molds.find((m) => m.id === formData.moldId);
      if (targetMold) {
        targetMold.status = 'In Toolroom';
      }

      try {
        await sqliteApi.createMoldMaintenance(newRec);
        toast.success(`Nouvelle fiche de maintenance ${moldNum} créée avec succès.`);
      } catch (err) {
        console.error('[SQLite] Error creating mold maintenance:', err);
      }
    }

    handleCloseForm();
  };

  const handleOpenCloseCard = (record: MoldMaintenance) => {
    setRecordToClose(record);
    setCloseStatusChoice('In Stock');
  };

  const handleConfirmClose = async () => {
    if (!recordToClose) return;

    const completedRecord: MoldMaintenance = {
      ...recordToClose,
      status: 'completed',
      closedStatusChoice: closeStatusChoice,
      completedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };

    const updatedList = records.map((r) => (r.id === recordToClose.id ? completedRecord : r));
    setRecords(updatedList);
    if (onRecordsChange) onRecordsChange(updatedList);
    if (onSaveRecord) onSaveRecord(completedRecord);

    // Synchronize mold status based on choice
    const targetMold = molds.find((m) => m.id === recordToClose.moldId || (m.moldNumber || m.ref) === recordToClose.moldNumber);
    if (targetMold) {
      targetMold.status = closeStatusChoice;
    }

    try {
      await sqliteApi.saveMoldMaintenance(completedRecord);
      toast.success(`Maintenance du moule ${completedRecord.moldNumber} clôturée.`);
    } catch (err) {
      console.error('[SQLite] Error saving closed mold maintenance:', err);
    }

    setRecordToClose(null);
  };

  const handleRequestDelete = (record: MoldMaintenance) => {
    setRecordToDelete(record);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    setIsDeleting(true);
    const targetId = recordToDelete.id;
    const moldNum = recordToDelete.moldNumber || 'Moule';

    try {
      const updatedList = records.filter((r) => r.id !== targetId);
      setRecords(updatedList);
      if (onDeleteRecord) onDeleteRecord(targetId);
      if (onRecordsChange) onRecordsChange(updatedList);

      await sqliteApi.deleteMoldMaintenance(targetId);
      toast.success(`Fiche de maintenance du moule ${moldNum} supprimée définitivement.`);
    } catch (err: any) {
      console.error('[SQLite] Error deleting mold maintenance:', err);
      toast.error(`Erreur lors de la suppression : ${err?.message || 'Erreur SQLite'}`);
    } finally {
      setIsDeleting(false);
      setRecordToDelete(null);
    }
  };

  // Filter records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        (r.moldNumber || '').toLowerCase().includes(term) ||
        (r.issueDescription || '').toLowerCase().includes(term) ||
        (r.supplierName || '').toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [records, searchTerm, statusFilter]);

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto select-none relative min-h-[700px]">
      {/* List View */}
      <div className={`space-y-6 transition-all duration-300 ${isFormOpen || recordToClose ? 'blur-sm opacity-30 pointer-events-none' : ''}`}>
        {/* Header matching user's architecture */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-neutral-300 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200">
              <Wrench size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-neutral-900 tracking-tight">
                Mold Maintenance (Toolroom)
              </h1>
              <p className="text-xs text-neutral-500 font-medium">
                Toolroom tickets, in-house repairs, subcontractor quotes, and signoff
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {canEdit && (
              <button
                onClick={handleOpenCreateForm}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-all shadow-md shadow-purple-500/20 active:scale-95 cursor-pointer"
              >
                <Plus size={16} />
                <span>New Mold Maintenance</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter & Search */}
        <div className="bg-white p-4 rounded-2xl border border-neutral-300 shadow-xs flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
            <input
              type="text"
              placeholder="Search by mold number, problem, subcontractor..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500/20 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            {(['all', 'in_progress', 'completed'] as const).map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 font-bold rounded-xl transition-all capitalize cursor-pointer ${
                  statusFilter === st
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {st === 'all' ? 'Toutes' : st === 'in_progress' ? 'En Cours' : 'Clôturées'}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between min-h-[480px]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  <th className="px-6 py-4">Mold N°</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Repair Location</th>
                  <th className="px-6 py-4">Description Problème</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-medium text-neutral-800">
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-neutral-500">
                      No mold maintenance records found.
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((record) => {
                    const moldObj = molds.find(
                      (m) => m.id === record.moldId || (m.moldNumber || m.ref) === record.moldNumber
                    );

                    return (
                      <tr key={record.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className="font-mono font-black text-purple-700 text-sm block">
                            {record.moldNumber}
                          </span>
                          {record.workOrderId && (
                            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 inline-block mt-0.5">
                              OT: {record.workOrderId}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-neutral-700">{record.date}</td>
                        <td className="px-5 py-3.5">
                          {record.repairLocation === 'external' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-800 border border-purple-300 rounded-full font-bold">
                              <Building2 size={12} />
                              <span>Externe {record.supplierName ? `(${record.supplierName})` : ''}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-200 text-neutral-800 border border-neutral-300 rounded-full font-bold">
                              <Wrench size={12} />
                              <span>Interne (Atelier)</span>
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 max-w-xs">
                          <p className="font-semibold text-neutral-900 truncate" title={record.issueDescription}>
                            {record.issueDescription}
                          </p>
                          {record.actionsPerformed && record.actionsPerformed.length > 0 && (
                            <span className="text-[11px] text-neutral-500 block truncate">
                              ✓ {record.actionsPerformed[0]}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {record.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full font-bold">
                              <CheckCircle2 size={12} />
                              <span>Clôturée ({record.closedStatusChoice || 'En Stock'})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-full font-bold">
                              <Clock size={12} />
                              <span>En Cours</span>
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => generateMoldMaintenancePdf(record, moldObj)}
                              className="p-1.5 text-neutral-600 hover:text-purple-700 bg-white rounded-lg border border-neutral-300 shadow-2xs cursor-pointer"
                              title="Télécharger Fiche PDF"
                            >
                              <Download size={14} />
                            </button>

                            {record.status === 'in_progress' && canEdit && (
                              <button
                                type="button"
                                onClick={() => handleOpenCloseCard(record)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                                title="Clôturer cette maintenance"
                              >
                                <CheckCircle2 size={13} />
                                <span>Clôturer</span>
                              </button>
                            )}

                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleEditClick(record)}
                                className="p-1.5 text-neutral-600 hover:text-blue-700 bg-white rounded-lg border border-neutral-300 shadow-2xs cursor-pointer"
                                title="Modifier"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}

                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleRequestDelete(record)}
                                className="p-1.5 text-neutral-400 hover:text-red-700 bg-white rounded-lg border border-neutral-300 shadow-2xs cursor-pointer"
                                title="Supprimer la fiche"
                              >
                                <Trash2 size={14} />
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

          <PaginationBar
            totalItems={filteredRecords.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {/* ── CLOSEOUT VIEW OVERLAY (Matching User's Provided Code) ── */}
      {recordToClose && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-8 shadow-2xl border border-neutral-300 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-xl font-black text-neutral-900 flex items-center gap-2">
                  <CheckCircle2 className="text-emerald-600" size={24} />
                  <span>Close Maintenance: Mold {recordToClose.moldNumber}</span>
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Define the status of the mold upon exit from repair before confirming signoff.
                </p>
              </div>
              <button onClick={() => setRecordToClose(null)} className="p-1 text-neutral-400 hover:text-neutral-900">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setCloseStatusChoice('In Stock')}
                className={`p-5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                  closeStatusChoice === 'In Stock'
                    ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-sm'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <Box className="w-5 h-5 text-blue-600" />
                  <span className="font-bold text-sm">En Stock (In Stock)</span>
                </div>
                <p className="text-xs text-neutral-500">
                  The mold is successfully repaired and stored in its rack/toolroom, ready for the next production order.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setCloseStatusChoice('In Use')}
                className={`p-5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                  closeStatusChoice === 'In Use'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-900 shadow-sm'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-sm">En Utilisation (In Use)</span>
                </div>
                <p className="text-xs text-neutral-500">
                  The mold is directly mounted and operational on the injection press to continue or start production.
                </p>
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => setRecordToClose(null)}
                className="px-5 py-2.5 bg-neutral-100 text-neutral-700 font-bold rounded-xl text-xs hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmClose}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Check size={16} />
                <span>Confirmer la Clôture de la Maintenance</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FORM VIEW OVERLAY (New / Edit Maintenance Ticket) ── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-8 shadow-2xl border border-neutral-300 space-y-6 my-8">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-xl font-black text-neutral-900">
                  {isEditMode ? `Edit Maintenance: Mold ${formData.moldNumber}` : 'New Mold Maintenance Record'}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {isEditMode ? 'Modifier les détails et travaux d intervention.' : 'Ouvrir une fiche de maintenance interne ou sous-traitée.'}
                </p>
              </div>
              <button onClick={handleCloseForm} className="p-1 text-neutral-400 hover:text-neutral-900">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveMaintenance} className="space-y-5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Concerned Mold *:</label>
                  <select
                    required
                    value={formData.moldId}
                    onChange={(e) => {
                      const sel = molds.find((m) => m.id === e.target.value);
                      setFormData({
                        ...formData,
                        moldId: e.target.value,
                        moldNumber: sel ? sel.moldNumber || sel.ref || '' : '',
                      });
                    }}
                    className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl font-bold font-mono"
                  >
                    {molds.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.moldNumber || m.ref} - {m.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Date d&apos;Intervention * :</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">Repair Location *:</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, repairLocation: 'local' })}
                      className={`p-2 rounded-xl font-bold border transition-all ${
                        formData.repairLocation === 'local'
                          ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                          : 'bg-white text-neutral-700 border-neutral-300'
                      }`}
                    >
                      Interne
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, repairLocation: 'external' })}
                      className={`p-2 rounded-xl font-bold border transition-all ${
                        formData.repairLocation === 'external'
                          ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                          : 'bg-white text-neutral-700 border-neutral-300'
                      }`}
                    >
                      Externe
                    </button>
                  </div>
                </div>
              </div>

              {formData.repairLocation === 'external' && (
                <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-purple-900 block mb-1">Nom du Sous-traitant :</label>
                      <input
                        type="text"
                        placeholder="e.g.: MouleTech Precision Tunisie"
                        value={formData.supplierName}
                        onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                        className="w-full p-2 bg-white border border-purple-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-purple-900 block mb-1">Réf Devis Estimatif :</label>
                      <input
                        type="text"
                        placeholder="ex: DEV-2026-OUT-089"
                        value={formData.devisUrl}
                        onChange={(e) => setFormData({ ...formData, devisUrl: e.target.value })}
                        className="w-full p-2 bg-white border border-purple-300 rounded-xl font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="font-bold text-neutral-700 block mb-1">
                  Description de la Défaillance / Problème * :
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="ex: Empreinte N°2 rayée, fuite sur le circuit de refroidissement, tiroir bloqué..."
                  value={formData.issueDescription}
                  onChange={(e) => setFormData({ ...formData, issueDescription: e.target.value })}
                  className="w-full p-3 bg-neutral-50 border border-neutral-300 rounded-xl"
                />
              </div>

              {/* Repeatable Actions List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-neutral-700">Actions &amp; Travaux Réalisés :</label>
                  <button
                    type="button"
                    onClick={handleAddActionField}
                    className="text-xs font-bold text-purple-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={14} /> Add row
                  </button>
                </div>
                {formData.actionsPerformed.map((act, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-5 text-neutral-400 font-bold">{idx + 1}.</span>
                    <input
                      type="text"
                      placeholder="ex: Polissage empreinte, remplacement joint torique..."
                      value={act}
                      onChange={(e) => handleActionTextChange(idx, e.target.value)}
                      className="flex-1 p-2 bg-neutral-50 border border-neutral-300 rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveActionField(idx)}
                      className="text-neutral-400 hover:text-red-600 p-1 cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-5 py-2.5 bg-neutral-100 text-neutral-700 font-bold rounded-xl text-xs hover:bg-neutral-200 transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs shadow-md shadow-purple-500/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Save size={16} />
                  <span>Save Mold Maintenance</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Permanent Deletion */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-300 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-neutral-900">
                  Supprimer la fiche de maintenance ?
                </h3>
                <p className="text-xs text-neutral-500">
                  Moule : <span className="font-mono font-bold text-neutral-800">{recordToDelete.moldNumber}</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed bg-neutral-50 p-3 rounded-xl border border-neutral-200">
              Êtes-vous certain de vouloir supprimer cette fiche de maintenance ? Cette opération supprimera définitivement l'enregistrement de la base de données SQLite.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md shadow-red-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Trash2 size={15} />
                <span>{isDeleting ? 'Suppression en cours...' : 'Supprimer définitivement'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
