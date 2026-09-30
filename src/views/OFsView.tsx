import React, { useState, useMemo } from 'react';
import {
  FileText,
  Upload,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Download,
  Trash2,
  Edit2,
  Filter,
  Check,
  X,
  Layers,
  ArrowRight,
  ExternalLink,
  FileSpreadsheet,
} from 'lucide-react';
import { ProductionOrderOF, Machine, Mold, AppUser } from '../types/gmao';
import { ThermoplasticsLogo } from '../components/ThermoplasticsLogo';
import { PaginationBar } from '../components/PaginationBar';
import { exportToXLSX } from '../lib/exportUtils';
import { sqliteApi } from '../services/sqliteApi';
import { generateNextOFRef } from '../lib/gmaoUtils';
import { toast } from 'sonner';

interface OFsViewProps {
  ofs: ProductionOrderOF[];
  machines: Machine[];
  molds: Mold[];
  currentUser?: AppUser;
  onSaveOF: (ofItem: ProductionOrderOF) => void;
  onUpdateOF: (id: string, updates: Partial<ProductionOrderOF>) => void;
  onDeleteOF: (id: string) => void;
}

export const OFsView: React.FC<OFsViewProps> = ({
  ofs,
  machines,
  molds,
  currentUser,
  onSaveOF,
  onUpdateOF,
  onDeleteOF,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'In Progress' | 'Done'>('All');
  const [machineFilter, setMachineFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Import / Create / Edit Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingOF, setEditingOF] = useState<ProductionOrderOF | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Form fields
  const [formData, setFormData] = useState<{
    ofNumber: string;
    title: string;
    machineId: string;
    moldId: string;
    targetQuantity: number;
    priority: 'Normal' | 'Urgent' | 'High';
    dueDate: string;
    notes: string;
    pdfUrl?: string;
    pdfFileName?: string;
    pdfFileSize?: number;
  }>({
    ofNumber: '',
    title: '',
    machineId: '',
    moldId: '',
    targetQuantity: 1000,
    priority: 'Normal',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    notes: '',
  });

  // PDF Preview Modal State
  const [previewPdfOF, setPreviewPdfOF] = useState<ProductionOrderOF | null>(null);

  // Filtered OFs
  const filteredOFs = useMemo(() => {
    return ofs.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        item.ofNumber.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        (item.machineName && item.machineName.toLowerCase().includes(q)) ||
        (item.moldName && item.moldName.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q));

      const matchStatus = statusFilter === 'All' || item.status === statusFilter;
      const matchMachine = machineFilter === 'All' || item.machineId === machineFilter;

      return matchSearch && matchStatus && matchMachine;
    });
  }, [ofs, searchQuery, statusFilter, machineFilter]);

  const paginatedOFs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOFs.slice(start, start + pageSize);
  }, [filteredOFs, currentPage, pageSize]);

  // Statistics
  const totalCount = ofs.length;
  const pendingCount = ofs.filter((o) => o.status === 'Pending').length;
  const inProgressCount = ofs.filter((o) => o.status === 'In Progress').length;
  const doneCount = ofs.filter((o) => o.status === 'Done').length;

  const handleOpenImport = () => {
    setEditingOF(null);
    const nextNum = generateNextOFRef(ofs);
    setFormData({
      ofNumber: nextNum,
      title: '',
      machineId: machines[0]?.id || '',
      moldId: molds[0]?.id || '',
      targetQuantity: 1000,
      priority: 'Normal',
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      notes: '',
      pdfUrl: undefined,
      pdfFileName: undefined,
      pdfFileSize: undefined,
    });
    setSelectedFile(null);
    setIsImportModalOpen(true);
  };

  const handleOpenEdit = (ofItem: ProductionOrderOF) => {
    setEditingOF(ofItem);
    setFormData({
      ofNumber: ofItem.ofNumber,
      title: ofItem.title,
      machineId: ofItem.machineId || machines[0]?.id || '',
      moldId: ofItem.moldId || molds[0]?.id || '',
      targetQuantity: ofItem.targetQuantity || 1000,
      priority: ofItem.priority || 'Normal',
      dueDate: ofItem.dueDate || new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      notes: ofItem.notes || '',
      pdfUrl: ofItem.pdfUrl,
      pdfFileName: ofItem.pdfFileName,
      pdfFileSize: ofItem.pdfFileSize,
    });
    setSelectedFile(null);
    setIsImportModalOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      toast.error('Veuillez sélectionner un fichier au format PDF.');
      return;
    }

    setSelectedFile(file);
    // Auto-fill title from filename if title empty
    if (!formData.title) {
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setFormData((prev) => ({ ...prev, title: cleanTitle }));
    }
  };

  const handleSubmitImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ofNumber.trim() || !formData.title.trim()) {
      toast.error('Veuillez renseigner le N° OF et la désignation.');
      return;
    }

    let uploadedPdfUrl = formData.pdfUrl;
    let fileName = formData.pdfFileName;
    let fileSize = formData.pdfFileSize;

    if (selectedFile) {
      setIsUploading(true);
      try {
        const uploadRes = await sqliteApi.uploadPdf(selectedFile);
        uploadedPdfUrl = uploadRes.url;
        fileName = selectedFile.name;
        fileSize = selectedFile.size;
        toast.success('Rapport PDF importé et rattaché avec succès.');
      } catch (err: any) {
        console.warn('PDF upload warning, using local data URL fallback:', err);
        // Fallback to data URL
        const reader = new FileReader();
        uploadedPdfUrl = await new Promise<string>((res) => {
          reader.onload = () => res(reader.result as string);
          reader.readAsDataURL(selectedFile);
        });
        fileName = selectedFile.name;
        fileSize = selectedFile.size;
      } finally {
        setIsUploading(false);
      }
    }

    const selMach = machines.find((m) => m.id === formData.machineId);
    const selMold = molds.find((m) => m.id === formData.moldId);
    const finalOfNumber = (formData.ofNumber.trim() || generateNextOFRef(ofs, formData.dueDate)).toUpperCase();

    if (editingOF) {
      const updates: Partial<ProductionOrderOF> = {
        ofNumber: finalOfNumber,
        title: formData.title.trim(),
        machineId: formData.machineId || undefined,
        machineName: selMach ? `${selMach.number} — ${selMach.name || selMach.brand}` : undefined,
        moldId: formData.moldId || undefined,
        moldName: selMold ? `${selMold.moldNumber || selMold.ref} (${selMold.customer || 'Standard'})` : undefined,
        targetQuantity: Number(formData.targetQuantity) || 1000,
        dueDate: formData.dueDate,
        priority: formData.priority,
        pdfUrl: uploadedPdfUrl,
        pdfFileName: fileName,
        pdfFileSize: fileSize,
        notes: formData.notes.trim() || undefined,
      };
      onUpdateOF(editingOF.id, updates);
      setIsImportModalOpen(false);
      setEditingOF(null);
      toast.success(`Ordre de fabrication ${finalOfNumber} mis à jour avec succès.`);
      return;
    }

    const newOF: ProductionOrderOF = {
      id: `of-${Date.now()}`,
      ofNumber: finalOfNumber,
      title: formData.title.trim(),
      machineId: formData.machineId || undefined,
      machineName: selMach ? `${selMach.number} — ${selMach.name || selMach.brand}` : undefined,
      moldId: formData.moldId || undefined,
      moldName: selMold ? `${selMold.moldNumber || selMold.ref} (${selMold.customer || 'Standard'})` : undefined,
      targetQuantity: Number(formData.targetQuantity) || 1000,
      producedQuantity: 0,
      date: new Date().toISOString().split('T')[0],
      dueDate: formData.dueDate,
      priority: formData.priority,
      pdfUrl: uploadedPdfUrl,
      pdfFileName: fileName,
      pdfFileSize: fileSize,
      importedBy: currentUser?.name || 'Administrateur',
      importedAt: new Date().toISOString(),
      notes: formData.notes.trim() || undefined,
      status: 'Pending',
    };

    onSaveOF(newOF);
    setIsImportModalOpen(false);
    toast.success(`Ordre de fabrication ${newOF.ofNumber} créé avec succès.`);
  };

  const handleStatusChange = (ofItem: ProductionOrderOF, newStatus: 'Pending' | 'In Progress' | 'Done') => {
    const updates: Partial<ProductionOrderOF> = {
      status: newStatus,
    };
    if (newStatus === 'Done') {
      updates.completedAt = new Date().toISOString();
      updates.completedBy = currentUser?.name || 'Utilisateur';
    }
    onUpdateOF(ofItem.id, updates);
    toast.success(`Statut de ${ofItem.ofNumber} mis à jour : ${newStatus}`);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-200">
      {/* Official Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-300 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <ThermoplasticsLogo size="md" />
          <div className="text-xs text-neutral-500 font-mono pt-1">
            Gestion de Production &amp; Ordres de Fabrication (OFs) · Importation et Suivi des Rapports PDF
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => {
              const exportData = filteredOFs.map((o) => ({
                'N° OF': o.ofNumber,
                Date: o.date,
                Échéance: o.dueDate || '-',
                Désignation: o.title,
                Machine: o.machineName || '-',
                Moule: o.moldName || '-',
                'Qté Cible': o.targetQuantity || 0,
                'Qté Réalisée': o.producedQuantity || 0,
                Priorité: o.priority || 'Normal',
                Statut: o.status,
                'Fichier PDF': o.pdfFileName || (o.pdfUrl ? 'PDF attaché' : 'Non'),
                'Importé par': o.importedBy || '-',
                'Terminé le': o.completedAt || '-',
              }));
              exportToXLSX(exportData, `GMAO_OFs_${new Date().toISOString().slice(0, 10)}.xlsx`, 'OFs Production');
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-neutral-100 text-neutral-800 font-bold text-xs rounded-xl border border-neutral-300 transition-all shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleOpenImport}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>+ Importer un Rapport OF (PDF)</span>
          </button>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-neutral-300 shadow-2xs">
          <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">Total OFs</span>
          <span className="text-2xl font-black text-neutral-900 font-mono mt-1 block">{totalCount}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-neutral-300 shadow-2xs">
          <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">En Attente</span>
          <span className="text-2xl font-black text-amber-600 font-mono mt-1 block">{pendingCount}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-neutral-300 shadow-2xs">
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">En Cours Atelier</span>
          <span className="text-2xl font-black text-blue-700 font-mono mt-1 block">{inProgressCount}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-neutral-300 shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Terminés (Done)</span>
          <span className="text-2xl font-black text-emerald-700 font-mono mt-1 block">{doneCount}</span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-neutral-300 shadow-2xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-1 items-center gap-3 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher par N° OF, désignation, machine, moule..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl font-medium text-neutral-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="w-4 h-4 text-neutral-500" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl font-bold text-neutral-800"
            >
              <option value="All">Tous les statuts</option>
              <option value="Pending">En attente</option>
              <option value="In Progress">En cours</option>
              <option value="Done">Terminés</option>
            </select>
          </div>

          <div className="hidden sm:flex items-center shrink-0">
            <select
              value={machineFilter}
              onChange={(e) => {
                setMachineFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl font-semibold text-neutral-800"
            >
              <option value="All">Toutes les machines</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.number} — {m.name || m.brand}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-[#ebeeed] rounded-3xl border border-neutral-400/80 shadow-xs overflow-hidden flex flex-col justify-between min-h-[460px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-300 text-xs font-bold text-neutral-900 bg-black/5 uppercase tracking-wider">
                <th className="py-3.5 px-5">N° OF</th>
                <th className="py-3.5 px-5">Date / Échéance</th>
                <th className="py-3.5 px-6">Désignation / Pièce</th>
                <th className="py-3.5 px-5">Machine &amp; Moule</th>
                <th className="py-3.5 px-5 text-center">Quantité</th>
                <th className="py-3.5 px-5 text-center">Statut</th>
                <th className="py-3.5 px-5">Rapport PDF</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-300/70 text-xs font-medium text-neutral-800">
              {paginatedOFs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-500 font-medium">
                    Aucun ordre de fabrication (OF) trouvé. Cliquez sur &quot;+ Importer un Rapport OF (PDF)&quot; pour en ajouter un.
                  </td>
                </tr>
              ) : (
                paginatedOFs.map((item) => (
                  <tr key={item.id} className="hover:bg-white/50 transition-colors">
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <div className="font-mono font-black text-blue-700 text-sm">
                        {item.ofNumber}
                      </div>
                      {item.priority === 'Urgent' && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-red-100 text-red-800 text-[10px] font-bold">
                          Urgent
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <div className="font-mono text-neutral-700">{item.date}</div>
                      {item.dueDate && (
                        <div className="text-[11px] text-neutral-500 flex items-center gap-1 mt-0.5">
                          <span>Échéance:</span>
                          <span className="font-semibold text-neutral-800">{item.dueDate}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-6 max-w-xs">
                      <div className="font-bold text-neutral-900 text-sm">{item.title}</div>
                      {item.notes && (
                        <div className="text-[11px] text-neutral-500 truncate mt-0.5">{item.notes}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-5 max-w-xs">
                      <div className="font-semibold text-neutral-900">{item.machineName || 'Non assignée'}</div>
                      <div className="text-[11px] text-neutral-600 truncate">{item.moldName || 'Moule standard'}</div>
                    </td>
                    <td className="py-3.5 px-5 text-center font-mono">
                      <span className="font-bold text-neutral-900">
                        {(item.targetQuantity || 0).toLocaleString()}
                      </span>{' '}
                      <span className="text-neutral-500 text-[11px]">pcs</span>
                    </td>
                    <td className="py-3.5 px-5 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                          item.status === 'Done'
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : item.status === 'In Progress'
                            ? 'bg-blue-100 text-blue-900 border-blue-300'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                        }`}
                      >
                        {item.status === 'Done' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                        {item.status === 'In Progress' && <Clock className="w-3.5 h-3.5 text-blue-600" />}
                        {item.status === 'Pending' && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                        <span>
                          {item.status === 'Done'
                            ? 'Terminé'
                            : item.status === 'In Progress'
                            ? 'En cours'
                            : 'En attente'}
                        </span>
                      </span>
                    </td>
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      {item.pdfUrl ? (
                        <button
                          type="button"
                          onClick={() => setPreviewPdfOF(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          <FileText className="w-4 h-4 text-red-600" />
                          <span className="max-w-[120px] truncate">{item.pdfFileName || 'Voir le PDF'}</span>
                        </button>
                      ) : (
                        <span className="text-neutral-400 italic text-xs">Aucun PDF</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.status !== 'Done' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(item, 'Done')}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                            title="Marquer comme terminé"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Terminer</span>
                          </button>
                        )}
                        {item.status === 'Pending' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(item, 'In Progress')}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                            title="Lancer la production"
                          >
                            <span>Démarrer</span>
                          </button>
                        )}
                        {item.status === 'Done' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(item, 'In Progress')}
                            className="px-2.5 py-1 text-neutral-600 hover:text-neutral-900 rounded-lg text-[11px] font-semibold underline cursor-pointer"
                            title="Rouvrir l'OF"
                          >
                            Rouvrir
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-neutral-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Modifier l'OF / Remplacer le PDF"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Supprimer définitivement l'OF ${item.ofNumber} ?`)) {
                              onDeleteOF(item.id);
                              toast.success(`OF ${item.ofNumber} supprimé.`);
                            }
                          }}
                          className="p-1.5 text-neutral-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Supprimer l'OF"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination */}
        <PaginationBar
          totalItems={filteredOFs.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* ========================================================================= */}
      {/* IMPORT / CREATE / EDIT OF MODAL                                           */}
      {/* ========================================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 border border-neutral-300 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
                  {editingOF ? <Edit2 className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-neutral-900">
                    {editingOF ? "Modifier l'Ordre de Fabrication (OF)" : "Importer un Rapport OF (Ordre de Fabrication)"}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {editingOF
                      ? "Modifiez les paramètres ou joignez / remplacez le rapport technique PDF."
                      : "Téléchargez le rapport technique PDF et définissez les paramètres de production"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setEditingOF(null);
                }}
                className="w-8 h-8 rounded-xl text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitImport} className="space-y-4 text-xs">
              {/* PDF File Upload Zone */}
              <div className="p-4 sm:p-6 bg-blue-50/50 rounded-2xl border-2 border-dashed border-blue-300 text-center space-y-3">
                <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <label
                    htmlFor="pdf-file-upload"
                    className="font-bold text-sm text-blue-700 hover:underline cursor-pointer"
                  >
                    {selectedFile
                      ? selectedFile.name
                      : formData.pdfFileName
                      ? `Remplacer le PDF (${formData.pdfFileName})`
                      : 'Sélectionner le fichier PDF du rapport OF'}
                  </label>
                  <input
                    id="pdf-file-upload"
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <p className="text-[11px] text-neutral-500 mt-1">
                    {selectedFile
                      ? `Nouveau fichier : ${(selectedFile.size / 1024).toFixed(1)} Ko · Prêt pour téléversement`
                      : formData.pdfUrl
                      ? `PDF actuellement rattaché : ${formData.pdfFileName || 'Fichier PDF'}. Cliquez pour remplacer.`
                      : 'Formats acceptés : PDF technique, gamme de production, ordre atelier'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-neutral-800 block">N° Ordre de Fabrication (OF) * :</label>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md">
                      Séquentiel (OF-YYYY-XXXX)
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      value={formData.ofNumber}
                      onChange={(e) => setFormData({ ...formData, ofNumber: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl font-mono font-bold text-blue-700 uppercase pr-16"
                    />
                    {!editingOF && (
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, ofNumber: generateNextOFRef(ofs, prev.dueDate) }))}
                        className="absolute right-2 px-2 py-1 bg-white hover:bg-blue-50 text-blue-700 rounded text-[10px] font-bold border border-blue-200 cursor-pointer shadow-2xs"
                        title="Générer automatiquement le numéro séquentiel suivant"
                      >
                        Auto N°
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="font-bold text-neutral-800 block mb-1">Priorité :</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl font-bold"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Urgent">Urgent</option>
                    <option value="High">Élevée</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-800 block mb-1">Désignation / Article de Production * :</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Boîtier Connecteur 12V Noir - Réf TT-4402"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-neutral-800 block mb-1">Presse / Machine Affectée :</label>
                  <select
                    value={formData.machineId}
                    onChange={(e) => setFormData({ ...formData, machineId: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl font-semibold"
                  >
                    <option value="">Sélectionner une machine</option>
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.number} — {m.name || m.brand}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-neutral-800 block mb-1">Outillage / Moule Associé :</label>
                  <select
                    value={formData.moldId}
                    onChange={(e) => setFormData({ ...formData, moldId: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl font-semibold"
                  >
                    <option value="">Sélectionner un moule</option>
                    {molds.map((mold) => (
                      <option key={mold.id} value={mold.id}>
                        {mold.moldNumber || mold.ref} — {mold.customer || 'Standard'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-neutral-800 block mb-1">Quantité Cible à Produire (pcs) :</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.targetQuantity}
                    onChange={(e) => setFormData({ ...formData, targetQuantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-800 block mb-1">Date d&apos;Échéance Prévue :</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-800 block mb-1">Instructions &amp; Notes d&apos;Atelier :</label>
                <textarea
                  rows={2}
                  placeholder="Paramètres d'injection, contrôles qualité exigés, etc."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-2.5 bg-white border border-neutral-300 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isUploading ? (
                    <span>Importation en cours...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingOF ? "Enregistrer les modifications de l'OF" : "Valider & Enregistrer l'OF"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* IN-APP PDF VIEWER MODAL                                                   */}
      {/* ========================================================================= */}
      {previewPdfOF && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl border border-neutral-300 overflow-hidden">
            <div className="p-4 sm:p-5 bg-neutral-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-600/90 text-white flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base tracking-tight">
                    Rapport OF : {previewPdfOF.ofNumber} — {previewPdfOF.title}
                  </h3>
                  <p className="text-[11px] text-neutral-300">
                    {previewPdfOF.machineName || 'Machine standard'} · {previewPdfOF.moldName || 'Moule standard'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {previewPdfOF.pdfUrl && (
                  <a
                    href={previewPdfOF.pdfUrl}
                    download={previewPdfOF.pdfFileName || `${previewPdfOF.ofNumber}.pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-neutral-200 transition-colors flex items-center gap-1.5 text-xs font-semibold"
                    title="Ouvrir dans un nouvel onglet"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span className="hidden sm:inline">Plein Écran</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewPdfOF(null)}
                  className="w-9 h-9 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-neutral-100 p-2 sm:p-4 overflow-hidden flex flex-col">
              {previewPdfOF.pdfUrl ? (
                <iframe
                  src={previewPdfOF.pdfUrl}
                  title={`PDF ${previewPdfOF.ofNumber}`}
                  className="w-full h-full rounded-2xl border border-neutral-300 shadow-inner bg-white"
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
                  <AlertCircle className="w-12 h-12 text-amber-500" />
                  <p className="font-bold text-neutral-800">Aucun fichier PDF joint à cet OF.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
