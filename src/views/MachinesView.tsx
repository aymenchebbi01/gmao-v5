import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus,
  Search,
  Filter,
  HardDrive,
  MapPin,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Wrench,
  QrCode,
  Printer,
  History,
  Download,
  Camera,
  RotateCw,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit2,
  FileText,
  ChevronDown,
  ChevronUp,
  Tablet,
  ShieldAlert,
  Info,
  Check,
} from 'lucide-react';
import { Machine, AppUser, MaintenanceOrder, InterventionReport, CounterReading } from '../types/gmao';
import {
  cn,
  formatHoursToDays,
  calculateMachineLiveHours,
  exportToCSV,
  isMeterReadingStale,
  getElapsedCalendarHours,
  calculateReadingStats,
} from '../lib/gmaoUtils';
import { logMovement } from '../lib/auditLogger';
import { RECOMMENDED_TASKS } from '../constants/maintenanceTasks';
import { TableFooter } from '../components/TableFooter';
import { MachineHistory } from '../components/MachineHistory';
import { QRCodeCanvas } from 'qrcode.react';
import { generateFicheTechniquePdf } from '../lib/ficheTechniquePdf';

interface MachinesViewProps {
  machines: Machine[];
  onUpdateMachines?: (machines: Machine[]) => void;
  onNavigate?: (view: any) => void;
  currentUser?: AppUser;
  orders?: MaintenanceOrder[];
  reports?: InterventionReport[];
  onOpenNewOTModal?: () => void;
  onOpenTabletForMachine?: (machineId: string) => void;
}

