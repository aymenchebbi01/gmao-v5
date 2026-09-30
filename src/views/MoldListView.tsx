import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Search,
  Box,
  MapPin,
  CheckCircle2,
  Clock,
  Wrench,
  RotateCw,
  Edit2,
  Trash2,
  Download,
  FileSpreadsheet,
  FileDown,
  UploadCloud,
  Check,
  Save,
  ArrowLeft,
  FileText,
  Image,
  X,
  Eye,
  QrCode,
  ExternalLink,
  Printer,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { Mold, MoldStatus, Machine, AppUser } from '../types/gmao';
import { cn, parseMoldImages } from '../lib/gmaoUtils';
import { TableFooter } from '../components/TableFooter';
import * as XLSX from 'xlsx';
import { generateFicheTechniqueMoulePdf } from '../lib/ficheTechniqueMoulePdf';
import { sqliteApi } from '../services/sqliteApi';
import { toast } from 'sonner';

interface MoldListViewProps {
  molds: Mold[];
  machines?: Machine[];
  onUpdateMolds?: (molds: Mold[]) => void;
  currentUser?: AppUser;
  onNavigate?: (view: any) => void;
  onOpenNewOTModal?: () => void;
}

export const MoldListView: React.FC<MoldListViewProps> = ({
  molds: initialMolds,
  machines: initialMachines = [],
  onUpdateMolds,
  currentUser,
}) => {
  // canEdit: can open/view form (broader set of roles)
  const canEdit =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'responsable technique' ||
    currentUser?.role === 'responsable maintenance' ||
    currentUser?.role === 'technician' ||
    currentUser?.role === 'methode maintenance';

  // canAdminEdit: can save/delete (admin and manager roles only)
  const canAdminEdit =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'responsable technique' ||
    currentUser?.role === 'responsable maintenance' ||
    (currentUser?.role || '').toLowerCase().includes('admin') ||
    (currentUser?.role || '').toLowerCase().includes('responsable') ||
    (currentUser?.role || '').toLowerCase().includes('manager');

  const [molds, setMolds] = useState<Mold[]>(initialMolds);
  const [machines, setMachines] = useState<Machine[]>(initialMachines);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [mobileMoldsUrl, setMobileMoldsUrl] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Sync prop changes
  useEffect(() => {
    setMolds(initialMolds);
  }, [initialMolds]);

  useEffect(() => {
    setMachines(initialMachines);
  }, [initialMachines]);

  useEffect(() => {
    if (!initialMachines || initialMachines.length === 0) {
      sqliteApi.getMachines().then((res) => {
        if (Array.isArray(res)) setMachines(res);
      }).catch(console.error);
    }
  }, [initialMachines]);

  // Full View State (Overlay Architecture)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Form state
  const [formData, setFormData] = useState<{
    id: string;
    moldNumber: string;
    description: string;
    status: MoldStatus;
    location: string;
    clampingForceRange: string;
    plateType2: boolean;
    plateType3: boolean;
    ewocon: boolean;
    dme: boolean;
    flatNozzle: boolean;
    comment: string;
    othersWeight: string;
    moldImageUrl: string;
    moldImages: string[];
    exportDate: string;
  }>({
    id: '',
    moldNumber: '',
    description: '',
    status: 'In Stock',
    location: '',
    clampingForceRange: '',
    plateType2: false,
    plateType3: false,
    ewocon: false,
    dme: false,
    flatNozzle: false,
    comment: '',
    othersWeight: '',
    moldImageUrl: '',
    moldImages: [],
    exportDate: '',
  });

  const moldImageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<Partial<Mold>[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  // Machine picker for "In Use"
  const [machineSearch, setMachineSearch] = useState('');
  const [machineDropdownOpen, setMachineDropdownOpen] = useState(false);
  const machineSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileMoldsUrl(`http://gmao.thermoplastics.lan/mobile-status?tab=molds`);
  }, []);

  const handleOpenCreateForm = () => {
    setIsEditMode(false);
    setFormData({
      id: '',
      moldNumber: '',
      description: '',
      status: 'In Stock',
      location: 'Rack A-01',
      clampingForceRange: '50t/60t/100t',
      plateType2: true,
      plateType3: false,
      ewocon: false,
      dme: true,
      flatNozzle: false,
      comment: '',
      othersWeight: '250 KG',
      moldImageUrl: '',
      moldImages: [],
      exportDate: '',
    });
    setIsFormOpen(true);
  };

  const handleEditClick = (mold: Mold) => {
    const images = parseMoldImages(mold.moldImages || mold.moldImageUrl);
    setFormData({
      id: mold.id,
      moldNumber: mold.moldNumber || mold.ref || '',
      description: mold.description || '',
      status: mold.status,
      location: mold.location || mold.rackLocation || '',
      clampingForceRange: mold.clampingForceRange || '50t/60t/100t',
      plateType2: !!mold.plateType2,
      plateType3: !!mold.plateType3,
      ewocon: !!mold.ewocon,
      dme: !!mold.dme,
      flatNozzle: !!mold.flatNozzle,
      comment: mold.comment || '',
      othersWeight: mold.othersWeight || '230 KG',
      moldImageUrl: mold.moldImageUrl || '',
      moldImages: images,
      exportDate: mold.exportDate ? mold.exportDate.substring(0, 10) : '',
    });
    setIsEditMode(true);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setIsEditMode(false);
  };

  const handleSaveMold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.moldNumber.trim()) {
      showToast('Please enter the mold number.');
      return;
    }

    const moldImageUrl =
      formData.moldImages.length === 0
        ? ''
        : formData.moldImages.length === 1
          ? formData.moldImages[0]
          : JSON.stringify(formData.moldImages);

    const payload: Mold = {
      id: formData.id || `mld-${Date.now()}`,
      moldNumber: formData.moldNumber.trim(),
      ref: formData.moldNumber.trim(),
      description: formData.description.trim(),
      status: formData.status,
      location: formData.location.trim(),
      rackLocation: formData.location.trim(),
      clampingForceRange: formData.clampingForceRange.trim() || undefined,
      plateType2: formData.plateType2,
      plateType3: formData.plateType3,
      ewocon: formData.ewocon,
      dme: formData.dme,
      flatNozzle: formData.flatNozzle,
      comment: formData.comment.trim() || undefined,
      othersWeight: formData.othersWeight.trim() || undefined,
      moldImageUrl: moldImageUrl || undefined,
      moldImages: formData.moldImages,
      exportDate:
        formData.status === 'Exported'
          ? formData.exportDate || new Date().toISOString().substring(0, 10)
          : undefined,
      customer: 'Automotive OEM',
      cavities: 4,
      resin: 'PA66-GF30',
      cycleTimeSec: 18.0,
      currentShots: 45000,
      maxShotsBeforeMaintenance: 150000,
    };

    setLoading(true);

    try {
      if (isEditMode && formData.id) {
        // Update via server
        const saved = await sqliteApi.saveMold(payload);
        const updated = molds.map((m) => (m.id === saved.id ? saved : m));
        setMolds(updated);
        if (onUpdateMolds) onUpdateMolds(updated);
        toast.success(`Moule ${formData.moldNumber} mis à jour avec succès`);
      } else {
        // Create via server
        const created = await sqliteApi.createMold(payload);
        const updated = [created, ...molds];
        setMolds(updated);
        if (onUpdateMolds) onUpdateMolds(updated);
        toast.success(`Moule ${formData.moldNumber} ajouté avec succès`);
      }
      handleCloseForm();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la sauvegarde du moule');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMoldDocument = (dataUrlOrUrl: string) => {
    if (!dataUrlOrUrl) return;
    if (dataUrlOrUrl.startsWith('data:application/pdf')) {
      try {
        const base64 = dataUrlOrUrl.split(',')[1] || dataUrlOrUrl;
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
      } catch (e) {
        showToast("Impossible d'ouvrir le document PDF");
      }
    } else {
      window.open(dataUrlOrUrl, '_blank');
    }
  };

  const handleMoldImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles: File[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        showToast(`"${file.name}" n'est pas une image ou un PDF valide.`);
        continue;
      }
      if (file.size > 15 * 1024 * 1024) {
        showToast(`"${file.name}" est trop volumineux (max 15 Mo).`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      e.target.value = '';
      return;
    }

    let loadedCount = 0;
    const newUrls: string[] = [];

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl) newUrls.push(dataUrl);
        loadedCount++;
        if (loadedCount === validFiles.length) {
          setFormData((prev) => {
            const updated = [...(prev.moldImages || []), ...newUrls];
            return {
              ...prev,
              moldImages: updated,
              moldImageUrl: updated[0] || '',
            };
          });
          showToast(`${newUrls.length} fichier(s) technique(s) ajouté(s)`);
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleRemoveMoldImage = (indexToRemove: number) => {
    setFormData((prev) => {
      const updated = prev.moldImages.filter((_, idx) => idx !== indexToRemove);
      return {
        ...prev,
        moldImages: updated,
        moldImageUrl: updated[0] || '',
      };
    });
  };

  const handleDeleteMold = async (id: string, moldNumber: string) => {
    // Block deletion if the mold is currently mounted on a machine
    const cleanNum = (moldNumber || '').trim().toUpperCase();
    const cleanId = (id || '').trim().toUpperCase();
    const mountedOn = (machines || []).find(
      (m) =>
        (m.activeMoldRef && (m.activeMoldRef.trim().toUpperCase() === cleanNum || m.activeMoldRef.trim().toUpperCase() === cleanId)) ||
        (m.currentMoule && (m.currentMoule.trim().toUpperCase() === cleanNum || m.currentMoule.trim().toUpperCase() === cleanId))
    );
    if (mountedOn) {
      toast.error(
        `Impossible de supprimer le moule "${moldNumber}" — il est actuellement monté sur la machine ${mountedOn.number || mountedOn.name || mountedOn.id}. Démontez-le d'abord.`
      );
      return;
    }
    if (!window.confirm(`Confirmer la suppression du moule "${moldNumber}" ?`)) return;
    try {
      await sqliteApi.deleteMold(id);
      const updated = molds.filter((m) => m.id !== id);
      setMolds(updated);
      if (onUpdateMolds) onUpdateMolds(updated);
      toast.success(`Moule ${moldNumber} supprimé.`);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression du moule');
    }
  };

  const handleDeleteAllMolds = () => {
    if (!window.confirm(`WARNING: Are you sure you want to delete ALL molds (${molds.length} molds)?`)) {
      return;
    }
    setMolds([]);
    if (onUpdateMolds) onUpdateMolds([]);
    showToast('All molds have been deleted.');
  };

  // Excel Template Download
  const handleDownloadTemplate = () => {
    const templateRows = [
      {
        'Mold Number': 'M-2024-01',
        Description: 'Cap Mold 28mm 8 Cavities',
        Statut: 'In Stock',
        Location: 'Rack A-01',
        'MC T (Tonnage)': '50t/60t/100t',
        'Poids (KG)': '231 KG',
        '2 Plate': 'Oui',
        '3 Plate': 'Non',
        EWOCON: 'Non',
        DME: 'Oui',
        'Flat Nozzle': 'Non',
        Commentaire: 'Prêt pour production',
      },
      {
        'Mold Number': 'M-2024-02',
        Description: 'Automotive Connector Mold',
        Statut: 'In Use',
        Emplacement: 'INJ-01',
        'MC T (Tonnage)': '80t',
        'Poids (KG)': '320 KG',
        '2 Plate': 'Oui',
        '3 Plate': 'Non',
        EWOCON: 'Non',
        DME: 'Non',
        'Flat Nozzle': 'Non',
        Commentaire: 'En cours d injection',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Molds');
    XLSX.writeFile(workbook, 'Template_Import_Molds.xlsx');
    showToast('Modèle Excel téléchargé avec succès');
  };

  const parseBooleanVal = (val: any): boolean => {
    if (val === true || val === 1) return true;
    if (!val) return false;
    const s = String(val).trim().toLowerCase();
    return s === 'oui' || s === 'yes' || s === '1' || s === 'true' || s === 'vrai' || s === 'x';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const reader = new FileReader();

    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (!rows || rows.length === 0) {
          showToast('Le fichier Excel est vide ou non valide.');
          setImportPreview([]);
          return;
        }

        const parsed: Partial<Mold>[] = rows
          .map((r: any) => {
            const moldNumber = String(
              r['Numero Moule'] ||
              r['Numéro Moule'] ||
              r['N° Moule'] ||
              r['Mold Number'] ||
              r['moldNumber'] ||
              r['MOULE'] ||
              r['Code Moule'] ||
              r['Reference'] ||
              r['Référence'] ||
              ''
            ).trim();

            const description = String(
              r['Description'] || r['description'] || r['Désignation'] || ''
            ).trim();

            const rawStatus = String(r['Statut'] || r['Status'] || '').trim().toLowerCase();
            let status: MoldStatus = 'In Stock';
            if (rawStatus.includes('use') || rawStatus.includes('utilis') || rawStatus.includes('prod')) {
              status = 'In Use';
            } else if (rawStatus.includes('maint') || rawStatus.includes('repar') || rawStatus.includes('panne')) {
              status = 'In Maintenance';
            } else if (rawStatus.includes('export')) {
              status = 'Exported';
            } else {
              status = 'In Stock';
            }

            const location = String(r['Emplacement'] || r['Location'] || r['Rack'] || '').trim();
            const clampingForceRange = String(
              r['MC T (Tonnage)'] || r['MC T'] || r['Tonnage'] || ''
            ).trim();
            const othersWeight = String(r['Poids (KG)'] || r['Poids'] || '').trim();

            const plateType2 = parseBooleanVal(r['2 Plate'] ?? r['2 Plaques']);
            const plateType3 = parseBooleanVal(r['3 Plate'] ?? r['3 Plaques']);
            const ewocon = parseBooleanVal(r['EWOCON'] ?? r['ewocon']);
            const dme = parseBooleanVal(r['DME'] ?? r['dme']);
            const flatNozzle = parseBooleanVal(r['Flat Nozzle'] ?? r['Buse Plate']);

            const comment = String(r['Commentaire'] || r['Remarque'] || '').trim();

            return {
              id: `mld-imp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              moldNumber,
              ref: moldNumber,
              description,
              status,
              location,
              rackLocation: location,
              clampingForceRange: clampingForceRange || '50t/60t/100t',
              othersWeight: othersWeight || '230 KG',
              plateType2,
              plateType3,
              ewocon,
              dme,
              flatNozzle,
              comment: comment || undefined,
              customer: 'Automotive OEM',
              cavities: 4,
              resin: 'PA66-GF30',
              cycleTimeSec: 18.0,
              currentShots: 0,
              maxShotsBeforeMaintenance: 150000,
            };
          })
          .filter((m) => Boolean(m.moldNumber));

        if (parsed.length === 0) {
          showToast('No valid molds found in file.');
          setImportPreview([]);
        } else {
          setImportPreview(parsed);
          showToast(`${parsed.length} mold(s) ready to be imported`);
        }
      } catch (err) {
        showToast('Erreur lors de la lecture du fichier Excel.');
        setImportPreview([]);
      }
    };

    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleConfirmImport = () => {
    if (importPreview.length === 0) return;
    setImportLoading(true);

    const validNewMolds = importPreview as Mold[];
    const updated = [...validNewMolds, ...molds];
    setMolds(updated);
    if (onUpdateMolds) onUpdateMolds(updated);

    showToast(`${importPreview.length} mold(s) imported successfully!`);
    setImportPreview([]);
    setImportFileName('');
    setImportLoading(false);
  };

  const handleCancelImport = () => {
    setImportPreview([]);
    setImportFileName('');
  };

  const handleExport = () => {
    const exportRows = molds.map((m) => ({
      'Mold Number': m.moldNumber || m.ref,
      Description: m.description || '',
      Statut: m.status,
      Location: m.location || m.rackLocation || '',
      'MC T (Tonnage)': m.clampingForceRange || '',
      'Poids (KG)': m.othersWeight || '',
      '2 Plate': m.plateType2 ? 'Oui' : 'Non',
      '3 Plate': m.plateType3 ? 'Oui' : 'Non',
      EWOCON: m.ewocon ? 'Oui' : 'Non',
      DME: m.dme ? 'Oui' : 'Non',
      'Flat Nozzle': m.flatNozzle ? 'Oui' : 'Non',
      Commentaire: m.comment || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Molds');
    XLSX.writeFile(workbook, `molds_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Molds list exported to Excel');
  };

  // Metrics
  const totalMolds = molds.length;
  const inUseCount = molds.filter((m) => m.status === 'In Use' || m.status === 'In Production').length;
  const inStockCount = molds.filter((m) => m.status === 'In Stock' || m.status === 'Ready in Rack').length;
  const inMaintenanceCount = molds.filter((m) => m.status === 'In Maintenance' || m.status === 'In Toolroom' || m.status === 'Requires Repair').length;
  const exportedCount = molds.filter((m) => m.status === 'Exported').length;

  // Filtered
  const filteredMolds = molds.filter((m) => {
    const mNum = m.moldNumber || m.ref || '';
    const mDesc = m.description || '';
    const mLoc = m.location || m.rackLocation || '';

    const matchesSearch =
      mNum.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mDesc.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mLoc.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === 'all' ||
      m.status === filterStatus ||
      (filterStatus === 'In Use' && m.status === 'In Production') ||
      (filterStatus === 'In Stock' && m.status === 'Ready in Rack') ||
      (filterStatus === 'In Maintenance' && (m.status === 'In Toolroom' || m.status === 'Requires Repair'));

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredMolds.length / pageSize) || 1;
  const paginatedMolds = filteredMolds.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getStatusBadge = (status: MoldStatus) => {
    switch (status) {
      case 'In Use':
      case 'In Production':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            In Use
          </span>
        );
      case 'In Stock':
      case 'Ready in Rack':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-full text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            In Stock
          </span>
        );
      case 'In Maintenance':
      case 'In Toolroom':
      case 'Requires Repair':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-full text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            In Maintenance
          </span>
        );
      case 'Exported':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200/60 rounded-full text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Exported
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 relative min-h-[700px] p-4 sm:p-6 max-w-[1600px] mx-auto">
      {/* Toast */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 bg-neutral-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Hidden File Input for Excel Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls, .csv"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* LIST VIEW (Blurred when form is open) */}
      <div
        className={cn(
          'space-y-6 transition-all duration-500 ease-in-out',
          isFormOpen ? 'blur-xl opacity-20 scale-95 pointer-events-none' : 'blur-0 opacity-100 scale-100'
        )}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setRefreshing(true);
                setTimeout(() => {
                  setRefreshing(false);
                  showToast('Mold list refreshed');
                }, 350);
              }}
              className="p-2.5 text-gray-500 hover:text-blue-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-xs cursor-pointer"
              title="Actualiser la liste"
            >
              <RotateCw size={18} className={cn(refreshing && 'animate-spin text-blue-600')} />
            </button>

            {/* Download Template Button */}
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-violet-700 bg-violet-50 border border-violet-200 rounded-xl hover:bg-violet-100 transition-colors shadow-xs cursor-pointer"
              title="Télécharger un modèle Excel d'exemple"
            >
              <FileDown size={16} />
              Modèle Excel
            </button>

            {/* Import Excel Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors shadow-xs cursor-pointer"
              title="Import molds from Excel file (.xlsx, .csv)"
            >
              <FileSpreadsheet size={16} />
              Importer Excel
            </button>

            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-xs cursor-pointer"
              title="Export mold list to Excel format (.xlsx)"
            >
              <Download size={16} />
              Exporter Excel
            </button>

            <button
              onClick={handleOpenCreateForm}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Plus size={18} />
              Add Mold
            </button>

            {/*{currentUser?.role === 'admin' && (
              <button
                type="button"
                onClick={handleDeleteAllMolds}
                disabled={loading || molds.length === 0}
                className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors shadow-xs cursor-pointer"
                title="Delete all molds (Admin only)"
              >
                <Trash2 size={16} />
                <span>Delete All</span>
              </button>
            )}*/}
          </div>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Molds</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{totalMolds}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">En Utilisation</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{inUseCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">En Stock</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{inStockCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">En Maintenance</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{inMaintenanceCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Exportés</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">{exportedCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Excel Import Preview Banner */}
        {importPreview.length > 0 && (
          <div className="p-4 bg-emerald-50/80 border-2 border-emerald-300 rounded-2xl shadow-sm space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-600 text-white rounded-xl">
                  <UploadCloud size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-950">
                    Excel Import Preview ({importPreview.length} molds found in &quot;{importFileName}&quot;)
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelImport}
                  disabled={importLoading}
                  className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={importLoading}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Check size={14} />
                  {importLoading ? 'Importation en cours...' : `Confirmer l'import (${importPreview.length})`}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-60 rounded-xl border border-emerald-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-emerald-100/60 text-emerald-900 font-bold sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Mold N°</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2">Statut</th>
                    <th className="px-3 py-2">Location</th>
                    <th className="px-3 py-2">MC T</th>
                    <th className="px-3 py-2">Poids</th>
                    <th className="px-3 py-2">Systèmes</th>
                    <th className="px-3 py-2">Commentaire</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100">
                  {importPreview.slice(0, 10).map((item, idx) => {
                    const systems = [
                      item.plateType2 ? '2 Plate' : null,
                      item.plateType3 ? '3 Plate' : null,
                      item.ewocon ? 'EWOCON' : null,
                      item.dme ? 'DME' : null,
                      item.flatNozzle ? 'Flat Nozzle' : null,
                    ].filter(Boolean);

                    return (
                      <tr key={idx} className="hover:bg-emerald-50/50">
                        <td className="px-3 py-1.5 font-bold font-mono text-emerald-950">{item.moldNumber}</td>
                        <td className="px-3 py-1.5 text-gray-700">{item.description || '—'}</td>
                        <td className="px-3 py-1.5 font-semibold text-gray-800">{item.status}</td>
                        <td className="px-3 py-1.5 text-gray-600">{item.location || '—'}</td>
                        <td className="px-3 py-1.5 text-gray-600">{item.clampingForceRange || '—'}</td>
                        <td className="px-3 py-1.5 text-gray-600">{item.othersWeight || '—'}</td>
                        <td className="px-3 py-1.5 text-gray-600">
                          {systems.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {systems.map((s) => (
                                <span key={s} className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-semibold">
                                  {s}
                                </span>
                              ))}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-gray-600 max-w-xs truncate" title={item.comment}>
                          {item.comment || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Filter & Search Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by mold number, description, location..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {[
              { id: 'all', label: 'Tous' },
              { id: 'In Use', label: 'En Utilisation' },
              { id: 'In Stock', label: 'En Stock' },
              { id: 'In Maintenance', label: 'En Maintenance' },
              { id: 'Exported', label: 'Exporté' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setFilterStatus(tab.id);
                  setCurrentPage(1);
                }}
                className={cn(
                  'px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer',
                  filterStatus === tab.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200/70'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <th className="px-6 py-4">Mold N°</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedMolds.length > 0 ? (
                  paginatedMolds.map((mold) => (
                    <tr
                      key={mold.id}
                      className="hover:bg-blue-50/30 transition-colors group text-sm"
                    >
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-blue-600">
                          {mold.moldNumber || mold.ref}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {mold.description || <span className="text-gray-400 italic">Aucune description</span>}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">
                          <MapPin size={13} className="text-gray-400" />
                          {mold.location || mold.rackLocation || 'Atelier'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(mold.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() =>
                              generateFicheTechniqueMoulePdf(
                                mold,
                                currentUser ? { name: currentUser.name, role: currentUser.role } : undefined
                              )
                            }
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                            title="Télécharger Fiche Technique (PDF)"
                          >
                            <FileText size={16} />
                          </button>
                          {canAdminEdit && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleEditClick(mold)}
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                                title="Modifier"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMold(mold.id, mold.moldNumber || mold.ref || '')}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                title="Supprimer"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <div className="inline-flex flex-col items-center">
                        <div className="p-4 bg-gray-50 rounded-2xl mb-3">
                          <Box size={32} className="text-gray-300" />
                        </div>
                        <p className="text-sm font-bold text-gray-900">No molds found</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {searchTerm || filterStatus !== 'all'
                            ? 'Essayez de modifier vos critères de recherche.'
                            : 'Cliquez sur "Add Mold" ou "Importer Excel" pour ajouter vos premiers moules.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <TableFooter
            totalItems={filteredMolds.length}
            pageSize={pageSize}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setCurrentPage(1);
            }}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {/* FORM VIEW (OVERLAY) */}
      {isFormOpen && (
        <div className="absolute inset-x-0 top-0 z-20 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <input
            ref={moldImageInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={handleMoldImageUpload}
            className="hidden"
          />

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isEditMode ? `Edit Mold: ${formData.moldNumber}` : 'Add New Mold'}
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">Spécifications d'outillage, systèmes d'injection et plans techniques</p>
            </div>
            <div className="flex items-center gap-2">
              {isEditMode && (
                <button
                  type="button"
                  onClick={() => {
                    const signer = currentUser
                      ? { name: currentUser.name, role: currentUser.role }
                      : undefined;
                    generateFicheTechniqueMoulePdf(
                      {
                        id: formData.id,
                        moldNumber: formData.moldNumber,
                        ref: formData.moldNumber,
                        description: formData.description,
                        status: formData.status,
                        location: formData.location,
                        rackLocation: formData.location,
                        clampingForceRange: formData.clampingForceRange,
                        plateType2: formData.plateType2,
                        plateType3: formData.plateType3,
                        ewocon: formData.ewocon,
                        dme: formData.dme,
                        flatNozzle: formData.flatNozzle,
                        comment: formData.comment,
                        othersWeight: formData.othersWeight,
                        moldImageUrl: formData.moldImageUrl,
                        moldImages: formData.moldImages,
                      } as Mold,
                      signer
                    );
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors shadow-xs cursor-pointer"
                  title="Télécharger Fiche Technique (PDF)"
                >
                  <FileText size={16} />
                  <span>Fiche Technique (PDF)</span>
                </button>
              )}
              <button
                onClick={handleCloseForm}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <ArrowLeft size={16} />
                Retour à la liste
              </button>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-2xl border border-neutral-300 shadow-2xl rounded-3xl p-6 sm:p-8">
            <form onSubmit={handleSaveMold} className="space-y-6">
              {/* Row 1: Mold Number + Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                    Mold Reference *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: MLD-204"
                    value={formData.moldNumber}
                    onChange={(e) => setFormData({ ...formData, moldNumber: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm font-mono font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                    Mold Status *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as MoldStatus })}
                    className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all cursor-pointer"
                  >
                    <option value="In Stock">In Stock</option>
                    <option value="In Use">In Use</option>
                    <option value="In Maintenance">In Maintenance</option>
                    <option value="Exported">Exported</option>
                  </select>

                  {formData.status === 'Exported' && (
                    <div className="mt-3">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                        Date d'exportation *
                      </label>
                      <input
                        type="date"
                        value={formData.exportDate}
                        onChange={(e) => setFormData({ ...formData, exportDate: e.target.value })}
                        className="w-full px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl text-sm font-semibold text-gray-800 focus:ring-4 focus:ring-amber-400/20 focus:border-amber-500 outline-none transition-all font-mono"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                    Location {formData.status === 'In Use' && <span className="text-blue-500 normal-case font-normal">(select a machine)</span>}
                  </label>
                  {formData.status === 'In Use' ? (
                    <div className="relative" ref={machineSearchRef}>
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search injection press..."
                          value={machineSearch || formData.location}
                          onChange={(e) => {
                            setMachineSearch(e.target.value);
                            setFormData({ ...formData, location: e.target.value });
                            setMachineDropdownOpen(true);
                          }}
                          onFocus={() => {
                            setMachineSearch('');
                            setMachineDropdownOpen(true);
                          }}
                          className="w-full pl-9 pr-4 py-3 bg-blue-50/50 border border-blue-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                        />
                      </div>
                      {machineDropdownOpen && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-blue-100 rounded-2xl shadow-2xl max-h-52 overflow-y-auto">
                          {initialMachines
                            .filter(
                              (m) =>
                                !machineSearch ||
                                (m.name && m.name.toLowerCase().includes(machineSearch.toLowerCase())) ||
                                (m.number && m.number.toLowerCase().includes(machineSearch.toLowerCase()))
                            )
                            .map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, location: m.number || m.name || '' });
                                  setMachineSearch('');
                                  setMachineDropdownOpen(false);
                                }}
                                className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 cursor-pointer"
                              >
                                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                  <span className="text-[10px] font-black text-blue-700">
                                    {(m.number || m.name || '').substring(0, 3)}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-gray-900 truncate">
                                    {m.number} — {m.name || m.model}
                                  </p>
                                  <p className="text-[10px] text-gray-400 truncate">
                                    {m.location || m.line} ({m.clampingForce || m.clampingForceTons}T)
                                  </p>
                                </div>
                                {formData.location === (m.number || m.name) && (
                                  <Check size={14} className="text-blue-600 ml-auto shrink-0" />
                                )}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="ex: Rack A-01"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                    Description de la Pièce / Projet
                  </label>
                  <input
                    type="text"
                    placeholder="ex: Boîtier connecteur électrique 12 voies"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Technical Specs Section */}
              <div className="border-t border-gray-100 pt-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                  Caractéristiques Techniques
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                      MC T — Force de Fermeture (Tonnage)
                    </label>
                    <input
                      type="text"
                      placeholder="ex: 50t/60t/100t ou 40t"
                      value={formData.clampingForceRange}
                      onChange={(e) => setFormData({ ...formData, clampingForceRange: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                      Poids / Autres (Others)
                    </label>
                    <input
                      type="text"
                      placeholder="ex: 231 KG"
                      value={formData.othersWeight}
                      onChange={(e) => setFormData({ ...formData, othersWeight: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Checkboxes row */}
                <div className="mt-4 p-4 bg-gray-50/60 border border-gray-100 rounded-2xl">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    Type / Système
                  </p>
                  <div className="flex flex-wrap gap-4">
                    {[
                      { key: 'plateType2' as const, label: '2 Plate' },
                      { key: 'plateType3' as const, label: '3 Plate' },
                      { key: 'ewocon' as const, label: 'EWOCON' },
                      { key: 'dme' as const, label: 'DME' },
                      { key: 'flatNozzle' as const, label: 'Flat Nozzle' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer group">
                        <div
                          onClick={() => setFormData((prev) => ({ ...prev, [key]: !prev[key] }))}
                          className={cn(
                            'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer',
                            formData[key]
                              ? 'bg-blue-600 border-blue-600'
                              : 'bg-white border-gray-300 group-hover:border-blue-400'
                          )}
                        >
                          {formData[key] && <Check size={12} className="text-white" />}
                        </div>
                        <span className="text-sm font-semibold text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Comment */}
                <div className="mt-4">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                    Commentaire
                  </label>
                  <input
                    type="text"
                    placeholder="ex: Outillage prêt pour campagne d'injection"
                    value={formData.comment}
                    onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Technical Drawings & Mold Photos */}
              <div className="border-t border-gray-100 pt-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      Technical Drawings & Mold Photos ({formData.moldImages.length})
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Vous pouvez joindre une ou plusieurs photos (JPG, PNG, WEBP) ou plans techniques (PDF).
                    </p>
                  </div>
                  {formData.moldImages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => moldImageInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 shadow-2xs cursor-pointer"
                    >
                      <Plus size={13} />
                      Add more files
                    </button>
                  )}
                </div>

                {formData.moldImages.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                    {formData.moldImages.map((docUrl, idx) => {
                      const isPdf =
                        docUrl.startsWith('data:application/pdf') || docUrl.toLowerCase().includes('.pdf');
                      return (
                        <div
                          key={idx}
                          className="relative group bg-gray-50/80 border border-gray-200 rounded-xl p-3 flex flex-col justify-between hover:shadow-md hover:border-blue-300 transition-all"
                        >
                          {isPdf ? (
                            <div className="aspect-4/3 rounded-lg bg-blue-50/80 border border-blue-100 flex flex-col items-center justify-center p-3 text-center">
                              <div className="w-10 h-10 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center mb-2 shadow-xs">
                                PDF
                              </div>
                              <span className="text-xs font-bold text-blue-950 truncate max-w-full">
                                Plan Technique #{idx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenMoldDocument(docUrl)}
                                className="mt-2 px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-md border border-blue-200 transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                              >
                                <Eye size={12} />
                                Ouvrir
                              </button>
                            </div>
                          ) : (
                            <div className="relative aspect-4/3 rounded-lg overflow-hidden bg-black/5 flex items-center justify-center">
                              <img
                                src={docUrl}
                                alt={`Photo moule ${idx + 1}`}
                                className="w-full h-full object-contain"
                              />
                              <button
                                type="button"
                                onClick={() => handleOpenMoldDocument(docUrl)}
                                className="absolute inset-0 bg-black/40 text-white font-semibold text-xs opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 transition-opacity cursor-pointer"
                              >
                                <Search size={14} />
                                Agrandir
                              </button>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100 mt-2">
                            <span className="font-semibold text-gray-600">
                              {isPdf ? 'Plan PDF' : 'Photo'} #{idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveMoldImage(idx)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors cursor-pointer"
                              title="Remove this document"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => moldImageInputRef.current?.click()}
                      className="aspect-4/3 border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50/30 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:text-blue-600 transition-all gap-2 p-4 cursor-pointer"
                    >
                      <Plus size={24} className="text-gray-400" />
                      <span className="text-xs font-bold text-center">Add another file</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => moldImageInputRef.current?.click()}
                    className="flex items-center justify-center gap-3 px-4 py-6 w-full border-2 border-dashed border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/40 transition-all text-sm text-gray-500 hover:text-blue-600 font-medium cursor-pointer"
                  >
                    <FileText size={22} className="text-blue-500" />
                    Attach technical drawings (PDF) or mold photos (one or multiple, max 15MB each)
                  </button>
                )}
              </div>

              {/* Form Action Buttons */}
              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-6 py-3 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Save size={18} />
                  {loading ? 'Saving...' : isEditMode ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