export const MachinesView: React.FC<MachinesViewProps> = ({
  machines: initialMachines,
  onUpdateMachines,
  onNavigate,
  currentUser,
  orders = [],
  reports = [],
  onOpenNewOTModal,
  onOpenTabletForMachine,
}) => {
  const [machines, setMachines] = useState<Machine[]>(initialMachines);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [loading, setLoading] = useState(false);

  // Manual Meter Reading Modal State
  const [isManualReadingModalOpen, setIsManualReadingModalOpen] = useState(false);
  const [readingMachine, setReadingMachine] = useState<Machine | null>(null);
  const [manualReadingValue, setManualReadingValue] = useState<number | ''>('');
  const [manualReadingNote, setManualReadingNote] = useState('');
  const [manualReadingConfirmWarning, setManualReadingConfirmWarning] = useState(false);
  const [manualReadingError, setManualReadingError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(13);
  const [refreshing, setRefreshing] = useState(false);
  const [sortField, setSortField] = useState<keyof Machine | 'location'>('location');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showTechSpecs, setShowTechSpecs] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Check if current logged-in user has Manager or Admin rights to correct readings
  const userRole = (currentUser?.role || '').toLowerCase();
  const canEditReadings = ['admin', 'responsable maintenance', 'responsable technique'].includes(userRole);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Sync with prop changes
  useEffect(() => {
    setMachines(initialMachines);
  }, [initialMachines]);

  // Keep selectedMachine in sync with machines state updates
  useEffect(() => {
    if (selectedMachine) {
      const refreshed = machines.find((m) => m.id === selectedMachine.id);
      if (refreshed) {
        setSelectedMachine(refreshed);
      }
    }
  }, [machines]);

  // Count machines with stale meter readings (> 7 days without update)
  const staleCount = useMemo(() => {
    return machines.filter((m) => isMeterReadingStale(m, 7)).length;
  }, [machines]);

  const handleSort = (field: keyof Machine | 'location') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Static reading retrieval (currentHours does NOT tick automatically)
  const calculateLiveHours = (machine: Machine) => {
    return machine.currentHours ?? machine.totalOperatingHours ?? 0;
  };

  // Open manual reading modal for a machine
  const handleOpenManualReading = (machine: Machine) => {
    setReadingMachine(machine);
    const currentH = machine.currentHours ?? machine.totalOperatingHours ?? 0;
    setManualReadingValue(currentH);
    setManualReadingNote('');
    setManualReadingConfirmWarning(false);
    setManualReadingError(null);
    setIsManualReadingModalOpen(true);
  };

  // Submit manual meter reading
  const handleSaveManualReading = (e: React.FormEvent) => {
    e.preventDefault();
    if (!readingMachine) return;

    const val = typeof manualReadingValue === 'number' ? manualReadingValue : parseFloat(manualReadingValue);
    if (isNaN(val) || val < 0) {
      setManualReadingError('Veuillez saisir un index numérique valide.');
      return;
    }

    const lastHours = readingMachine.currentHours ?? readingMachine.totalOperatingHours ?? 0;
    const stats = calculateReadingStats(lastHours, readingMachine.lastMeterReadingDate, val);

    // Rule 1: Reject any new value lower than last recorded reading
    if (stats.isLowerThanLast) {
      setManualReadingError(
        `Impossible d'enregistrer : la nouvelle valeur (${val} h) est inférieure au dernier relevé enregistré (${lastHours} h).`
      );
      return;
    }

    // Rule 2: Warn if delta exceeds calendar hours elapsed, require explicit confirmation
    if (stats.exceedsCalendarHours && !manualReadingConfirmWarning) {
      setManualReadingError(
        `Avertissement de cohérence : le delta (+${stats.deltaHours} h) dépasse le temps calendaire écoulé (${stats.elapsedCalendarHours} h). Veuillez cocher la confirmation d'exactitude pour forcer l'enregistrement.`
      );
      return;
    }

    const nowIso = new Date().toISOString();
    const operatorName = currentUser?.name ? `${currentUser.name} (${currentUser.role || 'Opérateur'})` : 'Opérateur Maintenance';

    const newReading: CounterReading = {
      id: `cr-man-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      machineId: readingMachine.id,
      date: nowIso,
      previousHours: lastHours,
      newHours: val,
      deltaHours: stats.deltaHours,
      operator: operatorName,
      source: 'Manual',
      note: manualReadingNote.trim() || 'Relevé manuel régulier',
    };

    const updatedMachines = machines.map((m) =>
      m.id === readingMachine.id
        ? {
          ...m,
          currentHours: val,
          totalOperatingHours: val,
          lastMeterReadingDate: nowIso,
          lastMeterReadingBy: operatorName,
          counterReadings: [newReading, ...(m.counterReadings || [])],
        }
        : m
    );

    setMachines(updatedMachines);
    if (onUpdateMachines) onUpdateMachines(updatedMachines);

    logMovement({
      category: 'Machine Fleet',
      action: 'UPDATE',
      targetRef: readingMachine.number || readingMachine.name || readingMachine.id,
      user: operatorName,
      details: `Relevé horamètre manuel sur ${readingMachine.number} : ${lastHours} h → ${val} h (+${stats.deltaHours} h). Note : "${newReading.note}".`,
      previousState: `${lastHours} h`,
      newState: `${val} h`,
      severity: 'info',
      metadata: {
        source: 'Manual',
        deltaHours: stats.deltaHours,
        elapsedCalendarHours: stats.elapsedCalendarHours,
      },
    });

    showToast(`Relevé horamètre enregistré pour ${readingMachine.name || readingMachine.number} : ${val.toLocaleString()} h (+${stats.deltaHours} h).`);
    setIsManualReadingModalOpen(false);
    setReadingMachine(null);
  };

  // Handle Correction of past counter reading (Manager / Admin only)
  const handleCorrectReading = (
    machineId: string,
    originalReadingId: string,
    correctedHours: number,
    reason: string
  ) => {
    if (!canEditReadings) {
      showToast('Action non autorisée : seuls les rôles Manager et Admin peuvent corriger un relevé.');
      return;
    }

    const machine = machines.find((m) => m.id === machineId);
    if (!machine) return;

    const originalReading = machine.counterReadings?.find((r) => r.id === originalReadingId);
    const prevHours = originalReading ? originalReading.previousHours : (machine.currentHours || 0);
    const delta = Number((correctedHours - prevHours).toFixed(1));
    const nowIso = new Date().toISOString();
    const operatorName = currentUser?.name ? `${currentUser.name} (${currentUser.role})` : 'Manager / Admin';

    // Audit preservation: We NEVER silently overwrite history!
    // A new correction entry is appended to the counter history log referencing the original reading
    const correctionEntry: CounterReading = {
      id: `cr-corr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      machineId,
      date: nowIso,
      previousHours: prevHours,
      newHours: correctedHours,
      deltaHours: delta,
      operator: operatorName,
      source: 'Correction',
      isCorrection: true,
      correctionReason: reason,
      originalReadingId,
      note: `Correction de l'index du ${originalReading ? new Date(originalReading.date).toLocaleDateString() : 'passé'} (${originalReading?.newHours ?? '?'} h → ${correctedHours} h)`,
    };

    // If the corrected reading is the most recent recorded reading, update currentHours
    const isLatest = !machine.counterReadings || machine.counterReadings[0]?.id === originalReadingId;
    const updatedReadings = [correctionEntry, ...(machine.counterReadings || [])];

    const updatedMachines = machines.map((m) =>
      m.id === machineId
        ? {
          ...m,
          currentHours: isLatest ? correctedHours : m.currentHours,
          totalOperatingHours: isLatest ? correctedHours : m.totalOperatingHours,
          counterReadings: updatedReadings,
        }
        : m
    );

    setMachines(updatedMachines);
    if (onUpdateMachines) onUpdateMachines(updatedMachines);

    logMovement({
      category: 'Machine Fleet',
      action: 'UPDATE',
      targetRef: machine.number || machine.name || machine.id,
      user: operatorName,
      details: `Correction d'un relevé d'horamètre sur ${machine.number} : ${originalReading?.newHours} h rectifié à ${correctedHours} h. Motif : "${reason}".`,
      previousState: `${originalReading?.newHours} h`,
      newState: `${correctedHours} h`,
      severity: 'warning',
      metadata: {
        originalReadingId,
        correctionReason: reason,
        oldValue: originalReading?.newHours,
        newValue: correctedHours,
      },
    });

    showToast(`Correction enregistrée pour ${machine.name || machine.number} : ${correctedHours.toLocaleString()} h.`);
  };

  const generateRecommendedPlan = (): any[] => {
    return RECOMMENDED_TASKS.flatMap((group) =>
      group.tasks.map((taskDesc) => ({
        id: Math.random().toString(36).substr(2, 9),
        type: 'inspection',
        frequency: 'hours',
        frequencyHours: group.hours,
        description: taskDesc,
      }))
    );
  };

  // Form State
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    serialNumber: '',
    injectingProduct: '',
    type: 'Simple Injection',
    manufacturingYear: new Date().getFullYear(),
    location: '',
    siteNumber: '',
    clampingForce: 80,
    condition: 'Excellent',
    status: 'operational' as Machine['status'],
    nextMaintenance: '',
    installationDate: '',
    currentHours: 0,
    imageUrl: '',
    preventivePlan: [] as any[],
    closingType: '',
    moldThicknessMin: undefined as number | undefined,
    moldThicknessMax: undefined as number | undefined,
    centeringDiameter: undefined as number | undefined,
    tieBarSpacingHorizontal: undefined as number | undefined,
    tieBarSpacingVertical: undefined as number | undefined,
    maxOpeningStroke: undefined as number | undefined,
    maxEjectionStroke: undefined as number | undefined,
    coreCount: undefined as number | undefined,
    screwDiameter: undefined as number | undefined,
    maxInjectableVolume: undefined as number | undefined,
    coolingChannelCount: undefined as number | undefined,
    thermalRegulation: '',
    accessories: '',
    hydraulicOilType: '',
    lubricantType: '',
    reservoirCapacity: undefined as number | undefined,
  });

  const handleAddMachine = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let nextHours = 0;
    const hourTasks = formData.preventivePlan.filter(
      (t) => t.frequency === 'hours' && t.frequencyHours > 0
    );

    if (hourTasks.length > 0) {
      const smallestFreq = Math.min(...hourTasks.map((t) => t.frequencyHours));
      nextHours = formData.currentHours + smallestFreq;
    } else {
      const nextThreshold = RECOMMENDED_TASKS.find((t) => t.hours > formData.currentHours);
      if (nextThreshold) {
        nextHours = nextThreshold.hours;
      }
    }

    if (isEditMode && formData.id) {
      const updated = machines.map((m) =>
        m.id === formData.id
          ? {
            ...m,
            ...formData,
            number: m.number || formData.name,
            clampingForceTons: formData.clampingForce,
            year: formData.manufacturingYear,
            locationNumber: formData.siteNumber || m.locationNumber || 'LOC-01',
            nextMaintenanceHours: nextHours,
            totalOperatingHours: formData.currentHours,
          }
          : m
      );
      setMachines(updated);
      if (onUpdateMachines) onUpdateMachines(updated);
      showToast(`Machine ${formData.name} updated successfully.`);
    } else {
      const newMachine: Machine = {
        ...formData,
        id: `m-${Date.now()}`,
        number: formData.name.split(' ')[0] || `INJ-${machines.length + 1}`,
        serialNumber: formData.serialNumber || `SN-${Math.floor(100000 + Math.random() * 900000)}`,
        clampingForceTons: formData.clampingForce,
        year: formData.manufacturingYear,
        locationNumber: formData.siteNumber || `LOC-${machines.length + 1}`,
        nextMaintenanceHours: nextHours,
        totalOperatingTime: formData.currentHours * 60,
        totalOperatingHours: formData.currentHours,
        totalDownTime: 0,
        failureCount: 0,
        mtbfHours: 400,
        mttrHours: 2.0,
      };
      const updated = [newMachine, ...machines];
      setMachines(updated);
      if (onUpdateMachines) onUpdateMachines(updated);
      showToast(`Machine ${formData.name} registered successfully.`);
    }

    setIsModalOpen(false);
    setIsEditMode(false);
    setLoading(false);
  };

  const handleEditClick = (machine: Machine) => {
    const liveHours = calculateLiveHours(machine);
    setFormData({
      id: machine.id,
      name: machine.name || machine.number || '',
      serialNumber: machine.serialNumber || machine.number || '',
      injectingProduct: machine.injectingProduct || '',
      type: machine.type || 'Simple Injection',
      manufacturingYear: machine.manufacturingYear || machine.year || new Date().getFullYear(),
      location: machine.location || machine.line || '',
      siteNumber: machine.siteNumber || machine.locationNumber?.replace('LOC-', '') || '',
      clampingForce: machine.clampingForce || machine.clampingForceTons || 80,
      condition: machine.condition || 'Excellent',
      status: machine.status || 'operational',
      nextMaintenance: machine.nextMaintenance || '',
      installationDate: machine.installationDate || '2022-01-15',
      currentHours: liveHours,
      imageUrl: machine.imageUrl || '',
      preventivePlan: machine.preventivePlan || generateRecommendedPlan(),
      closingType: machine.closingType || '',
      moldThicknessMin: machine.moldThicknessMin,
      moldThicknessMax: machine.moldThicknessMax,
      centeringDiameter: machine.centeringDiameter,
      tieBarSpacingHorizontal: machine.tieBarSpacingHorizontal,
      tieBarSpacingVertical: machine.tieBarSpacingVertical,
      maxOpeningStroke: machine.maxOpeningStroke,
      maxEjectionStroke: machine.maxEjectionStroke,
      coreCount: machine.coreCount,
      screwDiameter: machine.screwDiameter,
      maxInjectableVolume: machine.maxInjectableVolume,
      coolingChannelCount: machine.coolingChannelCount,
      thermalRegulation: machine.thermalRegulation || '',
      accessories: machine.accessories || '',
      hydraulicOilType: machine.hydraulicOilType || '',
      lubricantType: machine.lubricantType || '',
      reservoirCapacity: machine.reservoirCapacity,
    });
    setShowTechSpecs(false);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleDeleteMachine = (id: string) => {
    if (!window.confirm('Are you sure you want to delete this machine?')) return;
    const updated = machines.filter((m) => m.id !== id);
    setMachines(updated);
    if (onUpdateMachines) onUpdateMachines(updated);
    showToast('Machine deleted.');
  };

  const handleExport = () => {
    exportToCSV(filteredItems, `machines_export_${new Date().toISOString().split('T')[0]}.csv`);
    showToast('Machine list exported as CSV.');
  };

  // Filter & sort
  const filteredItems = [...machines]
    .filter((item) => {
      const q = searchTerm.toLowerCase().trim();
      const mName = item.name || item.number || '';
      const mSerial = item.serialNumber || item.number || '';
      const mLoc = item.location || item.line || '';
      const mSite = item.siteNumber || item.locationNumber || '';

      const matchesSearch =
        !q ||
        mName.toLowerCase().includes(q) ||
        (item.type && item.type.toLowerCase().includes(q)) ||
        mSerial.toLowerCase().includes(q) ||
        mLoc.toLowerCase().includes(q) ||
        mSite.toLowerCase().includes(q) ||
        `#${mSite}`.toLowerCase().includes(q);

      const matchesFilter =
        filterStatus === 'all' ||
        (filterStatus === 'stale_reading' && isMeterReadingStale(item, 7)) ||
        item.status === filterStatus ||
        (filterStatus === 'operational' && item.status === 'Running') ||
        (filterStatus === 'maintenance' && item.status === 'Under Maintenance') ||
        (filterStatus === 'down' && item.status === 'Stopped');

      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (!sortField) return 0;

      if (sortField === 'location') {
        const locA = (a.location || a.line || '').trim();
        const locB = (b.location || b.line || '').trim();
        if (locA !== locB) {
          const locComp = locA.localeCompare(locB, undefined, { numeric: true, sensitivity: 'base' });
          if (locComp !== 0) return sortDirection === 'asc' ? locComp : -locComp;
        }

        const numA = parseFloat(String(a.siteNumber || a.locationNumber || '').replace(/[^\d.-]/g, ''));
        const numB = parseFloat(String(b.siteNumber || b.locationNumber || '').replace(/[^\d.-]/g, ''));

        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
          return sortDirection === 'asc' ? numA - numB : numB - numA;
        }
        return 0;
      }

      const valA = a[sortField] ?? '';
      const valB = b[sortField] ?? '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const comp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? comp : -comp;
    });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const pagedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
      case 'Running':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'down':
      case 'Stopped':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'maintenance':
      case 'Under Maintenance':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'idle':
      case 'Setup':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getDisplayStatus = (status: string) => {
    if (status === 'Running') return 'operational';
    if (status === 'Stopped') return 'down';
    if (status === 'Under Maintenance') return 'maintenance';
    if (status === 'Setup') return 'idle';
    return status;
  };

  return (
    <div className="space-y-6 relative min-h-[800px] p-4 sm:p-6 max-w-[1600px] mx-auto">
      {/* Toast */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 bg-neutral-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* List View (Blurred when form is open) */}
      <div
        className={cn(
          'transition-all duration-500 ease-in-out',
          isModalOpen || isHistoryModalOpen
            ? 'blur-xl opacity-20 scale-95 pointer-events-none'
            : 'blur-0 opacity-100 scale-100'
        )}
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Machine Management</h1>
            <p className="text-xs text-gray-500 mt-0.5">Injection Molding Presses & Shopfloor Fleet Telemetry</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all cursor-pointer shadow-xs"
            >
              <Download size={18} />
              Export CSV
            </button>
            <button
              onClick={() => {
                setRefreshing(true);
                setTimeout(() => {
                  setRefreshing(false);
                  showToast('Machine telemetry refreshed.');
                }, 400);
              }}
              disabled={refreshing}
              className={cn(
                'p-2 text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all cursor-pointer shadow-xs',
                refreshing && 'animate-spin text-blue-600'
              )}
              title="Refresh Machines"
            >
              <RotateCw size={18} />
            </button>
            <button
              onClick={() => {
                setIsEditMode(false);
                setFormData({
                  id: '',
                  name: '',
                  serialNumber: '',
                  injectingProduct: '',
                  type: 'Simple Injection',
                  manufacturingYear: new Date().getFullYear(),
                  location: 'Line A - Automotive',
                  siteNumber: `${machines.length + 1}`,
                  condition: 'Excellent',
                  clampingForce: 150,
                  status: 'operational',
                  nextMaintenance: '',
                  installationDate: new Date().toISOString().split('T')[0],
                  currentHours: 0,
                  imageUrl: '',
                  preventivePlan: generateRecommendedPlan(),
                  closingType: 'Genouillère hydraulique haute précision',
                  moldThicknessMin: 150,
                  moldThicknessMax: 450,
                  centeringDiameter: 125,
                  tieBarSpacingHorizontal: 410,
                  tieBarSpacingVertical: 410,
                  maxOpeningStroke: 350,
                  maxEjectionStroke: 120,
                  coreCount: 2,
                  screwDiameter: 35,
                  maxInjectableVolume: 180,
                  coolingChannelCount: 8,
                  thermalRegulation: 'Eau tempérée / Ravitaillement centralisé',
                  accessories: 'Robot 3 axes, Tapis d\'évacuation',
                  hydraulicOilType: 'ISO VG 46',
                  lubricantType: 'Graisse lithium EP2',
                  reservoirCapacity: 250,
                });
                setShowTechSpecs(false);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Machine
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 p-4 bg-white border border-gray-100 shadow-sm sm:flex-row sm:items-center rounded-xl mt-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search machines by name, serial, site #, location..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="text-gray-400" size={18} />
            <select
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer font-medium text-gray-700"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Status</option>
              <option value="stale_reading">No Reading ({staleCount})</option>
              <option value="operational">Operational</option>
              <option value="down">Down</option>
              <option value="maintenance">Maintenance</option>
              <option value="idle">Standby</option>
            </select>
          </div>
        </div>

        {/* List View Table */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden mt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th
                    className="px-6 py-4 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-blue-600 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={sortField === 'name' ? 'text-blue-600 font-bold' : 'text-gray-400'}>
                        Machine
                      </span>
                      {sortField === 'name' ? (
                        sortDirection === 'asc' ? <ArrowUp size={13} className="text-blue-600" /> : <ArrowDown size={13} className="text-blue-600" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-300 hover:text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-blue-600 transition-colors"
                    onClick={() => handleSort('type')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={sortField === 'type' ? 'text-blue-600 font-bold' : 'text-gray-400'}>
                        Type
                      </span>
                      {sortField === 'type' ? (
                        sortDirection === 'asc' ? <ArrowUp size={13} className="text-blue-600" /> : <ArrowDown size={13} className="text-blue-600" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-300 hover:text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-blue-600 transition-colors"
                    onClick={() => handleSort('manufacturingYear')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={sortField === 'manufacturingYear' ? 'text-blue-600 font-bold' : 'text-gray-400'}>
                        Year
                      </span>
                      {sortField === 'manufacturingYear' ? (
                        sortDirection === 'asc' ? <ArrowUp size={13} className="text-blue-600" /> : <ArrowDown size={13} className="text-blue-600" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-300 hover:text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-blue-600 transition-colors"
                    onClick={() => handleSort('location')}
                    title="Click to sort by location and location number (#)"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={sortField === 'location' ? 'text-blue-600 font-bold' : 'text-gray-400'}>
                        Location
                      </span>
                      {sortField === 'location' ? (
                        sortDirection === 'asc' ? <ArrowUp size={13} className="text-blue-600" /> : <ArrowDown size={13} className="text-blue-600" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-300 hover:text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-blue-600 transition-colors"
                    onClick={() => handleSort('clampingForce')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={sortField === 'clampingForce' ? 'text-blue-600 font-bold' : 'text-gray-400'}>
                        Force (T)
                      </span>
                      {sortField === 'clampingForce' ? (
                        sortDirection === 'asc' ? <ArrowUp size={13} className="text-blue-600" /> : <ArrowDown size={13} className="text-blue-600" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-300 hover:text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-blue-600 transition-colors"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={sortField === 'status' ? 'text-blue-600 font-bold' : 'text-gray-400'}>
                        Status
                      </span>
                      {sortField === 'status' ? (
                        sortDirection === 'asc' ? <ArrowUp size={13} className="text-blue-600" /> : <ArrowDown size={13} className="text-blue-600" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-300 hover:text-gray-400" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pagedItems.map((item) => {
                  const dispStatus = getDisplayStatus(item.status);
                  const mName = item.name || `${item.brand || 'Injection Press'} ${item.model || item.number}`;
                  const mSerial = item.serialNumber || item.number;
                  const mLoc = item.location || item.line || 'Atelier';
                  const mSite = item.siteNumber || item.locationNumber?.replace('LOC-', '') || item.number.replace('INJ-', '');
                  const mForce = item.clampingForce || item.clampingForceTons || 80;
                  const mYear = item.manufacturingYear || item.year || 2022;
                  const mType = item.type || 'Simple Injection';
                  const liveHours = calculateLiveHours(item);

                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        'group hover:bg-gray-50/50 transition-colors',
                        dispStatus === 'down'
                          ? 'bg-red-50/5'
                          : dispStatus === 'maintenance'
                            ? 'bg-amber-50/5'
                            : ''
                      )}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div
                            className={cn(
                              'rounded-xl mr-3 w-12 h-12 overflow-hidden flex items-center justify-center border border-gray-100 shrink-0',
                              dispStatus === 'down'
                                ? 'bg-red-100'
                                : dispStatus === 'maintenance'
                                  ? 'bg-amber-100'
                                  : 'bg-blue-50'
                            )}
                          >
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={mName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <HardDrive
                                className={cn(
                                  'w-5 h-5',
                                  dispStatus === 'down'
                                    ? 'text-red-600'
                                    : dispStatus === 'maintenance'
                                      ? 'text-amber-600'
                                      : 'text-blue-600'
                                )}
                              />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{mName}</p>
                            <p className="text-xs text-gray-500 font-mono">{mSerial}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{mType}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{mYear}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <div className="flex items-center text-sm text-gray-600">
                            <MapPin size={14} className="mr-1.5 text-gray-400 shrink-0" />
                            <span>{mLoc}</span>
                          </div>
                          {mSite && (
                            <div className="text-xs text-blue-600 ml-5 font-bold mt-0.5">
                              #{mSite}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-gray-900 font-mono">{mForce}T</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={cn(
                                'px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase w-fit',
                                getStatusColor(dispStatus)
                              )}
                            >
                              {dispStatus}
                            </span>
                          </div>
                          {item.statusReason && (dispStatus === 'down' || dispStatus === 'maintenance') && (
                            <span className="text-[10px] text-red-600 font-bold italic max-w-[150px] truncate mt-0.5">
                              Reason: {item.statusReason}
                            </span>
                          )}
                          <div className="flex flex-col mt-1 gap-0.5">
                            {item.nextMaintenanceHours && (
                              <span className="text-[10px] text-blue-600 font-bold">
                                Next: {formatHoursToDays(item.nextMaintenanceHours)}
                              </span>
                            )}
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-500 font-medium">
                                Current: {formatHoursToDays(liveHours)}
                              </span>
                              <button
                                onClick={() => handleOpenManualReading(item)}
                                className="p-0.5 text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
                                title="Relever Compteur"
                              >
                                <Clock size={11} />
                              </button>
                            </div>
                            <span
                              className={cn(
                                'text-[10px] font-bold',
                                (item.mtbfHours || 400) >= 500
                                  ? 'text-emerald-600'
                                  : (item.mtbfHours || 400) >= 200
                                    ? 'text-amber-600'
                                    : 'text-red-600'
                              )}
                            >
                              MTBF: {item.mtbfHours || 420}h
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenManualReading(item)}
                            className="px-2.5 py-1.5 text-blue-700 hover:text-white hover:bg-blue-600 rounded-lg transition-all cursor-pointer flex items-center gap-1 font-bold text-xs shadow-xs active:scale-95"
                            title="Relever l'index de l'horamètre (contrôle physique)"
                          >
                            <span className="hidden xl:inline">Compteur</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedMachine(item);
                              setIsHistoryModalOpen(true);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                            title="Historique des relevés & maintenance"
                          >
                            <History size={17} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedMachine(item);
                              setIsQrModalOpen(true);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                            title="QR Code & Machine Label"
                          >
                            <QrCode size={18} />
                          </button>
                          <button
                            onClick={() =>
                              generateFicheTechniquePdf(
                                item,
                                currentUser
                                  ? { name: currentUser.name, role: currentUser.role }
                                  : undefined
                              )
                            }
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                            title="Télécharger Fiche Technique (PDF)"
                          >
                            <FileText size={18} />
                          </button>
                          <button
                            onClick={() => handleEditClick(item)}
                            className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteMachine(item.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredItems.length === 0 && (
            <div className="py-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-gray-100 rounded-full">
                <HardDrive className="text-gray-400" size={32} />
              </div>
              <h3 className="text-lg font-medium text-gray-900">No machines found</h3>
              <p className="text-gray-500">Try adjusting your search or filters.</p>
            </div>
          )}

          <TableFooter
            totalItems={filteredItems.length}
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

      {/* FORM VIEW (OVERLAY WITH SMOOTH BLUR AND ZERO-POPUP FEEL) */}
      {isModalOpen && (
        <div className="absolute inset-x-0 top-0 z-20 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isEditMode ? 'Edit Machine' : 'Add New Machine'}
              </h1>
              <p className="text-gray-500">
                Fill in the details below to {isEditMode ? 'update' : 'register'} the plant injection asset.
              </p>
            </div>
            <button
              onClick={() => {
                setIsModalOpen(false);
                setIsEditMode(false);
              }}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
            >
              Back to List
            </button>
          </div>

          <div className="bg-white/95 backdrop-blur-2xl border border-neutral-300 shadow-2xl rounded-3xl p-6 sm:p-8">
            <form onSubmit={handleAddMachine} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Machine Image */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
                    Machine Image
                  </label>
                  <div className="relative group">
                    <div
                      className={cn(
                        'w-full aspect-square rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden transition-all group-hover:border-blue-400 bg-gray-50/50',
                        formData.imageUrl && 'border-solid border-blue-100 bg-blue-50/10'
                      )}
                    >
                      {formData.imageUrl ? (
                        <>
                          <img
                            src={formData.imageUrl}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, imageUrl: '' })}
                            className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-full text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-center p-4">
                          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mb-2">
                            <Camera className="text-blue-600" size={20} />
                          </div>
                          <p className="text-xs font-medium text-gray-500">Click to upload image</p>
                          <p className="text-[10px] text-gray-400 mt-1">PNG, JPG up to 10MB</p>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              setFormData({ ...formData, imageUrl: ev.target?.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
                        Machine Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Engel Victory 330/80"
                        className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
                        Serial Number *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="SN-123456"
                        className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono"
                        value={formData.serialNumber}
                        onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
                        Injecting Product
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Plastic Casing"
                        className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        value={formData.injectingProduct}
                        onChange={(e) => setFormData({ ...formData, injectingProduct: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
                        Machine Type *
                      </label>
                      <select
                        required
                        className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium"
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      >
                        <option value="Simple Injection">Simple Injection</option>
                        <option value="Double Injection">Double Injection</option>
                        <option value="Triple Injection">Triple Injection</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
                        Manufacturing Year *
                      </label>
                      <input
                        type="number"
                        required
                        min="1980"
                        max={new Date().getFullYear()}
                        placeholder="e.g. 2022"
                        className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        value={formData.manufacturingYear}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            manufacturingYear: parseInt(e.target.value) || new Date().getFullYear(),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
                        Installation Date in Tunisia
                      </label>
                      <input
                        type="date"
                        className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono"
                        value={formData.installationDate}
                        onChange={(e) => setFormData({ ...formData, installationDate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Location & Clamping Force */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
                    Location & Site Number *
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="text"
                        required
                        placeholder="Site Name / Line"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      />
                    </div>
                    <div className="relative w-1/3">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">
                        #
                      </span>
                      <input
                        type="text"
                        placeholder="01"
                        className="w-full pl-8 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold text-blue-700"
                        value={formData.siteNumber}
                        onChange={(e) => setFormData({ ...formData, siteNumber: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
                    Clamping Force (Tons) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 150"
                    className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono font-bold"
                    value={formData.clampingForce}
                    onChange={(e) =>
                      setFormData({ ...formData, clampingForce: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              {/* Status & Operational Hours */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
                    Status *
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="operational">Operational</option>
                    <option value="down">Down</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="idle">Waiting</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
                    Current Operational Hours *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 500"
                    className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono font-bold"
                    value={formData.currentHours}
                    onChange={(e) =>
                      setFormData({ ...formData, currentHours: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              {/* Preventive Plan Section */}
              <div className="border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-gray-900">Preventive Maintenance Plan</h4>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, preventivePlan: generateRecommendedPlan() })
                    }
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider cursor-pointer"
                  >
                    Reset to Recommended
                  </button>
                </div>
                <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2">
                  {formData.preventivePlan.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl border border-gray-100"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 capitalize">
                          {task.type} -{' '}
                          {task.frequency === 'hours' ? `Every ${task.frequencyHours}h` : task.frequency}
                        </p>
                        <p className="text-xs text-gray-500">{task.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            preventivePlan: formData.preventivePlan.filter((t) => t.id !== task.id),
                          })
                        }
                        className="text-red-500 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Collapsible Technical Specifications (Fiche Machine) */}
              <div className="border border-gray-200 rounded-2xl overflow-hidden bg-gray-50/40">
                <button
                  type="button"
                  onClick={() => setShowTechSpecs(!showTechSpecs)}
                  className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">
                      Spécifications Techniques (Fiche Machine)
                    </span>
                    <span className="text-xs text-gray-400 font-medium">(Optionnel)</span>
                  </div>
                  {showTechSpecs ? <ChevronUp size={18} className="text-gray-500" /> : <ChevronDown size={18} className="text-gray-500" />}
                </button>

                {showTechSpecs && (
                  <div className="p-6 space-y-6 border-t border-gray-200 bg-white">
                    {/* Closing & Clamping */}
                    <div>
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">
                        Système de Fermeture
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                            Type de fermeture
                          </label>
                          <input
                            type="text"
                            placeholder="ex: Genouillère, Hydraulique"
                            className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm"
                            value={formData.closingType}
                            onChange={(e) => setFormData({ ...formData, closingType: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Mold Dimensions */}
                    <div>
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">
                        Dimensions du Moule
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                            Épaisseur moule - Mini (mm)
                          </label>
                          <input
                            type="number"
                            placeholder="ex: 150"
                            className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm"
                            value={formData.moldThicknessMin ?? ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                moldThicknessMin: e.target.value ? parseFloat(e.target.value) : undefined,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                            Épaisseur moule - Maxi (mm)
                          </label>
                          <input
                            type="number"
                            placeholder="ex: 450"
                            className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm"
                            value={formData.moldThicknessMax ?? ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                moldThicknessMax: e.target.value ? parseFloat(e.target.value) : undefined,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                            Diamètre de centrage (mm)
                          </label>
                          <input
                            type="number"
                            placeholder="ex: 125"
                            className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm"
                            value={formData.centeringDiameter ?? ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                centeringDiameter: e.target.value ? parseFloat(e.target.value) : undefined,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                            Passage entre colonnes - H (mm)
                          </label>
                          <input
                            type="number"
                            placeholder="ex: 410"
                            className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm"
                            value={formData.tieBarSpacingHorizontal ?? ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                tieBarSpacingHorizontal: e.target.value ? parseFloat(e.target.value) : undefined,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                            Passage entre colonnes - V (mm)
                          </label>
                          <input
                            type="number"
                            placeholder="ex: 410"
                            className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm"
                            value={formData.tieBarSpacingVertical ?? ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                tieBarSpacingVertical: e.target.value ? parseFloat(e.target.value) : undefined,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {/* Strokes & Cores */}
                    <div>
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">
                        Courses & Noyaux
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                            Course ouverture maxi (mm)
                          </label>
                          <input
                            type="number"
                            placeholder="ex: 350"
                            className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm"
                            value={formData.maxOpeningStroke ?? ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                maxOpeningStroke: e.target.value ? parseFloat(e.target.value) : undefined,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                            Course éjection maxi (mm)
                          </label>
                          <input
                            type="number"
                            placeholder="ex: 120"
                            className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm"
                            value={formData.maxEjectionStroke ?? ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                maxEjectionStroke: e.target.value ? parseFloat(e.target.value) : undefined,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                            Nombre de noyaux
                          </label>
                          <input
                            type="number"
                            placeholder="ex: 2"
                            className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm"
                            value={formData.coreCount ?? ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                coreCount: e.target.value ? parseFloat(e.target.value) : undefined,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {/* Injection Group */}
                    <div>
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">
                        Groupe d'Injection
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                            Diamètre vis (mm)
                          </label>
                          <input
                            type="number"
                            placeholder="ex: 35"
                            className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm"
                            value={formData.screwDiameter ?? ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                screwDiameter: e.target.value ? parseFloat(e.target.value) : undefined,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                            Volume injectable maxi (cm³)
                          </label>
                          <input
                            type="number"
                            placeholder="ex: 180"
                            className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm"
                            value={formData.maxInjectableVolume ?? ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                maxInjectableVolume: e.target.value ? parseFloat(e.target.value) : undefined,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                            Nb canal refroidi
                          </label>
                          <input
                            type="number"
                            placeholder="ex: 8"
                            className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm"
                            value={formData.coolingChannelCount ?? ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                coolingChannelCount: e.target.value ? parseFloat(e.target.value) : undefined,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {/* Fluids & Lubricants */}
                    <div>
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">
                        Fluides & Lubrification
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                            Type d'huile hydraulique
                          </label>
                          <input
                            type="text"
                            placeholder="ex: ISO VG 46"
                            className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm"
                            value={formData.hydraulicOilType}
                            onChange={(e) => setFormData({ ...formData, hydraulicOilType: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                            Type de lubrifiant
                          </label>
                          <input
                            type="text"
                            placeholder="ex: Graisse lithium EP2"
                            className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm"
                            value={formData.lubricantType}
                            onChange={(e) => setFormData({ ...formData, lubricantType: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                            Capacité réservoir (L)
                          </label>
                          <input
                            type="number"
                            placeholder="ex: 250"
                            className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm"
                            value={formData.reservoirCapacity ?? ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                reservoirCapacity: e.target.value ? parseFloat(e.target.value) : undefined,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Action Buttons */}
              <div className="pt-6 flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setIsEditMode(false);
                  }}
                  className="flex-1 px-6 py-3 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-3 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 cursor-pointer"
                >
                  {loading ? 'Saving...' : isEditMode ? 'Save Changes' : 'Register Machine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RELEVER COMPTEUR MODAL (MANUAL METER READING WITH VALIDATION & ΔH CALCULATION) */}
      {isManualReadingModalOpen && readingMachine && (() => {
        const lastHours = readingMachine.currentHours ?? readingMachine.totalOperatingHours ?? 0;
        const currentVal = typeof manualReadingValue === 'number' ? manualReadingValue : parseFloat(manualReadingValue) || 0;
        const stats = calculateReadingStats(lastHours, readingMachine.lastMeterReadingDate, currentVal);
        const lastDateFormatted = readingMachine.lastMeterReadingDate
          ? new Date(readingMachine.lastMeterReadingDate).toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
          : 'Aucun relevé antérieur';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 border border-neutral-300 shadow-2xl max-w-lg w-full space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-neutral-900 tracking-tight">
                      Relever l'Index Compteur
                    </h3>
                    <p className="text-xs text-neutral-500 font-mono">
                      {readingMachine.name || readingMachine.number} · {readingMachine.siteNumber ? `#${readingMachine.siteNumber}` : readingMachine.number} · {readingMachine.location || readingMachine.line}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsManualReadingModalOpen(false);
                    setReadingMachine(null);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Last Reading Summary Card */}
              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500 font-medium">Dernier index enregistré :</span>
                  <span className="font-mono text-base font-black text-neutral-900">
                    {lastHours.toLocaleString()} h
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-neutral-500">Date &amp; Opérateur du dernier relevé :</span>
                  <span className="font-medium text-neutral-700">
                    {lastDateFormatted} · {readingMachine.lastMeterReadingBy || 'Non renseigné'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] pt-1 border-t border-neutral-200">
                  <span className="text-neutral-500">Temps calendaire écoulé depuis :</span>
                  <span className="font-mono font-bold text-blue-700">
                    {stats.elapsedCalendarHours} h ({stats.elapsedCalendarDays} jours)
                  </span>
                </div>
              </div>

              {/* Reading Input Form */}
              <form onSubmit={handleSaveManualReading} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-neutral-800 uppercase tracking-wider mb-1.5">
                    Nouvel Index Horamètre (h) * :
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.1"
                    placeholder={`ex: ${lastHours + 24}`}
                    className="w-full px-4 py-3 bg-white border border-neutral-300 rounded-xl text-base font-bold font-mono text-neutral-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={manualReadingValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      setManualReadingValue(v === '' ? '' : parseFloat(v) || 0);
                      setManualReadingError(null);
                    }}
                  />
                </div>

                {/* Real-time Dynamic Statistics */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50/60 rounded-xl border border-blue-200/80">
                  <div>
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                      Delta Heures (Δh)
                    </span>
                    <span className={cn('text-base font-black font-mono', stats.deltaHours >= 0 ? 'text-blue-900' : 'text-red-700')}>
                      {stats.deltaHours >= 0 ? `+${stats.deltaHours}` : stats.deltaHours} h
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                      Cadence Moyenne (h / jour)
                    </span>
                    <span className="text-base font-black font-mono text-blue-900">
                      {stats.averageHoursPerDay} h/j
                    </span>
                  </div>
                </div>

                {/* Validation Rule 1: Hard rejection if lower than last reading */}
                {stats.isLowerThanLast && manualReadingValue !== '' && (
                  <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-red-800 flex items-start gap-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
                    <div>
                      <p className="font-bold">Index inférieur au dernier relevé :</p>
                      <p className="text-[11px] mt-0.5">
                        La valeur saisie ({currentVal} h) ne peut pas être inférieure à {lastHours} h. Les horamètres industriels sont strictement cumulatifs.
                      </p>
                    </div>
                  </div>
                )}

                {/* Validation Rule 2: Soft warning if delta exceeds elapsed calendar hours */}
                {stats.exceedsCalendarHours && !stats.isLowerThanLast && manualReadingValue !== '' && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 space-y-2">
                    <div className="flex items-start gap-2">
                      <ShieldAlert size={16} className="shrink-0 mt-0.5 text-amber-600" />
                      <div>
                        <p className="font-bold">Avertissement de cohérence calendaire :</p>
                        <p className="text-[11px] mt-0.5">
                          Le delta calculé (+{stats.deltaHours} h) dépasse le temps calendaire total écoulé ({stats.elapsedCalendarHours} h). Cela indique une probable faute de frappe sur le compteur.
                        </p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 pt-1 border-t border-amber-200 cursor-pointer text-xs font-bold text-amber-950">
                      <input
                        type="checkbox"
                        checked={manualReadingConfirmWarning}
                        onChange={(e) => setManualReadingConfirmWarning(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 border-amber-300 focus:ring-blue-500"
                      />
                      <span>Je confirme l'exactitude de cet index malgré l'anomalie calendaire</span>
                    </label>
                  </div>
                )}

                {manualReadingError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{manualReadingError}</span>
                  </div>
                )}

                {/* Optional Note Field */}
                <div>
                  <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                    Note ou motif du relevé (Optionnel) :
                  </label>
                  <textarea
                    rows={2}
                    value={manualReadingNote}
                    onChange={(e) => setManualReadingNote(e.target.value)}
                    placeholder="Ex: Contrôle hebdomadaire poste matin, fin de série OF-4401..."
                    className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs text-neutral-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Footer with Operator Signature & Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-neutral-200">
                  <span className="text-[11px] text-neutral-500 font-medium">
                    Signataire : <b className="text-neutral-800">{currentUser?.name || 'Opérateur'}</b>
                  </span>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualReadingModalOpen(false);
                        setReadingMachine(null);
                      }}
                      className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={stats.isLowerThanLast || (stats.exceedsCalendarHours && !manualReadingConfirmWarning)}
                      className={cn(
                        'flex-1 sm:flex-none px-5 py-2.5 text-xs font-bold text-white rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer',
                        stats.isLowerThanLast || (stats.exceedsCalendarHours && !manualReadingConfirmWarning)
                          ? 'bg-neutral-400 cursor-not-allowed opacity-70'
                          : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                      )}
                    >
                      <Check size={14} />
                      <span>Enregistrer le Relevé</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* QR CODE MODAL */}
      {isQrModalOpen && selectedMachine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 border border-neutral-300 shadow-2xl max-w-md w-full space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-neutral-900">Machine QR Code & Label</h3>
              <button
                onClick={() => {
                  setIsQrModalOpen(false);
                  setSelectedMachine(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-white border-2 border-gray-100 rounded-2xl shadow-sm flex flex-col items-center">
                <QRCodeCanvas
                  id="machine-qr-code"
                  value={`http://gmao.thermoplastics.lan/mobile-status?id=${selectedMachine.id}`}
                  size={190}
                  level="H"
                  includeMargin={true}
                />
                <div className="mt-3 text-center w-full">
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 text-blue-700 font-extrabold text-sm rounded-xl border border-blue-200/60 font-mono">
                    <span className="text-[11px] text-blue-500 font-sans font-bold uppercase">N° Machine :</span>
                    <span>
                      {selectedMachine.siteNumber
                        ? `#${selectedMachine.siteNumber}`
                        : selectedMachine.number}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <h4 className="text-base font-bold text-gray-900">
                  {selectedMachine.name || selectedMachine.number}
                </h4>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  SN: {selectedMachine.serialNumber || selectedMachine.number} · Location: {selectedMachine.location || selectedMachine.line}
                </p>
              </div>

              <div className="w-full flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const canvas = document.getElementById('machine-qr-code') as HTMLCanvasElement;
                    if (canvas) {
                      const link = document.createElement('a');
                      link.download = `qr-${selectedMachine.number}.png`;
                      link.href = canvas.toDataURL('image/png');
                      link.click();
                      showToast('QR Code image downloaded.');
                    }
                  }}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2.5 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Download PNG
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const canvas = document.getElementById('machine-qr-code') as HTMLCanvasElement;
                    if (canvas) {
                      const win = window.open('', '_blank');
                      if (win) {
                        win.document.write(`
                          <html><head><title>Print QR - ${selectedMachine.name}</title>
                          <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;margin:0}</style>
                          </head><body>
                          <h2>THERMOPLASTICS TUNISIA</h2>
                          <h3>${selectedMachine.name || selectedMachine.number}</h3>
                          <img src="${canvas.toDataURL()}" style="width:240px;height:240px" />
                          <h2 style="font-family:monospace;color:#1e40af;margin-top:12px">Machine N° #${selectedMachine.siteNumber || selectedMachine.number}</h2>
                          <p style="font-size:12px;color:#64748b">SN: ${selectedMachine.serialNumber || selectedMachine.number} · ${selectedMachine.location || ''}</p>
                          <script>window.onload=()=>{window.print();window.close();}</script>
                          </body></html>
                        `);
                        win.document.close();
                      }
                    }
                  }}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2.5 text-xs font-bold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4 mr-1.5" />
                  Print Label
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAINTENANCE HISTORY VIEW (OVERLAY) */}
      {isHistoryModalOpen && selectedMachine && (
        <div className="absolute inset-x-0 top-0 z-20 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Maintenance History</h1>
              <p className="text-gray-500">
                {selectedMachine.name || selectedMachine.number} — {selectedMachine.serialNumber || selectedMachine.number}
              </p>
            </div>
            <button
              onClick={() => {
                setIsHistoryModalOpen(false);
                setSelectedMachine(null);
              }}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
            >
              Back to List
            </button>
          </div>

          <div className="bg-white/95 backdrop-blur-2xl border border-neutral-300 shadow-2xl rounded-3xl p-6 sm:p-8">
            <MachineHistory
              machineId={selectedMachine.id}
              machineName={selectedMachine.name || selectedMachine.number}
              machine={selectedMachine}
              orders={orders}
              reports={reports}
              initialTab="readings"
              canEditReadings={canEditReadings}
              onCorrectReading={handleCorrectReading}
              onOpenNewReadingModal={handleOpenManualReading}
            />
          </div>
        </div>
      )}
    </div>
  );
};
