import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Machine,
  Mold,
  MoldStatus,
  MoldMaintenance,
  RepairLocation,
  InterventionRequest,
  MaintenanceOrder,
  InterventionReport,
  StockItem,
  ProductionOrderOF,
  AppUser,
  MaintenanceCategory,
  PriorityLevel,
} from '../types/gmao';
import {
  Wrench,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Search,
  Plus,
  Send,
  Box,
  HardDrive,
  Download,
  AlertTriangle,
  RotateCcw,
  Check,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  XCircle,
  Eye,
  Lock,
  Unlock,
  FileText,
  UserCheck,
  Calendar,
  Layers,
  Sparkles,
  ClipboardList,
  List,
  LayoutGrid,
  AlertCircle,
  Tag,
  Hash,
  Activity,
  Trash2,
  CheckSquare,
  Square,
  RefreshCw,
  SlidersHorizontal,
  Wifi,
  WifiOff,
  Database,
  Save,
  Radio,
  Building2,
  Camera,
  Image as ImageIcon,
  ExternalLink,
  MapPin,
  Upload,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import { generateFicheTechniquePdf } from '../lib/ficheTechniquePdf';
import { generateFicheTechniqueMoulePdf } from '../lib/ficheTechniqueMoulePdf';
import { calculateReadingStats, generateNextIRRef, generateNextReportRef } from '../lib/gmaoUtils';
import { sqliteApi } from '../services/sqliteApi';

import {
  saveReportDraft,
  getReportDraft,
  clearReportDraft,
  hasReportDraft,
  saveDIDraft,
  getDIDraft,
  clearDIDraft,
  getOfflineQueue,
  addToOfflineQueue,
  removeFromOfflineQueue,
  clearOfflineQueue,
  useOnlineStatus,
  OfflineQueueItem,
} from '../lib/offlineDraftStorage';

export interface TabletViewProps {
  machines: Machine[];
  molds: Mold[];
  requests: InterventionRequest[];
  orders: MaintenanceOrder[];
  reports: InterventionReport[];
  stock: StockItem[];
  productionOrders?: ProductionOrderOF[];
  onUpdateProductionOrder?: (order: ProductionOrderOF) => void;
  onUpdateOF?: (id: string, updates: Partial<ProductionOrderOF>) => void;
  currentUser?: AppUser;
  users?: AppUser[];
  onSwitchUser?: (user: AppUser) => void;
  onLogout?: () => void;
  onUpdateMachineStatus: (
    machineId: string,
    status: Machine['status'],
    reason?: string
  ) => void;
  onUpdateMachineMold: (machineId: string, moldNumber: string) => void;
  onUpdateMachineProduction: (
    machineId: string,
    product: string,
    produced?: number,
    good?: number,
    bad?: number
  ) => void;
  onSaveNewRequest: (req: InterventionRequest) => void;
  onSaveReport: (report: InterventionReport) => void;
  onValidatePreStep1?: (orderId: string, hours: number, date: string, time: string) => void;
  onValidatePreStep2?: (orderId: string) => void;
  onValidatePreStep3?: (orderId: string) => void;
  onExitTabletMode?: () => void;
  moldMaintenances?: MoldMaintenance[];
  onUpdateMold?: (moldId: string, updates: Partial<Mold>) => void;
  onAddNewMold?: (newMold: Mold) => void;
  onSaveMoldMaintenance?: (record: MoldMaintenance) => void;
  initialMachineId?: string;
  initialTab?: TabletTab;
}

type TabletTab = 'machines' | 'orders' | 'send_di' | 'fill_report' | 'molds' | 'ofs_list';
type MachineSubView = 'overview' | 'management' | 'status' | 'mold_change' | 'injected_item';

// Helper to check if an order has all 3 pre-validations complete
export const checkIs3Validated = (order?: MaintenanceOrder | null): boolean => {
  if (!order) return false;
  return Boolean(
    order.validationRespMaint?.validated &&
    order.validationRespProd?.validated &&
    order.validationQHSE?.validated
  );
};

// =============================================================================
// MultiMachineDIForm — tablet DI form that lets technicians pick one or more
// machines from the list of currently stopped/under-maintenance machines and
// submit a single problem description that creates one DI per machine.
// =============================================================================
export interface DIFormSubmitPayload {
  description: string;
  date: string;
  category: MaintenanceCategory;
  selectedMachineIds: string[];
  selectedMoldId?: string;
  otherEquipmentName?: string;
  priority?: PriorityLevel;
}

interface MultiMachineDIFormProps {
  machines: Machine[];
  molds?: Mold[];
  selectedDIMachineIds: string[];
  setSelectedDIMachineIds: React.Dispatch<React.SetStateAction<string[]>>;
  prefilledDescription: string;
  setPrefilledDescription: (v: string) => void;
  getMachineWorkflowState: (m: Machine) => { stage: string; label: string; request?: InterventionRequest; order?: MaintenanceOrder };
  existingRequests: InterventionRequest[];
  currentUser?: AppUser;
  onSubmit: (payload: DIFormSubmitPayload) => void;
  onCancel: () => void;
}

const QUICK_OTHER_EQUIPMENT = [
  'Robot Déchargeur',
  'Broyeur / Granulateur',
  'Groupe Froid / Chiller',
  'Compresseur & Circuit Air',
  'Pont Roulant',
  'Convoyeur / Tapis',
  'Étuve / Dessiccateur',
  'Alimentation Matière',
  'Thermorégulateur',
  'Circuit Eau Refroidissement',
  'Bâtiment / Électricité',
  'Général Atelier',
];

const QUICK_PROBLEM_SUGGESTIONS = [
  'Fuite hydraulique / huile',
  'Alarme défaut de chauffe',
  'Bruit ou vibration anormale',
  'Défaut éjection ou coulisseau',
  'Problème pneumatique / pression',
  'Capteur ou fin de course HS',
  'Arrêt d\'urgence bloqué',
  'Défaut électrique / disjoncteur',
];

const MultiMachineDIForm: React.FC<MultiMachineDIFormProps> = ({
  machines,
  molds = [],
  selectedDIMachineIds,
  setSelectedDIMachineIds,
  prefilledDescription,
  setPrefilledDescription,
  getMachineWorkflowState,
  onSubmit,
  onCancel,
}) => {
  const [description, setDescription] = React.useState(prefilledDescription || '');
  const [reqDate, setReqDate] = React.useState(() => new Date().toISOString().split('T')[0]);
  const [targetCategory, setTargetCategory] = React.useState<MaintenanceCategory>(() => {
    return selectedDIMachineIds.length > 0 ? 'Machine' : 'Machine';
  });
  const [selectedMoldId, setSelectedMoldId] = React.useState<string>('');
  const [otherEquipmentName, setOtherEquipmentName] = React.useState<string>('');
  const [priority, setPriority] = React.useState<PriorityLevel>('High');
  const [machineSearch, setMachineSearch] = React.useState('');
  const [moldSearch, setMoldSearch] = React.useState('');
  const [showAllMachines, setShowAllMachines] = React.useState(false);

  // Sync if prefilled description changes from outside
  React.useEffect(() => {
    if (prefilledDescription) setDescription(prefilledDescription);
  }, [prefilledDescription]);

  // If selectedDIMachineIds is populated from outside, switch category to Machine
  React.useEffect(() => {
    if (selectedDIMachineIds.length > 0) {
      setTargetCategory('Machine');
    }
  }, [selectedDIMachineIds]);

  // Machines that are stopped / under maintenance = eligible for DI
  const stoppedMachines = React.useMemo(() => {
    const statuses = ['under maintenance', 'maintenance', 'stopped', 'down'];
    return machines.filter((m) => statuses.includes((m.status || '').toLowerCase().trim()));
  }, [machines]);

  const displayedMachines = React.useMemo(() => {
    const base = showAllMachines ? machines : (stoppedMachines.length > 0 ? stoppedMachines : machines);
    const q = machineSearch.toLowerCase().trim();
    if (!q) return base;
    return base.filter(
      (m) =>
        m.number.toLowerCase().includes(q) ||
        (m.name || '').toLowerCase().includes(q) ||
        (m.location || '').toLowerCase().includes(q)
    );
  }, [machines, stoppedMachines, showAllMachines, machineSearch]);

  const filteredMolds = React.useMemo(() => {
    const q = moldSearch.toLowerCase().trim();
    if (!q) return molds;
    return molds.filter(
      (m) =>
        (m.moldNumber || m.ref || '').toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q)
    );
  }, [molds, moldSearch]);

  const toggleMachine = (id: string) => {
    setSelectedDIMachineIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    const availableIds = displayedMachines
      .filter((m) => getMachineWorkflowState(m).stage === 'can_create_ticket')
      .map((m) => m.id);
    const allSelected = availableIds.length > 0 && availableIds.every((id) => selectedDIMachineIds.includes(id));
    if (allSelected) {
      setSelectedDIMachineIds((prev) => prev.filter((id) => !availableIds.includes(id)));
    } else {
      setSelectedDIMachineIds((prev) => {
        const next = [...prev];
        for (const id of availableIds) {
          if (!next.includes(id)) next.push(id);
        }
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setPrefilledDescription(description);
    onSubmit({
      description: description.trim(),
      date: reqDate,
      category: targetCategory,
      selectedMachineIds: targetCategory === 'Machine' ? selectedDIMachineIds : [],
      selectedMoldId: targetCategory === 'Mold' ? selectedMoldId : undefined,
      otherEquipmentName: targetCategory === 'Other' ? otherEquipmentName : undefined,
      priority,
    });
  };

  const selectedCount = selectedDIMachineIds.length;
  // CAN ALWAYS SUBMIT AS LONG AS PROBLEM DESCRIPTION IS FILLED!
  const canSubmit = description.trim().length > 0;

  // Determine dynamic submit label
  let submitButtonText = 'Envoyer';
  if (targetCategory === 'Machine') {
    if (selectedCount > 1) {
      submitButtonText = `Envoyer ${selectedCount} Demandes (DI)`;
    } else if (selectedCount === 1) {
      const target = machines.find((m) => m.id === selectedDIMachineIds[0]);
      submitButtonText = `Envoyer ${target?.number || ''})`;
    } else {
      submitButtonText = 'Envoyer';
    }
  } else if (targetCategory === 'Mold') {
    const mold = molds.find((m) => m.id === selectedMoldId);
    submitButtonText = mold
      ? `Envoyer (Moule ${mold.moldNumber || mold.ref || mold.id})`
      : 'Envoyer';
  } else if (targetCategory === 'Other') {
    submitButtonText = otherEquipmentName.trim()
      ? `Envoyer la Demande (${otherEquipmentName.trim()})`
      : 'Envoyer';
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-[900px] mx-auto space-y-5 animate-in fade-in">
      {/* Header */}
      <div className="bg-white rounded-xl p-5 border border-slate-300 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 text-white rounded-lg flex items-center justify-center shrink-0">
            <Send size={18} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base leading-tight">Nouvelle Demande d'Intervention (DI)</h3>
          </div>
        </div>
      </div>

      {/* Target Category Selector */}
      <div className="bg-white rounded-xl p-4 border border-slate-300 shadow-xs space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setTargetCategory('Machine')}
            className={`p-3 rounded-lg border text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-2 transition-colors cursor-pointer ${targetCategory === 'Machine'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
          >
            <Wrench size={16} />
            <span>Machine</span>
            {selectedCount > 0 && (
              <span className="bg-emerald-500 text-white px-1.5 py-0.5 rounded-full text-[10px] font-mono">
                {selectedCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setTargetCategory('Mold')}
            className={`p-3 rounded-lg border text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-2 transition-colors cursor-pointer ${targetCategory === 'Mold'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
          >
            <Box size={16} />
            <span>Moule</span>
            {selectedMoldId && (
              <span className="bg-emerald-500 text-white px-1.5 py-0.5 rounded-full text-[10px] font-mono">
                ✓
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setTargetCategory('Other')}
            className={`p-3 rounded-lg border text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-2 transition-colors cursor-pointer ${targetCategory === 'Other'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
          >
            <Layers size={16} />
            <span>Autre</span>
            {otherEquipmentName.trim() && (
              <span className="bg-emerald-500 text-white px-1.5 py-0.5 rounded-full text-[10px] font-mono">
                ✓
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── SECTION 1: Machine Selector ── */}
      {targetCategory === 'Machine' && (
        <div className="bg-white rounded-xl border border-slate-300 shadow-xs overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Wrench size={16} className="text-slate-700" />
              <span className="font-bold text-sm text-slate-900">
                Sélection Machine
              </span>
              <button
                type="button"
                onClick={() => setShowAllMachines(!showAllMachines)}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-900 underline underline-offset-2 ml-1 cursor-pointer"
              >
                {showAllMachines ? 'Afficher uniquement en arrêt' : 'Afficher toutes'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              {displayedMachines.length > 1 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 underline underline-offset-2 cursor-pointer transition-colors"
                >
                  {displayedMachines.filter((m) => getMachineWorkflowState(m).stage === 'can_create_ticket').every((m) => selectedDIMachineIds.includes(m.id))
                    ? 'Tout désélectionner'
                    : 'Tout sélectionner'}
                </button>
              )}
              {displayedMachines.length > 3 && (
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Filtrer..."
                    value={machineSearch}
                    onChange={(e) => setMachineSearch(e.target.value)}
                    className="pl-7 pr-3 py-1.5 text-xs border border-slate-300 rounded-md bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-900 w-36"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {displayedMachines.map((m) => {
              const workflow = getMachineWorkflowState(m);
              const isEligible = workflow.stage === 'can_create_ticket';
              const isChecked = selectedDIMachineIds.includes(m.id);
              return (
                <label
                  key={m.id}
                  className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors select-none ${isEligible
                    ? isChecked
                      ? 'bg-emerald-50 hover:bg-emerald-100'
                      : 'hover:bg-slate-50'
                    : 'opacity-50 cursor-not-allowed bg-slate-50'
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={!isEligible}
                    onChange={() => isEligible && toggleMachine(m.id)}
                    className="w-5 h-5 rounded border-slate-300 text-slate-900 accent-slate-900 cursor-pointer"
                  />
                  <div className="w-10 h-10 bg-slate-900 text-white rounded-lg flex items-center justify-center font-mono font-bold text-sm shrink-0">
                    {m.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-slate-900 truncate">{m.name || `${m.brand} ${m.model}`}</div>
                    <div className="text-xs text-slate-500 font-mono truncate">
                      {m.location && <span className="mr-2"> {m.location}</span>}
                      {(m.clampingForce || m.clampingForceTons) && <span>{m.clampingForce || m.clampingForceTons} T</span>}
                    </div>
                  </div>
                  {isEligible ? (
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${m.status === 'Stopped' || m.status === 'down'
                      ? 'bg-red-50 text-red-800 border-red-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                      {m.status === 'Stopped' || m.status === 'down' ? 'ARRÊT' : 'MAINT'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border bg-slate-100 text-slate-600 border-slate-200 shrink-0" title={workflow.label}>
                      TICKET ACTIF
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          <div className={`px-5 py-2.5 border-t text-xs font-medium flex items-center justify-between ${selectedCount > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold' : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={() => setSelectedDIMachineIds([])}
                className="text-xs text-emerald-800 underline hover:text-emerald-950 font-bold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── SECTION 2: Mold Selector ── */}
      {targetCategory === 'Mold' && (
        <div className="bg-white rounded-xl border border-slate-300 shadow-xs p-5 space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <label className="block font-bold text-sm text-slate-900">
              Sélectionnez le moule concerné :
            </label>
            {molds.length > 3 && (
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Rechercher moule..."
                  value={moldSearch}
                  onChange={(e) => setMoldSearch(e.target.value)}
                  className="pl-7 pr-3 py-1.5 text-xs border border-slate-300 rounded-md bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-900 w-44"
                />
              </div>
            )}
          </div>

          {filteredMolds.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
              {filteredMolds.map((mold) => {
                const isSelected = selectedMoldId === mold.id;
                return (
                  <div
                    key={mold.id}
                    onClick={() => setSelectedMoldId(isSelected ? '' : mold.id)}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${isSelected
                      ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                      }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-sm text-slate-900">
                        {mold.moldNumber || mold.ref || mold.id}
                      </span>
                      {isSelected ? (
                        <CheckSquare size={16} className="text-emerald-700 shrink-0" />
                      ) : (
                        <Square size={16} className="text-slate-400 shrink-0" />
                      )}
                    </div>
                    {mold.description && <p className="text-xs text-slate-600 truncate mt-0.5">{mold.description}</p>}
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                      {mold.cavities && <span>Cavités: {mold.cavities}</span>}
                      {mold.status && <span className="font-mono uppercase">· {mold.status}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">Aucun moule trouvé.</p>
          )}

          <div className="pt-2 border-t border-slate-200">
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Ou saisissez la référence manuellement si le moule n'est pas dans la liste :
            </label>
            <input
              type="text"
              placeholder=""
              value={otherEquipmentName}
              onChange={(e) => {
                setOtherEquipmentName(e.target.value);
                if (e.target.value) setSelectedMoldId('');
              }}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
        </div>
      )}

      {/* ── SECTION 3: Other Equipment Selector ── */}
      {targetCategory === 'Other' && (
        <div className="bg-white rounded-xl border border-slate-300 shadow-xs p-5 space-y-3.5">
          <div>
            <label className="block font-bold text-sm text-slate-900">
              Nom ou repère de l'équipement / installation
            </label>
          </div>

          <input
            type="text"
            value={otherEquipmentName}
            onChange={(e) => setOtherEquipmentName(e.target.value)}
            placeholder=""
            className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      )}

      {/* ── Problem Description & Date & Priority ── */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-xs p-5 space-y-4">
        <div>
          <label className="block font-bold text-sm text-slate-900 mb-1">
            Description du problème <span className="text-red-500">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder=""
            rows={4}
            required
            className="w-full px-3.5 py-3 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 resize-none font-sans placeholder:text-slate-400"
          />
        </div>

        {/* Date & Priority Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700 shrink-0">Date :</label>
            <input
              type="date"
              value={reqDate}
              onChange={(e) => setReqDate(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700 shrink-0">Priorité :</label>
            <div className="grid grid-cols-4 gap-1 flex-1">
              {(['Low', 'Medium', 'High', 'Urgent'] as PriorityLevel[]).map((p) => {
                const isSelected = priority === p;
                const labels: Record<PriorityLevel, string> = {
                  Low: 'Basse',
                  Medium: 'Moy.',
                  High: 'Haute',
                  Urgent: 'Urgente',
                };
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`py-1 text-[11px] font-bold rounded border text-center transition-colors cursor-pointer ${isSelected
                      ? p === 'Urgent'
                        ? 'bg-red-600 text-white border-red-600'
                        : p === 'High'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                  >
                    {labels[p]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className={`min-h-[52px] flex-1 py-3 px-5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer ${canSubmit
            ? 'bg-slate-900 hover:bg-black text-white active:scale-[0.98]'
            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
        >
          <Send size={16} />
          <span>{submitButtonText}</span>
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[52px] flex-1 py-3 px-5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-sm font-bold transition-colors cursor-pointer"
        >
          Annuler
        </button>
      </div>
    </form>
  );
};

export const TabletView: React.FC<TabletViewProps> = ({
  machines,
  molds,
  requests,
  orders,
  reports,
  stock,
  productionOrders = [],
  onUpdateProductionOrder,
  onUpdateOF,
  currentUser,
  users = [],
  onSwitchUser,
  onLogout,
  onUpdateMachineStatus,
  onUpdateMachineMold,
  onUpdateMachineProduction,
  onSaveNewRequest,
  onSaveReport,
  onValidatePreStep1,
  onValidatePreStep2,
  onValidatePreStep3,
  onExitTabletMode,
  moldMaintenances = [],
  onUpdateMold,
  onAddNewMold,
  onSaveMoldMaintenance,
  initialMachineId,
  initialTab = 'machines',
}) => {
  const { logout } = useAuth();

  // Navigation State - defaults to 'machines' (Fleet overview)
  const [activeTab, setActiveTab] = useState<TabletTab>(initialTab);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState<string>(
    initialMachineId || machines[0]?.id || ''
  );
  const [machineSubView, setMachineSubView] = useState<MachineSubView>('overview');

  // Tablet Intervention Request State: 'list' (table view) vs 'create' (dedicated add interface)
  const [diSubView, setDiSubView] = useState<'list' | 'create'>('list');
  const [diSearchQuery, setDiSearchQuery] = useState('');
  const [diStatusFilter, setDiStatusFilter] = useState<'all' | 'Waiting' | 'Validated' | 'Rejected'>('all');
  const [diSelectedDetail, setDiSelectedDetail] = useState<InterventionRequest | null>(null);
  const [diPage, setDiPage] = useState(1);

  // Sync if initialMachineId changes
  useEffect(() => {
    if (initialMachineId) {
      setSelectedMachineId(initialMachineId);
    }
  }, [initialMachineId]);

  // Selected Order for Report filling (can be set from machine view or orders view)
  const [selectedOrderForReportId, setSelectedOrderForReportId] = useState<string>('');

  // Toast confirmation in tablet
  const [tabletToast, setTabletToast] = useState<{ title: string; subtitle?: string } | null>(null);

  const showTabletToast = (title: string, subtitle?: string) => {
    setTabletToast({ title, subtitle });
    setTimeout(() => setTabletToast(null), 4000);
  };

  // Helper to determine if a machine is down or undergoing maintenance
  const isMachineInMaintenanceOrDown = (m: Machine): boolean => {
    const s = (m.status || '').toLowerCase().trim();
    return (
      s === 'under maintenance' ||
      s === 'maintenance' ||
      s === 'stopped' ||
      s === 'down'
    );
  };

  // Search filter for Machines Overview
  const [machineSearch, setMachineSearch] = useState('');

  // Layout mode for machines overview: list (default) or cards
  const [machineLayoutMode, setMachineLayoutMode] = useState<'list' | 'cards'>('list');

  // Helper to determine the active maintenance workflow state for a machine
  const getMachineWorkflowState = (m: Machine) => {
    // 1. Find all requests belonging to this machine
    const mRequests = requests.filter((r) => {
      if (r.equipmentId && r.equipmentId === m.id) return true;
      if (
        r.equipmentName &&
        (r.equipmentName.toLowerCase().includes(m.number.toLowerCase()) ||
          (m.name && r.equipmentName.toLowerCase().includes(m.name.toLowerCase())))
      ) {
        return true;
      }
      if (r.problemDescription && r.problemDescription.toLowerCase().includes(m.number.toLowerCase())) {
        return true;
      }
      return false;
    });

    const irRefs = new Set(mRequests.map((r) => r.refIR));

    // 2. Find all orders belonging to this machine or this machine's requests
    const mOrders = orders.filter((o) => {
      if (o.machineId && o.machineId === m.id) return true;
      if (o.equipmentId && o.equipmentId === m.id) return true;
      if (o.machineNumber && o.machineNumber.toLowerCase() === m.number.toLowerCase()) return true;
      if (
        o.equipmentName &&
        (o.equipmentName.toLowerCase().includes(m.number.toLowerCase()) ||
          (m.name && o.equipmentName.toLowerCase().includes(m.name.toLowerCase())))
      ) {
        return true;
      }
      if (o.refIR && irRefs.has(o.refIR)) return true;
      return false;
    });

    // 3. Check for active (non-completed) orders
    const activeOrder = mOrders
      .filter((o) => o.status !== 'Completed' && o.status !== 'Rejected')
      .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime())[0];

    if (activeOrder) {
      const is3Validated = checkIs3Validated(activeOrder);
      // Check if report has already been created for this order
      const hasReport =
        reports.some((rep) => rep.refOT === activeOrder.refOT || rep.orderId === activeOrder.id) ||
        Boolean(activeOrder.reportRef) ||
        activeOrder.status === 'Waiting work validation';

      if (is3Validated && !hasReport) {
        // Step: Work Order created AND 3 validations validated -> Fill Intervention Report!
        return {
          stage: 'ready_to_report' as const,
          order: activeOrder,
          label: 'Fill Intervention Report',
        };
      }

      if (!is3Validated) {
        return {
          stage: 'waiting_3_validations' as const,
          order: activeOrder,
          label: 'Waiting on 3 Validations',
        };
      }
    }

    // 4. If no active order, check for active requests that are not rejected
    const activeRequest = mRequests
      .filter((r) => r.status !== 'Rejected')
      .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime())[0];

    if (activeRequest) {
      // Check if an order already exists for this request
      const hasOrderForIR = orders.some(
        (o) => o.refIR === activeRequest.refIR || (activeRequest.relatedOTRef && o.refOT === activeRequest.relatedOTRef)
      );

      if (!hasOrderForIR) {
        if (activeRequest.status === 'Waiting') {
          // Step: Ticket submitted -> Waiting for validation
          return {
            stage: 'waiting_validation' as const,
            request: activeRequest,
            label: 'Waiting for validation',
          };
        }
        if (activeRequest.status === 'Validated') {
          // Step: Validated by Responsable Technique -> Waiting on Work Order creation
          return {
            stage: 'waiting_work_order' as const,
            request: activeRequest,
            label: 'Waiting on Work order creation',
          };
        }
      }
    }

    // Default: No pending ticket or order -> Can create new ticket
    return {
      stage: 'can_create_ticket' as const,
      label: 'New IR Ticket',
    };
  };

  // Helper to determine the active maintenance workflow state for a mold
  const getMoldWorkflowState = (mold: Mold) => {
    const moldNum = (mold.moldNumber || mold.ref || '').toLowerCase().trim();

    // 1. Find all requests belonging to this mold
    const moldRequests = requests.filter((r) => {
      if (r.category === 'Mold' && r.equipmentId && r.equipmentId === mold.id) return true;
      if (
        moldNum &&
        ((r.equipmentName && r.equipmentName.toLowerCase().includes(moldNum)) ||
          (r.problemDescription && r.problemDescription.toLowerCase().includes(moldNum)))
      ) {
        return true;
      }
      return false;
    });

    const irRefs = new Set(moldRequests.map((r) => r.refIR));

    // 2. Find all orders belonging to this mold or linked requests
    const moldOrders = orders.filter((o) => {
      if (o.category === 'Mold' && (o.moldId === mold.id || (o.moldRef && o.moldRef.toLowerCase() === moldNum))) return true;
      if (o.equipmentId && o.equipmentId === mold.id) return true;
      if (
        moldNum &&
        ((o.equipmentName && o.equipmentName.toLowerCase().includes(moldNum)) ||
          (o.description && o.description.toLowerCase().includes(moldNum)))
      ) {
        return true;
      }
      if (o.refIR && irRefs.has(o.refIR)) return true;
      return false;
    });

    // 3. Check for active (non-completed) orders
    const activeOrder = moldOrders
      .filter((o) => o.status !== 'Completed' && o.status !== 'Rejected')
      .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime())[0];

    if (activeOrder) {
      const is3Validated = checkIs3Validated(activeOrder);
      const hasReport =
        reports.some((rep) => rep.refOT === activeOrder.refOT || rep.orderId === activeOrder.id) ||
        Boolean(activeOrder.reportRef) ||
        activeOrder.status === 'Waiting work validation';

      if (is3Validated && !hasReport) {
        return {
          stage: 'ready_to_report' as const,
          order: activeOrder,
          label: 'Fill Intervention Report',
        };
      }

      if (!is3Validated) {
        return {
          stage: 'waiting_3_validations' as const,
          order: activeOrder,
          label: 'Waiting on 3 Validations',
        };
      }
    }

    // 4. If no active order, check for active requests
    const activeRequest = moldRequests
      .filter((r) => r.status !== 'Rejected')
      .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime())[0];

    if (activeRequest) {
      const hasOrderForIR = orders.some(
        (o) => o.refIR === activeRequest.refIR || (activeRequest.relatedOTRef && o.refOT === activeRequest.relatedOTRef)
      );

      if (!hasOrderForIR) {
        if (activeRequest.status === 'Waiting') {
          return {
            stage: 'waiting_validation' as const,
            request: activeRequest,
            label: 'Waiting for validation',
          };
        }
        if (activeRequest.status === 'Validated') {
          return {
            stage: 'waiting_work_order' as const,
            request: activeRequest,
            label: 'Waiting on Work order creation',
          };
        }
      }
    }

    return {
      stage: 'can_create_ticket' as const,
      label: 'New IR Ticket',
    };
  };

  // Count of machines currently down or in maintenance
  const machinesInMaintCount = useMemo(() => {
    return machines.filter(isMachineInMaintenanceOrDown).length;
  }, [machines]);

  // Selected Machine object: prioritize selected if down/maintenance, else first down/maintenance
  const currentMachine = useMemo(() => {
    const selected = machines.find((m) => m.id === selectedMachineId);
    if (selected && isMachineInMaintenanceOrDown(selected)) {
      return selected;
    }
    const firstDown = machines.find(isMachineInMaintenanceOrDown);
    return firstDown || selected || machines[0];
  }, [machines, selectedMachineId]);

  // Active work order for the currently selected machine
  const activeOrderForMachine = useMemo(() => {
    return orders.find(
      (o) =>
        (o.equipmentId === currentMachine?.id ||
          o.machineNumber === currentMachine?.number ||
          o.equipmentName?.includes(currentMachine?.number)) &&
        (o.status === 'In Progress' || o.status === 'Waiting' || o.status === 'Waiting work validation')
    );
  }, [orders, currentMachine]);

  // Pre-validated Maintenance Orders awaiting an Intervention Report
  const prevalidatedOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!checkIs3Validated(o)) return false;
      if (o.status === 'Completed' || o.status === 'Waiting work validation') return false;
      if (o.reportRef) return false;
      const hasReport = reports.some(
        (rep) => rep.refOT === o.refOT || rep.orderId === o.id
      );
      if (hasReport) return false;
      return true;
    });
  }, [orders, reports]);

  // Order currently selected for reporting (null if viewing the pre-validated table)
  const targetReportOrder = useMemo(() => {
    if (selectedOrderForReportId) {
      return orders.find((o) => o.id === selectedOrderForReportId) || null;
    }
    return null;
  }, [orders, selectedOrderForReportId]);

  // Check if targetReportOrder is 3-validated
  const isTargetOrder3Validated = useMemo(() => {
    return checkIs3Validated(targetReportOrder);
  }, [targetReportOrder]);

  // Pre-validated table filters
  const [reportTableFilterCat, setReportTableFilterCat] = useState<'all' | 'Machine' | 'Mold' | 'Other'>('all');
  const [reportTableSearch, setReportTableSearch] = useState('');

  // Mold specific report fields
  const [reportMoldSupplier, setReportMoldSupplier] = useState('');
  const [reportMoldQuoteRef, setReportMoldQuoteRef] = useState('');
  const [reportMoldStorageRack, setReportMoldStorageRack] = useState('');
  const [reportMoldAssignedMachine, setReportMoldAssignedMachine] = useState('');

  // Other equipment specific report fields
  const [reportOtherEquipmentType, setReportOtherEquipmentType] = useState('Installation Générale');
  const [reportOtherLocation, setReportOtherLocation] = useState('');
  const [reportOtherSafetyMeasures, setReportOtherSafetyMeasures] = useState('');

  // Machine Management States
  const [pendingStatus, setPendingStatus] = useState<Machine['status'] | null>(null);
  const [statusReasonInput, setStatusReasonInput] = useState('');
  const [selectedIncomingMoldNumber, setSelectedIncomingMoldNumber] = useState('');
  const [moldPlaceNumber, setMoldPlaceNumber] = useState('');
  const [productInput, setProductInput] = useState(currentMachine?.injectingProduct || 'Clip PA66 Connectique');
  const [qtyProducedInput, setQtyProducedInput] = useState('2400');
  const [qtyGoodInput, setQtyGoodInput] = useState('2385');
  const [qtyBadInput, setQtyBadInput] = useState('15');

  // =========================================================================
  // INTERVENTION REQUEST (DI) STATES
  // =========================================================================
  const [prefilledDescription, setPrefilledDescription] = useState('');
  // Multi-machine DI: array of machine IDs selected for the current DI batch
  const [selectedDIMachineIds, setSelectedDIMachineIds] = useState<string[]>([]);
  // Legacy single-machine compat (used by mold workflow, etc.) — maps to selectedDIMachineIds[0]
  const prefilledTargetMachineId = selectedDIMachineIds[0] ?? '';
  const setPrefilledTargetMachineId = (id: string) =>
    setSelectedDIMachineIds(id ? [id] : []);
  const [diCreatedNotices, setDiCreatedNotices] = useState<InterventionRequest[]>([]);
  // Backward-compat alias
  const diCreatedNotice = diCreatedNotices[0] ?? null;

  // =========================================================================
  // FILL INTERVENTION REPORT FORM STATES
  // =========================================================================
  const [reportTechName, setReportTechName] = useState(currentUser?.name || '');
  const [reportFailureCat, setReportFailureCat] = useState<'mechanical' | 'electrical' | 'hydraulic' | 'mold' | 'other'>('mechanical');
  const [reportFailureSub, setReportFailureSub] = useState('');
  const [reportRootCause, setReportRootCause] = useState('');
  const [reportStartTime, setReportStartTime] = useState(
    new Date(Date.now() - 90 * 60000).toTimeString().slice(0, 5)
  );
  const [reportEndTime, setReportEndTime] = useState(new Date().toTimeString().slice(0, 5));
  const [reportDurationMinutes, setReportDurationMinutes] = useState(90);

  const [reportActions, setReportActions] = useState<string[]>([]);
  const [newActionInput, setNewActionInput] = useState('');

  // Stock parts consumed
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [selectedStockPartId, setSelectedStockPartId] = useState(stock[0]?.id || '');
  const [selectedStockQty, setSelectedStockQty] = useState(1);
  const [consumedPartsList, setConsumedPartsList] = useState<
    { partId: string; partNumber: string; name: string; qty: number; unitPrice: number }[]
  >([]);

  // Mold specific report fields
  const [reportMoldLocation, setReportMoldLocation] = useState<'local' | 'external'>('local');
  const [reportMoldStatusAfter, setReportMoldStatusAfter] = useState<'In Stock' | 'In Use' | 'Exported'>('In Use');

  // Status after repair
  const [reportStatusAfter, setReportStatusAfter] = useState<'operational' | 'down' | 'idle'>('operational');
  const [reportDifficulties, setReportDifficulties] = useState('');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportAffectedCavities, setReportAffectedCavities] = useState('');
  const [reportSuccessSubmitted, setReportSuccessSubmitted] = useState<InterventionReport | null>(null);

  // Meter Reading on Report Close (Optional for Machine WOs)
  const [reportMeterReadingHours, setReportMeterReadingHours] = useState<string>('');
  const [reportMeterWarningConfirmed, setReportMeterWarningConfirmed] = useState<boolean>(false);
  const [reportMeterError, setReportMeterError] = useState<string | null>(null);

  // OFs (Ordres de Fabrication) State for Tablet with active sync from SQLite backend
  const [ofSearchQuery, setOfSearchQuery] = useState('');
  const [previewPdfOF, setPreviewPdfOF] = useState<ProductionOrderOF | null>(null);
  const [showDoneOFs, setShowDoneOFs] = useState(false);
  const [syncedOFs, setSyncedOFs] = useState<ProductionOrderOF[]>(productionOrders || []);
  const [isRefreshingOFs, setIsRefreshingOFs] = useState(false);

  // Sync when prop updates
  useEffect(() => {
    if (productionOrders && productionOrders.length > 0) {
      setSyncedOFs(productionOrders);
    }
  }, [productionOrders]);

  // Active sync function to fetch fresh OFs from backend
  const refreshOFsFromBackend = async () => {
    try {
      setIsRefreshingOFs(true);
      const data = await sqliteApi.getOFs();
      if (Array.isArray(data)) {
        setSyncedOFs(data);
      }
    } catch (e) {
      console.warn('[Tablet] OF sync error:', e);
    } finally {
      setIsRefreshingOFs(false);
    }
  };

  // Sync on mount and periodically every 8s while tablet is open
  useEffect(() => {
    refreshOFsFromBackend();
    const interval = setInterval(() => {
      refreshOFsFromBackend();
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Sync immediately when switching to ofs_list tab
  useEffect(() => {
    if (activeTab === 'ofs_list') {
      refreshOFsFromBackend();
    }
  }, [activeTab]);

  // Filtered OFs for Tablet (Done OFs are excluded by default!)
  const tabletOFs = useMemo(() => {
    return syncedOFs.filter((ofItem) => {
      if (!showDoneOFs && ofItem.status === 'Done') return false;
      if (!ofSearchQuery.trim()) return true;
      const q = ofSearchQuery.toLowerCase();
      return (
        ofItem.ofNumber.toLowerCase().includes(q) ||
        ofItem.title.toLowerCase().includes(q) ||
        (ofItem.machineName && ofItem.machineName.toLowerCase().includes(q)) ||
        (ofItem.moldName && ofItem.moldName.toLowerCase().includes(q))
      );
    });
  }, [syncedOFs, showDoneOFs, ofSearchQuery]);

  const activeOFsCount = useMemo(() => {
    return syncedOFs.filter((o) => o.status !== 'Done').length;
  }, [syncedOFs]);

  const handleCompleteOF = (ofItem: ProductionOrderOF) => {
    const completedOrder: ProductionOrderOF = {
      ...ofItem,
      status: 'Done',
      completedAt: new Date().toISOString(),
      completedBy: currentUser?.name || 'Technicien Tablette',
    };

    setSyncedOFs((prev) =>
      prev.map((o) => (o.id === ofItem.id ? completedOrder : o))
    );

    if (onUpdateProductionOrder) {
      onUpdateProductionOrder(completedOrder);
    } else if (onUpdateOF) {
      onUpdateOF(ofItem.id, {
        status: 'Done',
        completedAt: completedOrder.completedAt,
        completedBy: completedOrder.completedBy,
      });
    }
    showTabletToast(`OF ${ofItem.ofNumber} marqué comme Terminé !`);
  };

  // Mold Maintenance Closeout Modal
  const [closingMoldId, setClosingMoldId] = useState<string | null>(null);

  // Offline / Network Connectivity & Outbox Queue States
  const { isOnline, testConnection } = useOnlineStatus();
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>(() => getOfflineQueue());
  const [isOfflineQueueModalOpen, setIsOfflineQueueModalOpen] = useState(false);
  const [lastDraftSavedTime, setLastDraftSavedTime] = useState<string | null>(null);
  const [isDraftRestoredNotice, setIsDraftRestoredNotice] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Restore existing report or draft when targetReportOrder changes
  useEffect(() => {
    if (!targetReportOrder?.id) return;
    setReportMeterError(null);
    setReportMeterWarningConfirmed(false);
    setReportMeterReadingHours('');

    // 1. Look up existing report for this work order
    const existing = reports?.find(
      (r) =>
        r.refOT === targetReportOrder.refOT ||
        (targetReportOrder.reportRef && (r.refReport === targetReportOrder.reportRef || r.id === targetReportOrder.reportRef))
    );

    if (existing) {
      if (existing.technicianName || existing.filledBy || existing.assignedTo) {
        setReportTechName(existing.technicianName || existing.filledBy || existing.assignedTo || '');
      }
      if (existing.cause) {
        setReportFailureCat(existing.cause.toLowerCase().includes('mold') ? 'mold' : 'mechanical');
      }
      if (existing.subCause) {
        const parts = existing.subCause.split(' - ');
        setReportFailureSub(parts[0] || '');
        setReportRootCause(parts.slice(1).join(' - ') || '');
      }
      if (existing.startingTime) {
        const timePart = existing.startingTime.split(' ')[1] || existing.startingTime;
        setReportStartTime(timePart);
      }
      if (existing.finishedTime) {
        const timePart = existing.finishedTime.split(' ')[1] || existing.finishedTime;
        setReportEndTime(timePart);
      }
      if (existing.durationMinutes) setReportDurationMinutes(existing.durationMinutes);
      if (existing.actions && existing.actions.length > 0) setReportActions(existing.actions);
      if (existing.difficulties && existing.difficulties.length > 0) {
        setReportDifficulties(existing.difficulties.join('\n'));
      }
      if (existing.stockTaken && existing.stockTaken.length > 0) {
        setConsumedPartsList(
          existing.stockTaken.map((st) => ({
            partId: st.itemId,
            name: st.itemName,
            partNumber: st.partNumber,
            qty: st.qty,
            unitPrice: st.unitPrice,
          }))
        );
      }
      if (existing.meterReadingHours != null) setReportMeterReadingHours(String(existing.meterReadingHours));
      if (existing.moldRepairLocation) setReportMoldLocation(existing.moldRepairLocation);
      if (existing.moldStatusAfterRepair) setReportMoldStatusAfter(existing.moldStatusAfterRepair);
      setIsDraftRestoredNotice(false);
      setLastDraftSavedTime(null);
      return;
    }

    const saved = getReportDraft(targetReportOrder.id);
    if (saved) {
      if (saved.techName) setReportTechName(saved.techName);
      if (saved.failureCat) setReportFailureCat(saved.failureCat);
      if (saved.failureSub) setReportFailureSub(saved.failureSub);
      if (saved.rootCause) setReportRootCause(saved.rootCause);
      if (saved.startTime) setReportStartTime(saved.startTime);
      if (saved.endTime) setReportEndTime(saved.endTime);
      if (saved.durationMinutes) setReportDurationMinutes(saved.durationMinutes);
      if (saved.actions && saved.actions.length > 0) setReportActions(saved.actions);
      if (saved.consumedParts) setConsumedPartsList(saved.consumedParts);
      if (saved.moldLocation) setReportMoldLocation(saved.moldLocation);
      if (saved.moldStatusAfter) setReportMoldStatusAfter(saved.moldStatusAfter);
      if (saved.statusAfter) setReportStatusAfter(saved.statusAfter);
      if (saved.difficulties !== undefined) setReportDifficulties(saved.difficulties);
      setLastDraftSavedTime(
        new Date(saved.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setIsDraftRestoredNotice(true);
    } else {
      setIsDraftRestoredNotice(false);
      setLastDraftSavedTime(null);
    }
  }, [targetReportOrder?.id, reports]);

  // Auto-save report draft to localStorage
  useEffect(() => {
    if (!targetReportOrder?.id || !checkIs3Validated(targetReportOrder)) return;

    const timer = setTimeout(() => {
      saveReportDraft(targetReportOrder.id, {
        orderId: targetReportOrder.id,
        refOT: targetReportOrder.refOT,
        equipmentId: targetReportOrder.equipmentId,
        equipmentName: targetReportOrder.equipmentName,
        techName: reportTechName,
        failureCat: reportFailureCat,
        failureSub: reportFailureSub,
        rootCause: reportRootCause,
        startTime: reportStartTime,
        endTime: reportEndTime,
        durationMinutes: reportDurationMinutes,
        actions: reportActions,
        consumedParts: consumedPartsList,
        moldLocation: reportMoldLocation,
        moldStatusAfter: reportMoldStatusAfter,
        statusAfter: reportStatusAfter,
        difficulties: reportDifficulties,
      });
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastDraftSavedTime(nowStr);
    }, 350);

    return () => clearTimeout(timer);
  }, [
    targetReportOrder?.id,
    targetReportOrder?.refOT,
    targetReportOrder?.equipmentId,
    targetReportOrder?.equipmentName,
    reportTechName,
    reportFailureCat,
    reportFailureSub,
    reportRootCause,
    reportStartTime,
    reportEndTime,
    reportDurationMinutes,
    reportActions,
    consumedPartsList,
    reportMoldLocation,
    reportMoldStatusAfter,
    reportStatusAfter,
    reportDifficulties,
  ]);

  // Automatic sync on network recovery
  useEffect(() => {
    if (isOnline) {
      const queue = getOfflineQueue();
      if (queue.length > 0) {
        setIsSyncing(true);
        queue.forEach((item) => {
          if (item.type === 'report') {
            onSaveReport(item.data as InterventionReport);
          } else if (item.type === 'request') {
            onSaveNewRequest(item.data as InterventionRequest);
          }
        });
        clearOfflineQueue();
        setOfflineQueue([]);
        setIsSyncing(false);
        showTabletToast(
          'Plant Network Restored',
          `${queue.length} offline item(s) successfully synchronized!`
        );
      }
    }
  }, [isOnline, onSaveReport, onSaveNewRequest]);

  const handleManualSync = () => {
    const queue = getOfflineQueue();
    if (queue.length === 0) {
      showTabletToast('Queue Empty', 'All items are already synchronized.');
      return;
    }
    setIsSyncing(true);
    queue.forEach((item) => {
      if (item.type === 'report') {
        onSaveReport(item.data as InterventionReport);
      } else if (item.type === 'request') {
        onSaveNewRequest(item.data as InterventionRequest);
      }
    });
    clearOfflineQueue();
    setOfflineQueue([]);
    setIsSyncing(false);
    showTabletToast('Sync Successful', `${queue.length} item(s) manually synchronized.`);
    setIsOfflineQueueModalOpen(false);
  };

  const handleResetDraft = () => {
    if (!targetReportOrder?.id) return;
    clearReportDraft(targetReportOrder.id);
    setReportFailureCat('mechanical');
    setReportFailureSub('Proportional directional valve & check valve');
    setReportRootCause('Normal seal wear and micro-particle contamination');
    setReportStartTime(new Date(Date.now() - 90 * 60000).toTimeString().slice(0, 5));
    setReportEndTime(new Date().toTimeString().slice(0, 5));
    setReportDurationMinutes(90);
    setReportActions([
      'Machine LOTO lockout and circuit depressurization.',
      'Valve disassembly and FKM O-ring replacement.',
      'Hydraulic circuit bleeding and pressure test at 180 bar.',
      'Dry cycle test 10 strokes with production validation.',
    ]);
    setConsumedPartsList([
      {
        partId: 'sp-1',
        partNumber: 'OR-VIT-90',
        name: 'O-Ring FKM Viton 90 Shore A',
        qty: 2,
        unitPrice: 12.5,
      },
    ]);
    setReportStatusAfter('operational');
    setReportDifficulties('');
    setLastDraftSavedTime(null);
    setIsDraftRestoredNotice(false);
    showTabletToast('Draft reset', 'Default values have been reloaded.');
  };

  // Filtered Machines: STRICTLY list only machines with status maintenance or down
  const filteredMachinesList = useMemo(() => {
    return machines.filter((m) => {
      if (!isMachineInMaintenanceOrDown(m)) return false;

      const q = machineSearch.toLowerCase().trim();
      if (!q) return true;
      return (
        m.number.toLowerCase().includes(q) ||
        (m.name || '').toLowerCase().includes(q) ||
        (m.location || '').toLowerCase().includes(q) ||
        (m.statusReason || '').toLowerCase().includes(q) ||
        (m.activeMoldRef || '').toLowerCase().includes(q)
      );
    });
  }, [machines, machineSearch]);

  // Active Work Orders (completed work orders are filtered out from workshop list)
  const activeOrders = useMemo(() => {
    return orders.filter((o) => o.status !== 'Completed');
  }, [orders]);

  // Count of 3-validated orders ready for report (excluding completed)
  const ordersReadyForReportCount = useMemo(() => {
    return orders.filter(
      (o) =>
        checkIs3Validated(o) &&
        !o.reportRef &&
        o.status !== 'Completed' &&
        (o.status === 'In Progress' || o.status === 'Waiting')
    ).length;
  }, [orders]);

  // Recent Requests sent by technicians: only show the ones STILL WAITING for validation
  const technicianRequests = useMemo(() => {
    return requests.filter((r) => r.status === 'Waiting');
  }, [requests]);

  // ── MOLD MANAGEMENT (MOBILE/TABLET) STATE ──────────────────────────
  const [moldsList, setMoldsList] = useState<Mold[]>(molds);
  useEffect(() => {
    setMoldsList(molds);
  }, [molds]);

  const [selectedMoldId, setSelectedMoldId] = useState<string>(molds[0]?.id || '');
  const selectedMold = useMemo(() => {
    return moldsList.find((m) => m.id === selectedMoldId) || moldsList[0] || null;
  }, [moldsList, selectedMoldId]);

  const [moldLocationInput, setMoldLocationInput] = useState('');
  const [moldReasonInput, setMoldReasonInput] = useState('');
  const [moldExportDateInput, setMoldExportDateInput] = useState(() => new Date().toISOString().split('T')[0]);
  const [moldExportDestinationInput, setMoldExportDestinationInput] = useState('');
  const [savingMold, setSavingMold] = useState(false);
  const [savingInUseMold, setSavingInUseMold] = useState(false);
  const [savingExportMold, setSavingExportMold] = useState(false);

  // In Use machine picker
  const [inUseMachineSearch, setInUseMachineSearch] = useState('');
  const [inUseMachineDropdownOpen, setInUseMachineDropdownOpen] = useState(false);
  const [inUseMachineName, setInUseMachineName] = useState('');

  // Searchable Mold Selector Modal
  const [isMoldSearchModalOpen, setIsMoldSearchModalOpen] = useState(false);
  const [moldSearchTerm, setMoldSearchTerm] = useState('');

  const filteredSearchMolds = useMemo(() => {
    const q = moldSearchTerm.toLowerCase().trim();
    if (!q) return moldsList;
    return moldsList.filter((m) => {
      const ref = (m.moldNumber || m.ref || '').toLowerCase();
      const desc = (m.description || '').toLowerCase();
      const loc = (m.location || m.rackLocation || '').toLowerCase();
      return ref.includes(q) || desc.includes(q) || loc.includes(q);
    });
  }, [moldsList, moldSearchTerm]);

  // Add Mold Modal
  const [isAddMoldModalOpen, setIsAddMoldModalOpen] = useState(false);
  const [creatingMold, setCreatingMold] = useState(false);
  const [newMoldData, setNewMoldData] = useState({
    moldNumber: '',
    description: '',
    status: 'In Stock' as MoldStatus,
    location: '',
    clampingForceRange: '',
    othersWeight: '',
    plateType2: false,
    plateType3: false,
    ewocon: false,
    dme: false,
    flatNozzle: false,
    comment: '',
  });

  // Mold Maintenance Records state
  const [maintenanceRecords, setMaintenanceRecords] = useState<MoldMaintenance[]>(moldMaintenances || []);
  useEffect(() => {
    if (moldMaintenances && moldMaintenances.length > 0) {
      setMaintenanceRecords(moldMaintenances);
    }
  }, [moldMaintenances]);

  // Active maintenance record for selected mold
  const activeMaintenanceRecord = useMemo(() => {
    if (!selectedMold) return null;
    const inProgress = maintenanceRecords.find(
      (r) =>
        (r.moldId === selectedMold.id || r.moldNumber === (selectedMold.moldNumber || selectedMold.ref)) &&
        r.status === 'in_progress'
    );
    if (inProgress) return inProgress;
    return (
      maintenanceRecords.find(
        (r) => r.moldId === selectedMold.id || r.moldNumber === (selectedMold.moldNumber || selectedMold.ref)
      ) || null
    );
  }, [maintenanceRecords, selectedMold]);

  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [savingMaintenanceDetails, setSavingMaintenanceDetails] = useState(false);
  const [uploadingMaintenanceImage, setUploadingMaintenanceImage] = useState(false);
  const [uploadingDevis, setUploadingDevis] = useState(false);

  const [maintenanceFormData, setMaintenanceFormData] = useState<{
    id?: string;
    date: string;
    repairLocation: RepairLocation;
    issueDescription: string;
    supplierName: string;
    devisUrl: string;
    actionsPerformed: string[];
    imageUrl: string;
  }>({
    date: new Date().toISOString().split('T')[0],
    repairLocation: 'local',
    issueDescription: '',
    supplierName: '',
    devisUrl: '',
    actionsPerformed: [''],
    imageUrl: '',
  });

  // Close Mold Maintenance modal state
  const [isCloseMaintenanceModalOpen, setIsCloseMaintenanceModalOpen] = useState(false);
  const [closeStatusChoice, setCloseStatusChoice] = useState<'In Stock' | 'In Use' | 'Exported'>('In Stock');
  const [closingLocationInput, setClosingLocationInput] = useState('');
  const [closingInUseMachineSearch, setClosingInUseMachineSearch] = useState('');
  const [closingInUseMachineDropdown, setClosingInUseMachineDropdown] = useState(false);
  const [closingMaintenance, setClosingMaintenance] = useState(false);

  // Clear inputs when selected mold changes
  useEffect(() => {
    setMoldLocationInput('');
    setMoldReasonInput('');
    setInUseMachineName('');
    setInUseMachineSearch('');
    setMoldExportDateInput(new Date().toISOString().split('T')[0]);
    setMoldExportDestinationInput('');
  }, [selectedMoldId]);

  // Handlers for Mold Actions:
  const handleSaveMoldLocation = () => {
    if (!selectedMold) {
      toast.error('Veuillez sélectionner un moule');
      return;
    }
    const locToSave = moldLocationInput.trim() || selectedMold.location || selectedMold.rackLocation || '';
    setSavingMold(true);
    const updates: Partial<Mold> = { status: 'In Stock', location: locToSave, rackLocation: locToSave };
    setMoldsList((prev) => prev.map((m) => (m.id === selectedMold.id ? { ...m, ...updates } : m)));
    if (onUpdateMold) onUpdateMold(selectedMold.id, updates);
    toast.success(moldLocationInput.trim() ? `Emplacement mis à jour : ${locToSave}` : 'Statut mis à jour : In Stock');
    setMoldLocationInput('');
    setSavingMold(false);
  };

  const handleSaveMoldMaintenance = () => {
    if (!selectedMold) {
      toast.error('Veuillez sélectionner un moule');
      return;
    }
    const moldNum = selectedMold.moldNumber || selectedMold.ref || 'Moule';
    const workflow = getMoldWorkflowState(selectedMold);
    if (workflow.stage !== 'can_create_ticket') {
      toast.error(
        `Le moule ${moldNum} a déjà une procédure en cours (${workflow.label}).`
      );
      return;
    }

    setSavingMold(true);
    const reason = moldReasonInput.trim();
    const updates: Partial<Mold> = {
      status: 'In Maintenance',
      comment: reason || selectedMold.comment || '',
    };
    setMoldsList((prev) => prev.map((m) => (m.id === selectedMold.id ? { ...m, ...updates } : m)));
    if (onUpdateMold) onUpdateMold(selectedMold.id, updates);

    // 1. Directly create the official Intervention Request (DI) for this Mold
    const nextRef = generateNextIRRef(requests);
    const newIR: InterventionRequest = {
      id: `ir-${Date.now()}`,
      refIR: nextRef,
      date: new Date().toISOString().split('T')[0],
      problemDescription: `Maintenance moule ${moldNum}: ${reason || selectedMold.comment || 'Intervention demandée via Tablette'}`,
      requester: currentUser?.name || currentUser?.username || 'Technicien Atelier',
      requesterRole: currentUser?.role || 'Technician',
      status: 'Waiting',
      validatedBy: '',
      validatedAt: '',
      category: 'Mold',
      equipmentId: selectedMold.id,
      equipmentName: `Moule ${moldNum}`,
      priority: 'High',
    };

    if (!isOnline) {
      addToOfflineQueue('request', newIR, `Demande Moule ${newIR.refIR}`);
      setOfflineQueue(getOfflineQueue());
    }
    onSaveNewRequest(newIR);

    // 2. Create local maintenance record linked to this IR
    const newRecord: MoldMaintenance = {
      id: `mm-${Date.now()}`,
      moldId: selectedMold.id,
      moldNumber: moldNum,
      date: new Date().toISOString().split('T')[0],
      repairLocation: 'local',
      status: 'in_progress',
      issueDescription: reason || selectedMold.comment || `Demande ${newIR.refIR}`,
      actionsPerformed: [`Demande d'intervention ${newIR.refIR} ouverte`],
    };
    setMaintenanceRecords((prev) => [newRecord, ...prev]);
    if (onSaveMoldMaintenance) onSaveMoldMaintenance(newRecord);

    toast.success(`Moule mis en maintenance et Demande ${newIR.refIR} créée !`, {
      description: 'En attente de validation par le Responsable Technique.',
    });
    setMoldReasonInput('');
    setSavingMold(false);
  };

  const handleSaveMoldInUse = () => {
    if (!selectedMold) {
      toast.error('Veuillez sélectionner un moule');
      return;
    }
    if (!inUseMachineName.trim()) {
      toast.error('Veuillez sélectionner une machine');
      return;
    }
    setSavingInUseMold(true);
    const targetMach = inUseMachineName.trim();
    const updates: Partial<Mold> = {
      status: 'In Use',
      location: targetMach,
      assignedMachineNumber: targetMach,
    };
    setMoldsList((prev) => prev.map((m) => (m.id === selectedMold.id ? { ...m, ...updates } : m)));
    if (onUpdateMold) onUpdateMold(selectedMold.id, updates);
    toast.success(`Moule ${selectedMold.moldNumber || selectedMold.ref} monté sur ${targetMach}`);
    setInUseMachineName('');
    setInUseMachineSearch('');
    setSavingInUseMold(false);
  };

  const handleSaveMoldExported = () => {
    if (!selectedMold) {
      toast.error('Veuillez sélectionner un moule');
      return;
    }
    setSavingExportMold(true);
    const expDate = moldExportDateInput || new Date().toISOString().split('T')[0];
    const dest = moldExportDestinationInput.trim() || (selectedMold.status === 'Exported' ? (selectedMold.location || '') : '') || 'Exporté';
    const updates: Partial<Mold> = {
      status: 'Exported',
      exportDate: expDate,
      location: dest,
    };
    setMoldsList((prev) => prev.map((m) => (m.id === selectedMold.id ? { ...m, ...updates } : m)));
    if (onUpdateMold) onUpdateMold(selectedMold.id, updates);
    toast.success(`Moule ${selectedMold.moldNumber || selectedMold.ref} marqué comme Exporté`);
    setMoldExportDestinationInput('');
    setSavingExportMold(false);
  };

  const handleDownloadMoldPdf = () => {
    if (!selectedMold) return;
    try {
      generateFicheTechniqueMoulePdf(
        selectedMold,
        currentUser ? { name: currentUser.name, role: currentUser.role } : undefined
      );
      toast.success('Fiche technique moule générée');
    } catch {
      toast.error('Erreur lors de la génération du PDF');
    }
  };

  const handleCreateNewMold = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMoldData.moldNumber.trim()) {
      toast.error('Le numéro de moule est obligatoire');
      return;
    }
    setCreatingMold(true);
    const newId = `mld-${Date.now()}`;
    const newMold: Mold = {
      id: newId,
      moldNumber: newMoldData.moldNumber.trim(),
      ref: newMoldData.moldNumber.trim(),
      description: newMoldData.description.trim() || 'Moule d\'injection',
      status: newMoldData.status,
      location: newMoldData.location.trim() || 'RACK-01',
      rackLocation: newMoldData.location.trim() || 'RACK-01',
      clampingForceRange: newMoldData.clampingForceRange.trim(),
      othersWeight: newMoldData.othersWeight.trim(),
      plateType2: newMoldData.plateType2,
      plateType3: newMoldData.plateType3,
      ewocon: newMoldData.ewocon,
      dme: newMoldData.dme,
      flatNozzle: newMoldData.flatNozzle,
      comment: newMoldData.comment.trim(),
      currentShots: 0,
      maxShotsBeforeMaintenance: 200000,
    };

    setMoldsList((prev) => [newMold, ...prev]);
    setSelectedMoldId(newMold.id);
    if (onAddNewMold) onAddNewMold(newMold);
    toast.success(`Moule "${newMold.moldNumber}" ajouté avec succès`);

    setNewMoldData({
      moldNumber: '',
      description: '',
      status: 'In Stock',
      location: '',
      clampingForceRange: '',
      othersWeight: '',
      plateType2: false,
      plateType3: false,
      ewocon: false,
      dme: false,
      flatNozzle: false,
      comment: '',
    });
    setCreatingMold(false);
    setIsAddMoldModalOpen(false);
  };

  const handleOpenMaintenanceModal = (moldToEdit?: Mold) => {
    const target = moldToEdit || selectedMold;
    if (!target) return;
    if (moldToEdit && moldToEdit.id !== selectedMoldId) {
      setSelectedMoldId(moldToEdit.id);
    }

    const workflow = getMoldWorkflowState(target);
    if (workflow.stage !== 'ready_to_report') {
      if (workflow.stage === 'waiting_validation') {
        toast.error('Accès refusé : la demande d\'intervention est en attente de validation par le Responsable Technique.');
      } else if (workflow.stage === 'waiting_work_order') {
        toast.error('Accès refusé : en attente de création de l\'Ordre de Travail (OT).');
      } else if (workflow.stage === 'waiting_3_validations') {
        toast.error('Accès refusé : l\'OT nécessite les 3 pré-validations (Resp Maint, Resp Prod, QHSE) avant d\'ouvrir la fiche travaux.');
      } else {
        toast.error('Accès refusé : veuillez d\'abord créer une Demande d\'Intervention (DI).');
      }
      return;
    }

    const targetMaintRecord = maintenanceRecords.find(
      (r) =>
        (r.moldId === target.id || r.moldNumber === (target.moldNumber || target.ref)) &&
        r.status === 'in_progress'
    ) || maintenanceRecords.find(
      (r) => r.moldId === target.id || r.moldNumber === (target.moldNumber || target.ref)
    );

    if (targetMaintRecord) {
      setMaintenanceFormData({
        id: targetMaintRecord.id,
        date: targetMaintRecord.date || new Date().toISOString().split('T')[0],
        repairLocation: targetMaintRecord.repairLocation || 'local',
        issueDescription: targetMaintRecord.issueDescription || target.comment || '',
        supplierName: targetMaintRecord.supplierName || '',
        devisUrl: targetMaintRecord.devisUrl || '',
        actionsPerformed:
          targetMaintRecord.actionsPerformed && targetMaintRecord.actionsPerformed.length > 0
            ? [...targetMaintRecord.actionsPerformed]
            : [''],
        imageUrl: targetMaintRecord.imageUrl || '',
      });
    } else {
      setMaintenanceFormData({
        id: undefined,
        date: new Date().toISOString().split('T')[0],
        repairLocation: 'local',
        issueDescription: target.comment || '',
        supplierName: '',
        devisUrl: '',
        actionsPerformed: [''],
        imageUrl: '',
      });
    }
    setIsMaintenanceModalOpen(true);
  };

  const handleAddAction = () => {
    setMaintenanceFormData((prev) => ({
      ...prev,
      actionsPerformed: [...prev.actionsPerformed, ''],
    }));
  };

  const handleRemoveAction = (index: number) => {
    if (maintenanceFormData.actionsPerformed.length <= 1) {
      setMaintenanceFormData((prev) => ({ ...prev, actionsPerformed: [''] }));
      return;
    }
    setMaintenanceFormData((prev) => ({
      ...prev,
      actionsPerformed: prev.actionsPerformed.filter((_, i) => i !== index),
    }));
  };

  const handleActionChange = (index: number, val: string) => {
    const updated = [...maintenanceFormData.actionsPerformed];
    updated[index] = val;
    setMaintenanceFormData((prev) => ({ ...prev, actionsPerformed: updated }));
  };

  const handleMaintenancePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMaintenanceImage(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setMaintenanceFormData((prev) => ({ ...prev, imageUrl: (event.target?.result as string) || '' }));
      toast.success('Photo ajoutée avec succès');
      setUploadingMaintenanceImage(false);
    };
    reader.onerror = () => {
      toast.error('Erreur lors de la lecture du fichier');
      setUploadingMaintenanceImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handleMaintenanceDevisUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDevis(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setMaintenanceFormData((prev) => ({ ...prev, devisUrl: (event.target?.result as string) || '' }));
      toast.success('Document / Devis importé');
      setUploadingDevis(false);
    };
    reader.onerror = () => {
      toast.error('Erreur lors de la lecture du fichier');
      setUploadingDevis(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveMaintenanceDetails = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedMold) return;
    if (!maintenanceFormData.issueDescription.trim()) {
      toast.error('Veuillez renseigner la description du problème.');
      return;
    }
    const cleanActions = maintenanceFormData.actionsPerformed.map((a) => a.trim()).filter(Boolean);
    setSavingMaintenanceDetails(true);

    const recordToSave: MoldMaintenance = {
      id: maintenanceFormData.id || `mm-${Date.now()}`,
      moldId: selectedMold.id,
      moldNumber: selectedMold.moldNumber || selectedMold.ref || 'Moule',
      date: maintenanceFormData.date,
      repairLocation: maintenanceFormData.repairLocation,
      status: 'in_progress',
      issueDescription: maintenanceFormData.issueDescription.trim(),
      supplierName:
        maintenanceFormData.repairLocation === 'external' ? maintenanceFormData.supplierName.trim() : undefined,
      devisUrl: maintenanceFormData.repairLocation === 'external' ? maintenanceFormData.devisUrl : undefined,
      actionsPerformed: cleanActions.length > 0 ? cleanActions : ['Maintenance effectuée'],
      imageUrl: maintenanceFormData.imageUrl || undefined,
    };

    setMaintenanceRecords((prev) => {
      const idx = prev.findIndex((r) => r.id === recordToSave.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = recordToSave;
        return copy;
      }
      return [recordToSave, ...prev];
    });

    if (onSaveMoldMaintenance) onSaveMoldMaintenance(recordToSave);
    toast.success('Fiche de maintenance enregistrée');
    setSavingMaintenanceDetails(false);
    setIsMaintenanceModalOpen(false);
  };

  const handleOpenCloseModal = (moldToClose?: Mold) => {
    const target = moldToClose || selectedMold;
    if (!target) return;
    if (moldToClose && moldToClose.id !== selectedMoldId) {
      setSelectedMoldId(moldToClose.id);
    }
    setCloseStatusChoice('In Stock');
    setClosingLocationInput(target.location || target.rackLocation || '');
    setIsCloseMaintenanceModalOpen(true);
  };

  const handleConfirmCloseMaintenance = () => {
    if (!selectedMold) return;
    setClosingMaintenance(true);

    const targetRecId = activeMaintenanceRecord?.id || maintenanceFormData.id;
    if (targetRecId) {
      setMaintenanceRecords((prev) =>
        prev.map((r) => (r.id === targetRecId ? { ...r, status: 'completed' } : r))
      );
    }

    const locVal = closingLocationInput.trim() || selectedMold.location || selectedMold.rackLocation || '';
    const updates: Partial<Mold> = {
      status: closeStatusChoice,
      location: closeStatusChoice === 'Exported' ? (closingLocationInput.trim() || 'Exporté') : locVal,
      rackLocation: closeStatusChoice === 'In Stock' ? locVal : selectedMold.rackLocation,
      exportDate:
        closeStatusChoice === 'Exported'
          ? moldExportDateInput || new Date().toISOString().split('T')[0]
          : selectedMold.exportDate,
      assignedMachineNumber: closeStatusChoice === 'In Use' ? locVal : undefined,
    };

    setMoldsList((prev) => prev.map((m) => (m.id === selectedMold.id ? { ...m, ...updates } : m)));
    if (onUpdateMold) onUpdateMold(selectedMold.id, updates);

    const statusLabel =
      closeStatusChoice === 'In Stock' ? 'En Stock' : closeStatusChoice === 'In Use' ? 'En Utilisation' : 'Exporté';
    toast.success(`Maintenance clôturée pour le moule ${selectedMold.moldNumber || selectedMold.ref}`, {
      description: `Statut passé à "${statusLabel}"`,
    });

    setClosingMaintenance(false);
    setIsCloseMaintenanceModalOpen(false);
    setIsMaintenanceModalOpen(false);
    setClosingLocationInput('');
    setClosingInUseMachineSearch('');
  };

  // Handle Save Status Change
  const handleSaveStatus = () => {
    if (!currentMachine || !pendingStatus) return;
    onUpdateMachineStatus(currentMachine.id, pendingStatus, statusReasonInput);

    // If putting machine in maintenance or down, automatically generate the official DI
    if (
      pendingStatus === 'Under Maintenance' ||
      pendingStatus === 'maintenance' ||
      pendingStatus === 'Stopped' ||
      pendingStatus === 'down'
    ) {
      const workflow = getMachineWorkflowState(currentMachine);
      if (workflow.stage === 'can_create_ticket') {
        const nextRef = generateNextIRRef(requests);
        const newIR: InterventionRequest = {
          id: `ir-${Date.now()}`,
          refIR: nextRef,
          date: new Date().toISOString().split('T')[0],
          problemDescription: `Arrêt machine ${currentMachine.number}: ${statusReasonInput.trim() || 'Arrêt/Maintenance déclaré via Tablette'}`,
          requester: currentUser?.name || currentUser?.username || 'Technicien Tablette',
          requesterRole: currentUser?.role || 'Technician',
          status: 'Waiting',
          validatedBy: '',
          validatedAt: '',
          category: 'Machine',
          equipmentId: currentMachine.id,
          equipmentName: `${currentMachine.number} (${currentMachine.name || currentMachine.brand})`,
          priority: 'High',
        };

        if (!isOnline) {
          addToOfflineQueue('request', newIR, `Demande Machine ${newIR.refIR}`);
          setOfflineQueue(getOfflineQueue());
        }
        onSaveNewRequest(newIR);
        showTabletToast(
          `Machine ${currentMachine.number} en maintenance`,
          `Demande d'intervention ${newIR.refIR} créée avec succès. En attente de validation.`
        );
      }
    } else {
      showTabletToast(`Status of ${currentMachine.number} updated: ${pendingStatus.toUpperCase()}`);
    }

    setMachineSubView('overview');
    setPendingStatus(null);
    setStatusReasonInput('');
  };

  // Handle Mold Change
  const handleSaveMoldChange = () => {
    if (!currentMachine) return;
    const targetMold = moldPlaceNumber || selectedIncomingMoldNumber;
    if (targetMold) {
      onUpdateMachineMold(currentMachine.id, targetMold);
      showTabletToast(`Mold ${targetMold} mounted on ${currentMachine.number}`);
    }
    setMachineSubView('overview');
    setSelectedIncomingMoldNumber('');
    setMoldPlaceNumber('');
  };

  // Handle Save Production
  const handleSaveProduction = () => {
    if (!currentMachine) return;
    onUpdateMachineProduction(
      currentMachine.id,
      productInput,
      parseInt(qtyProducedInput) || 0,
      parseInt(qtyGoodInput) || 0,
      parseInt(qtyBadInput) || 0
    );
    setMachineSubView('overview');
    showTabletToast(`Production recorded for ${productInput}`);
  };

  // =========================================================================
  // SUBMIT INTERVENTION REQUEST (DI) — supports batch multi-machine
  // =========================================================================
  /**
   * Submit one DI per machine in selectedDIMachineIds.
   * description is the shared problem description typed by the technician.
   * existingReqs is passed in so we can generate sequential refIR values.
   */
  const handleSubmitDIBatch = (
    payloadOrDesc: DIFormSubmitPayload | string,
    maybeReqDate?: string
  ) => {
    let description = '';
    let reqDate = new Date().toISOString().split('T')[0];
    let category: MaintenanceCategory = 'Machine';
    let machineIds: string[] = selectedDIMachineIds;
    let selectedMoldId: string | undefined;
    let otherEquipmentName: string | undefined;
    let priority: PriorityLevel = 'High';

    if (typeof payloadOrDesc === 'string') {
      description = payloadOrDesc;
      if (maybeReqDate) reqDate = maybeReqDate;
    } else {
      description = payloadOrDesc.description;
      reqDate = payloadOrDesc.date || reqDate;
      category = payloadOrDesc.category;
      machineIds = payloadOrDesc.selectedMachineIds || [];
      selectedMoldId = payloadOrDesc.selectedMoldId;
      otherEquipmentName = payloadOrDesc.otherEquipmentName;
      priority = payloadOrDesc.priority || 'High';
    }

    if (!description.trim()) return;

    const created: InterventionRequest[] = [];
    let runningRequests = [...requests];
    const requesterName = currentUser?.name || currentUser?.username || 'Technicien Tablette';
    const requesterRole = currentUser?.role || 'Technician';

    // 1. If Machine category with 1 or more machines selected: batch create per machine
    if (category === 'Machine' && machineIds.length > 0) {
      for (const machineId of machineIds) {
        const targetMachine = machines.find((m) => m.id === machineId);
        if (!targetMachine) continue;

        // Block if machine already has active ticket
        const workflow = getMachineWorkflowState(targetMachine);
        if (workflow.stage !== 'can_create_ticket') {
          showTabletToast(
            `Machine ${targetMachine.number} bloquée`,
            `Ticket déjà actif : ${workflow.label}. Demande ignorée pour cette machine.`
          );
          continue;
        }

        const nextRef = generateNextIRRef(runningRequests, reqDate);
        const newIR: InterventionRequest = {
          id: `ir-${Date.now()}-${machineId}`,
          refIR: nextRef,
          date: reqDate,
          problemDescription: description.trim(),
          requester: requesterName,
          requesterRole,
          status: 'Waiting',
          validatedBy: '',
          validatedAt: '',
          category: 'Machine',
          equipmentId: targetMachine.id,
          equipmentName: `${targetMachine.number} (${targetMachine.name || targetMachine.brand})`,
          priority,
        };

        if (!isOnline) {
          addToOfflineQueue('request', newIR, `Demande Machine ${newIR.refIR}`);
          setOfflineQueue(getOfflineQueue());
        }
        onSaveNewRequest(newIR);
        created.push(newIR);
        runningRequests = [...runningRequests, newIR];
      }
    }
    // 2. If Mold category: create for the selected mold or general mold
    else if (category === 'Mold') {
      const targetMold = molds.find((m) => m.id === selectedMoldId);
      const moldName = targetMold
        ? `Moule ${targetMold.moldNumber || targetMold.ref || targetMold.id}${targetMold.description ? ` (${targetMold.description})` : ''}`
        : otherEquipmentName?.trim() || 'Moule / Outillage';

      const nextRef = generateNextIRRef(runningRequests, reqDate);
      const newIR: InterventionRequest = {
        id: `ir-${Date.now()}-${targetMold?.id || 'mold'}`,
        refIR: nextRef,
        date: reqDate,
        problemDescription: description.trim(),
        requester: requesterName,
        requesterRole,
        status: 'Waiting',
        validatedBy: '',
        validatedAt: '',
        category: 'Mold',
        equipmentId: targetMold?.id,
        equipmentName: moldName,
        priority,
      };

      if (!isOnline) {
        addToOfflineQueue('request', newIR, `Demande Moule ${newIR.refIR}`);
        setOfflineQueue(getOfflineQueue());
      }
      onSaveNewRequest(newIR);
      created.push(newIR);
    }
    // 3. If Other category OR Machine category with no specific machines checked
    else {
      const equipName =
        otherEquipmentName?.trim() ||
        (category === 'Machine' ? 'Presse / Machine générale' : 'Autre équipement / Atelier');

      const nextRef = generateNextIRRef(runningRequests, reqDate);
      const newIR: InterventionRequest = {
        id: `ir-${Date.now()}-general`,
        refIR: nextRef,
        date: reqDate,
        problemDescription: description.trim(),
        requester: requesterName,
        requesterRole,
        status: 'Waiting',
        validatedBy: '',
        validatedAt: '',
        category: category || 'Other',
        equipmentName: equipName,
        priority,
      };

      if (!isOnline) {
        addToOfflineQueue('request', newIR, `Demande ${newIR.refIR}`);
        setOfflineQueue(getOfflineQueue());
      }
      onSaveNewRequest(newIR);
      created.push(newIR);
    }

    if (created.length === 0) return;

    clearDIDraft();
    setPrefilledDescription('');
    setSelectedDIMachineIds([]);
    setDiCreatedNotices(created);
    setDiSubView('list');
    setDiPage(1);
    showTabletToast(
      `${created.length} Demande(s) créée(s) !`,
      created.map((r) => r.refIR).join(', ') + ' — En attente de validation.'
    );
  };

  // Legacy single-machine handler kept for backward-compat (mold workflow passes a full IR)
  const handleSaveIRFromTablet = (newReq: InterventionRequest) => {
    if (!isOnline) {
      addToOfflineQueue('request', newReq, `Request ${newReq.refIR}`);
      setOfflineQueue(getOfflineQueue());
      onSaveNewRequest(newReq);
      clearDIDraft();
      setPrefilledDescription('');
      setSelectedDIMachineIds([]);
      setDiCreatedNotices([newReq]);
      setDiSubView('list');
      setDiPage(1);
      showTabletToast(
        `Demande ${newReq.refIR} enregistrée hors ligne !`,
        'Enregistré en file locale. Transmission automatique dès connexion.'
      );
      return;
    }
    onSaveNewRequest(newReq);
    clearDIDraft();
    setPrefilledDescription('');
    setSelectedDIMachineIds([]);
    setDiCreatedNotices([newReq]);
    setDiSubView('list');
    setDiPage(1);
    showTabletToast(
      `Demande ${newReq.refIR} transmise !`,
      'Statut : En attente de validation Responsable Technique.'
    );
  };

  // Add Part to report
  const handleAddStockPart = () => {
    const item = stock.find((s) => s.id === selectedStockPartId);
    if (!item) return;

    const existingIndex = consumedPartsList.findIndex((p) => p.partId === item.id);
    if (existingIndex >= 0) {
      const updated = [...consumedPartsList];
      updated[existingIndex].qty += selectedStockQty;
      setConsumedPartsList(updated);
    } else {
      setConsumedPartsList([
        ...consumedPartsList,
        {
          partId: item.id,
          partNumber: item.partNumber,
          name: item.name,
          qty: selectedStockQty,
          unitPrice: item.unitPrice || 15.0,
        },
      ]);
    }
    showTabletToast(`Part added: ${item.name} (x${selectedStockQty})`);
  };

  // Quick Supervisor Pre-Validation helper on tablet (so technicians or supervisors can test the 3-step unlock)
  const handleQuickPreValidate = (order: MaintenanceOrder, step: 1 | 2 | 3) => {
    if (step === 1 && onValidatePreStep1) {
      onValidatePreStep1(order.id, order.estimatedHours || 2.0, new Date().toISOString().split('T')[0], '09:00');
    } else if (step === 2 && onValidatePreStep2) {
      onValidatePreStep2(order.id);
    } else if (step === 3 && onValidatePreStep3) {
      onValidatePreStep3(order.id);
    }
    showTabletToast(`Step ${step} validated successfully for ${order.refOT}`);
  };

  // Helper to identify machine for targetReportOrder
  const targetReportMachine = useMemo(() => {
    if (!targetReportOrder) return null;
    return (
      machines.find(
        (m) =>
          m.id === targetReportOrder.machineId ||
          m.id === targetReportOrder.equipmentId ||
          (targetReportOrder.machineNumber && m.number.toLowerCase() === targetReportOrder.machineNumber.toLowerCase()) ||
          (targetReportOrder.equipmentName &&
            (m.number.toLowerCase() === targetReportOrder.equipmentName.toLowerCase() ||
              m.name?.toLowerCase() === targetReportOrder.equipmentName.toLowerCase() ||
              targetReportOrder.equipmentName.toLowerCase().includes(m.number.toLowerCase())))
      ) || null
    );
  }, [machines, targetReportOrder]);

  const isTargetOrderMachine = useMemo(() => {
    return (
      targetReportOrder?.category === 'Machine' ||
      Boolean(targetReportMachine) ||
      Boolean(targetReportOrder?.machineId)
    );
  }, [targetReportOrder, targetReportMachine]);

  // Helper to identify mold for targetReportOrder
  const targetReportMold = useMemo(() => {
    if (!targetReportOrder) return null;
    return (
      molds.find(
        (m) =>
          m.id === targetReportOrder.moldId ||
          m.id === targetReportOrder.equipmentId ||
          (targetReportOrder.moldRef &&
            (m.moldNumber?.toLowerCase() === targetReportOrder.moldRef.toLowerCase() ||
              m.ref?.toLowerCase() === targetReportOrder.moldRef.toLowerCase())) ||
          (targetReportOrder.equipmentName &&
            (m.moldNumber?.toLowerCase() === targetReportOrder.equipmentName.toLowerCase() ||
              m.ref?.toLowerCase() === targetReportOrder.equipmentName.toLowerCase() ||
              targetReportOrder.equipmentName.toLowerCase().includes((m.moldNumber || m.ref || '').toLowerCase())))
      ) || null
    );
  }, [molds, targetReportOrder]);

  const isTargetOrderMold = useMemo(() => {
    return (
      targetReportOrder?.category === 'Mold' ||
      Boolean(targetReportMold) ||
      Boolean(targetReportOrder?.moldId) ||
      Boolean(targetReportOrder?.moldRef)
    );
  }, [targetReportOrder, targetReportMold]);

  const isTargetOrderOther = useMemo(() => {
    return !isTargetOrderMachine && !isTargetOrderMold;
  }, [isTargetOrderMachine, isTargetOrderMold]);

  const lastMachineHours = useMemo(() => {
    return targetReportMachine?.currentHours ?? targetReportMachine?.totalOperatingHours ?? 0;
  }, [targetReportMachine]);

  const tabletReadingNum = parseFloat(reportMeterReadingHours);
  const hasTabletReading = reportMeterReadingHours.trim() !== '' && !isNaN(tabletReadingNum);
  const tabletReadingStats = useMemo(() => {
    if (!hasTabletReading || !targetReportMachine) return null;
    return calculateReadingStats(lastMachineHours, targetReportMachine.lastMeterReadingDate, tabletReadingNum);
  }, [hasTabletReading, lastMachineHours, targetReportMachine, tabletReadingNum]);

  // =========================================================================
  // SUBMIT INTERVENTION REPORT (Only if 3 Validated!)
  // =========================================================================
  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetReportOrder || !isTargetOrder3Validated) {
      showTabletToast('Error: All 3 pre-validations are mandatory!');
      return;
    }

    // Meter reading validation for Machine work orders (Optional!)
    if (isTargetOrderMachine && hasTabletReading) {
      if (tabletReadingStats?.isLowerThanLast) {
        setReportMeterError(`L'index saisi (${tabletReadingNum} h) ne peut pas être inférieur au dernier relevé (${lastMachineHours} h).`);
        showTabletToast('Erreur : Index inférieur au dernier relevé');
        return;
      }
      if (tabletReadingStats?.exceedsCalendarHours && !reportMeterWarningConfirmed) {
        setReportMeterError(`Le delta (+${tabletReadingStats.deltaHours} h) dépasse le temps calendaire (${tabletReadingStats.elapsedCalendarHours} h). Cochez la confirmation.`);
        showTabletToast('Avertissement : Veuillez cocher la confirmation');
        return;
      }
    }

    const existingReport = reports?.find(
      (r) =>
        r.refOT === targetReportOrder.refOT ||
        (targetReportOrder.reportRef && (r.refReport === targetReportOrder.reportRef || r.id === targetReportOrder.reportRef))
    );

    const todayDate = new Date().toISOString().split('T')[0];
    const newReport: InterventionReport = {
      id: existingReport?.id || `rep-${Date.now()}`,
      date: reportDate || existingReport?.date || todayDate,
      refReport: existingReport?.refReport || generateNextReportRef(reports || [], reportDate || todayDate),
      refOT: targetReportOrder.refOT,
      refIR: targetReportOrder.refIR || existingReport?.refIR || '',
      category: targetReportOrder.category || existingReport?.category || 'Machine',
      priority: targetReportOrder.priority || existingReport?.priority || 'High',
      equipmentId: targetReportMachine?.id || targetReportOrder.equipmentId || existingReport?.equipmentId,
      equipmentName: targetReportMachine?.name || targetReportMachine?.number || targetReportOrder.equipmentName || existingReport?.equipmentName,
      meterReadingHours: isTargetOrderMachine && hasTabletReading ? tabletReadingNum : existingReport?.meterReadingHours,
      meterReadingConfirmedWarning: reportMeterWarningConfirmed,
      requestedBy: targetReportOrder.assignedTo || reportTechName || existingReport?.requestedBy || '',
      assignedTo: reportTechName || existingReport?.assignedTo || '',
      filledBy: reportTechName || existingReport?.filledBy || '',
      cause: reportFailureCat === 'mold' ? 'Mold' : 'Mechanical',
      subCause: `${reportFailureSub} - ${reportRootCause}`,
      startingTime: `${reportDate || todayDate} ${reportStartTime}`,
      finishedTime: `${reportDate || todayDate} ${reportEndTime}`,
      durationMinutes: reportDurationMinutes,
      actions: reportActions.length > 0 ? reportActions : (existingReport?.actions || []),
      difficulties: reportDifficulties.trim() ? [reportDifficulties.trim()] : (existingReport?.difficulties || []),
      stockTaken: consumedPartsList.length > 0 ? consumedPartsList.map((p, idx) => ({
        id: `st-${Date.now()}-${idx}`,
        itemId: p.partId,
        itemName: p.name,
        partNumber: p.partNumber,
        qty: p.qty,
        unitPrice: p.unitPrice,
      })) : (existingReport?.stockTaken || []),
      sparePartsCost: (consumedPartsList.length > 0 ? consumedPartsList.map((p, idx) => ({
        id: `st-${Date.now()}-${idx}`,
        itemId: p.partId,
        itemName: p.name,
        partNumber: p.partNumber,
        qty: p.qty,
        unitPrice: p.unitPrice,
      })) : (existingReport?.stockTaken || [])).reduce((acc, it) => acc + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0),
      totalCost: (consumedPartsList.length > 0 ? consumedPartsList.map((p, idx) => ({
        id: `st-${Date.now()}-${idx}`,
        itemId: p.partId,
        itemName: p.name,
        partNumber: p.partNumber,
        qty: p.qty,
        unitPrice: p.unitPrice,
      })) : (existingReport?.stockTaken || [])).reduce((acc, it) => acc + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0),
      status: 'Validated',
      moldNumber: targetReportOrder.moldRef || existingReport?.moldNumber,
      moldRepairLocation: isTargetOrderMold ? reportMoldLocation : existingReport?.moldRepairLocation,
      moldStatusAfterRepair: isTargetOrderMold ? reportMoldStatusAfter : existingReport?.moldStatusAfterRepair,
      affectedCavities: isTargetOrderMold ? reportAffectedCavities : existingReport?.affectedCavities,
    };

    // Clear draft from localStorage on submission
    clearReportDraft(targetReportOrder.id);
    setLastDraftSavedTime(null);
    setIsDraftRestoredNotice(false);

    // If machine status was updated
    if (targetReportOrder.machineId) {
      onUpdateMachineStatus(targetReportOrder.machineId, reportStatusAfter === 'operational' ? 'Running' : 'Stopped');
    }

    if (!isOnline) {
      addToOfflineQueue('report', newReport, `Report ${newReport.refReport} (${newReport.equipmentName})`);
      setOfflineQueue(getOfflineQueue());
      onSaveReport(newReport);
      setConsumedPartsList([]);
      setReportMeterReadingHours('');
      setReportDifficulties('');
      setReportSuccessSubmitted(newReport);
      showTabletToast(
        `Rapport ${newReport.refReport} enregistré hors ligne !`,
        'Enregistré en mémoire tablette. Synchronisation automatique dès reprise du réseau.'
      );
      return;
    }

    onSaveReport(newReport);
    setConsumedPartsList([]);
    setReportMeterReadingHours('');
    setReportDifficulties('');
    setReportSuccessSubmitted(newReport);
    showTabletToast(`Rapport ${newReport.refReport} enregistré et transmis !`, 'Statut OT : En attente validation travail.');
  };

  // Tablet Intervention Requests Filter & Pagination
  const DI_ITEMS_PER_PAGE = 8;
  const filteredDiRequests = useMemo(() => {
    return requests.filter((r) => {
      const q = diSearchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        r.refIR.toLowerCase().includes(q) ||
        (r.equipmentName || '').toLowerCase().includes(q) ||
        (r.requester || '').toLowerCase().includes(q) ||
        (r.problemDescription || '').toLowerCase().includes(q) ||
        (r.relatedOTRef || '').toLowerCase().includes(q);

      const matchesStatus = diStatusFilter === 'all' || r.status === diStatusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [requests, diSearchQuery, diStatusFilter]);

  const paginatedDiRequests = useMemo(() => {
    const start = (diPage - 1) * DI_ITEMS_PER_PAGE;
    return filteredDiRequests.slice(start, start + DI_ITEMS_PER_PAGE);
  }, [filteredDiRequests, diPage]);

  return (
    <div className="w-full min-h-screen bg-slate-100 pb-24 flex flex-col justify-between select-none font-sans text-slate-900">
      {/* ── INDUSTRIAL TOP HEADER (Enterprise GMAO Workshop Terminal) ── */}
      <header className="w-full bg-slate-900 text-white px-4 py-2.5 sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <div className="hidden md:block pl-3 border-l border-slate-700 text-left">
            <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 block uppercase">
              THERMOPLASTICS TUNISIA
            </span>
          </div>
        </div>

        {/* Center Title (Mobile/Tablet) */}
        <div className="text-center px-2">
          <h2 className="text-white font-extrabold text-sm sm:text-base tracking-tight leading-none">
            {activeTab === 'machines'
              ? 'Parc Machines'
              : activeTab === 'orders'
                ? 'Ordres de Travail (OT)'
                : activeTab === 'send_di'
                  ? "Demande d'Intervention (DI)"
                  : activeTab === 'fill_report'
                    ? "Rapport d'Intervention (PV)"
                    : 'Gestion des Moules'}
          </h2>
        </div>

        {/* Quick Industrial Status & Actions */}
        <div className="flex items-center gap-2">

          {/* Current User Display (read-only, no switcher) */}
          <div
            className="min-h-[42px] flex items-center gap-2 bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold px-3 rounded-lg"
            title={`Connecté en tant que : ${currentUser?.name || reportTechName}`}
          >
            <UserCheck size={16} className="text-emerald-400" />
            <span className="max-w-[120px] truncate font-medium">{currentUser?.name || reportTechName}</span>
          </div>

          {/* Menu Drawer */}
          <button
            type="button"
            onClick={() => setIsSideMenuOpen(!isSideMenuOpen)}
            className="min-h-[42px] min-w-[42px] bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center justify-center text-slate-200 cursor-pointer transition-colors"
            title="Menu"
          >
            <Menu size={20} className="stroke-[2.5]" />
          </button>
        </div>
      </header>

      {/* ── TOAST NOTIFICATION ── */}
      {tabletToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-semibold animate-in fade-in slide-in-from-top-4 border border-slate-700 max-w-md w-[92%]">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-white">{tabletToast.title}</p>
            {tabletToast.subtitle && <p className="text-[11px] text-slate-300 font-normal mt-0.5">{tabletToast.subtitle}</p>}
          </div>
          <button onClick={() => setTabletToast(null)} className="text-slate-400 hover:text-white cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── USER SESSION INFO CARD (no switcher) ── */}

      {/* ── SIDE DRAWER MENU ── */}
      {isSideMenuOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex justify-end animate-in fade-in">
          <div className="w-80 bg-white h-full shadow-2xl p-6 flex flex-col justify-between animate-in slide-in-from-right border-l border-slate-300">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Session : {currentUser?.name || 'Technicien'}</p>
                </div>
                <button
                  onClick={() => setIsSideMenuOpen(false)}
                  className="min-h-[36px] min-w-[36px] rounded-lg text-slate-400 hover:text-slate-900 flex items-center justify-center cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => {
                    setActiveTab('machines');
                    setMachineSubView('overview');
                    setIsSideMenuOpen(false);
                  }}
                  className={`min-h-[48px] w-full p-3 rounded-lg flex items-center justify-between text-sm font-bold text-left transition-colors cursor-pointer ${activeTab === 'machines' ? 'bg-slate-900 text-white shadow-xs' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Wrench size={18} />
                    <span>Machines &amp; Atelier</span>
                  </div>
                  {machinesInMaintCount > 0 && (
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${activeTab === 'machines' ? 'bg-amber-400 text-slate-950' : 'bg-amber-100 text-amber-900'
                        }`}
                    >
                      {machinesInMaintCount} Arrêt
                    </span>
                  )}
                </button>

                <button
                  onClick={() => {
                    setActiveTab('orders');
                    setIsSideMenuOpen(false);
                  }}
                  className={`min-h-[48px] w-full p-3 rounded-lg flex items-center justify-between text-sm font-bold text-left transition-colors cursor-pointer ${activeTab === 'orders' ? 'bg-slate-900 text-white shadow-xs' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <ClipboardList size={18} />
                    <span>Ordres de Travail (OT)</span>
                  </div>
                  {ordersReadyForReportCount > 0 && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-600 text-white">
                      {ordersReadyForReportCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => {
                    setPrefilledDescription('');
                    setPrefilledTargetMachineId('');
                    setActiveTab('send_di');
                    setDiSubView('list');
                    setIsSideMenuOpen(false);
                  }}
                  className={`min-h-[48px] w-full p-3 rounded-lg flex items-center justify-between text-sm font-bold text-left transition-colors cursor-pointer ${activeTab === 'send_di' ? 'bg-slate-900 text-white shadow-xs' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Send size={18} />
                    <span>Demandes d'Intervention (DI)</span>
                  </div>
                  {requests.filter((r) => r.status === 'Waiting').length > 0 && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-400 text-slate-950">
                      {requests.filter((r) => r.status === 'Waiting').length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    setActiveTab('fill_report');
                    setIsSideMenuOpen(false);
                  }}
                  className={`min-h-[48px] w-full p-3 rounded-lg flex items-center justify-between text-sm font-bold text-left transition-colors cursor-pointer ${activeTab === 'fill_report' ? 'bg-slate-900 text-white shadow-xs' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText size={18} />
                    <span>Rapport d'Intervention (PV)</span>
                  </div>
                  {isTargetOrder3Validated ? (
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded">
                      Débloqué
                    </span>
                  ) : (
                    <Lock size={14} className="text-slate-400" />
                  )}
                </button>


                <button
                  onClick={() => {
                    setActiveTab('molds');
                    setIsSideMenuOpen(false);
                  }}
                  className={`min-h-[48px] w-full p-3 rounded-lg flex items-center gap-3 text-sm font-bold text-left transition-colors cursor-pointer ${activeTab === 'molds' ? 'bg-slate-900 text-white shadow-xs' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                >
                  <Box size={18} />
                  <span>Gestion des Moules</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('ofs_list');
                    setIsSideMenuOpen(false);
                  }}
                  className={`min-h-[48px] w-full p-3 rounded-lg flex items-center justify-between text-sm font-bold text-left transition-colors cursor-pointer ${activeTab === 'ofs_list' ? 'bg-slate-900 text-white shadow-xs' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Layers size={18} />
                    <span>Ofs List (Dossiers PDF)</span>
                  </div>
                  {activeOFsCount > 0 && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-600 text-white">
                      {activeOFsCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-200 space-y-3">
              {/* Connected User Info */}
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                <UserCheck size={18} className="text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{currentUser?.name || 'Technicien'}</p>
                  <p className="text-[10px] text-slate-500 font-mono uppercase">{currentUser?.role || 'technicien'}</p>
                </div>
              </div>
              {/* Logout Button */}
              <button
                onClick={async () => {
                  setIsSideMenuOpen(false);
                  if (onLogout) onLogout();
                  else await logout();
                }}
                className="min-h-[48px] w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold rounded-lg text-sm transition-colors cursor-pointer"
              >
                <Lock size={16} />
                <span>Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN SCROLLABLE TABLET CONTENT ── */}
      <main className="flex-1 overflow-y-auto w-full p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
        {/* ========================================================================= */}
        {/* TAB 1: PARC MACHINES & ATELIER (DOWN & MAINTENANCE ONLY)                  */}
        {/* ========================================================================= */}
        {activeTab === 'machines' && machineSubView === 'overview' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Search and Filter Status Indicator */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={machineSearch}
                  onChange={(e) => setMachineSearch(e.target.value)}
                  className="w-full min-h-[46px] pl-10 pr-4 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 shadow-2xs"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="min-h-[46px] px-3.5 py-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs font-bold text-amber-950 whitespace-nowrap flex items-center justify-between sm:justify-start gap-2 shadow-2xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span>EN ARRÊT</span>
                  </div>
                  <span className="text-amber-950 bg-amber-200/80 px-2 py-0.5 rounded font-black">
                    {machinesInMaintCount}
                  </span>
                </div>

                {/* View toggle (List vs Cards) */}
                <div className="flex items-center bg-white p-1 rounded-lg border border-slate-300 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setMachineLayoutMode('list')}
                    className={`p-2 rounded-md transition-colors cursor-pointer ${machineLayoutMode === 'list'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                      }`}
                    title="Affichage en Liste"
                  >
                    <List size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMachineLayoutMode('cards')}
                    className={`p-2 rounded-md transition-colors cursor-pointer ${machineLayoutMode === 'cards'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                      }`}
                    title="Affichage en Cartes"
                  >
                    <LayoutGrid size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Machines Grid or Empty State */}
            {filteredMachinesList.length === 0 ? (
              <div className="bg-white rounded-xl p-8 border border-slate-300 text-center space-y-4 shadow-xs animate-in fade-in">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center mx-auto">
                  <CheckCircle2 size={30} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {machineSearch ? 'Aucune machine arrêtée correspondant à la recherche' : 'Aucune presse en arrêt ou sous maintenance'}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                    {machineSearch
                      ? `Aucune presse n'a été trouvée pour "${machineSearch}".`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPrefilledDescription('');
                    setSelectedDIMachineIds([]);
                    setActiveTab('send_di');
                    setDiSubView('create');
                  }}
                  className="min-h-[48px] inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-lg text-sm font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus size={16} />
                  <span>Signaler un Incident / Panne (DI)</span>
                </button>
              </div>
            ) : machineLayoutMode === 'list' ? (
              /* ── High-Density List View ── */
              <div className="bg-white rounded-xl border border-slate-300 shadow-xs divide-y divide-slate-200 overflow-hidden animate-in fade-in">
                {/* Header row on tablet/desktop */}
                <div className="hidden md:grid md:grid-cols-12 gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider items-center">
                  <div className="md:col-span-4">Presse & Caractéristiques</div>
                  <div className="md:col-span-3">Moule monté / Pièce</div>
                  <div className="md:col-span-2">Statut / Motif</div>
                  <div className="md:col-span-3 text-right">Ticket & Actions</div>
                </div>

                {filteredMachinesList.map((m) => {
                  const isSelected = selectedMachineId === m.id;
                  const workflow = getMachineWorkflowState(m);
                  const isCheckedForDI = selectedDIMachineIds.includes(m.id);

                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMachineId(m.id)}
                      className={`p-3 md:px-4 md:py-3 transition-colors cursor-pointer hover:bg-slate-50/90 ${isSelected ? 'bg-slate-50/90 ring-1 ring-inset ring-slate-900/10' : ''
                        }`}
                    >
                      <div className="flex flex-col md:grid md:grid-cols-12 md:items-center gap-3">
                        {/* ── Col 1 (md:col-span-4): Machine Identity ── */}
                        <div className="flex items-center gap-3 md:col-span-4 min-w-0">
                          <div className="w-10 h-10 bg-slate-900 text-white rounded-lg flex items-center justify-center font-mono font-bold text-sm tracking-wider shrink-0 shadow-2xs">
                            {m.number}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-sm text-slate-900 truncate">
                                {m.name || `${m.brand} ${m.model}`}
                              </h3>
                              <span
                                className={`md:hidden shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${m.status === 'Stopped' || m.status === 'down'
                                  ? 'bg-red-50 text-red-900 border-red-300'
                                  : 'bg-amber-50 text-amber-900 border-amber-300'
                                  }`}
                              >
                                {m.status === 'Stopped' || m.status === 'down' ? 'ARRÊT' : 'MAINT'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-mono truncate">
                              SN: {m.serialNumber || '—'}
                              {(m.clampingForce || m.clampingForceTons) && ` · ${m.clampingForce || m.clampingForceTons} T`}
                              {m.location && ` · ${m.location}`}
                            </p>
                          </div>
                        </div>

                        {/* ── Col 2 (md:col-span-3): Mold & Product ── */}
                        <div className="md:col-span-3 min-w-0 text-xs border-t md:border-t-0 border-slate-100 pt-2 md:pt-0">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide shrink-0">Moule:</span>
                            <span className="font-mono font-bold text-slate-800 text-[11px] truncate">
                              {m.activeMoldRef || '—'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 truncate mt-0.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide shrink-0">Pièce:</span>
                            <span className="truncate">{m.injectingProduct || '—'}</span>
                          </div>
                          {(() => {
                            const machineOF = syncedOFs.find(
                              (o) => (o.machineId === m.id || (o.machineName && o.machineName.includes(m.number)) || (m.ofReference && o.ofNumber === m.ofReference)) && o.status !== 'Done'
                            );
                            if (!machineOF) return null;
                            return (
                              <div className="flex items-center gap-1.5 text-[11px] mt-1 pt-1 border-t border-slate-100">
                                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide shrink-0">OF:</span>
                                <span className="font-mono font-bold text-blue-800 text-[11px] truncate">{machineOF.ofNumber}</span>
                                {machineOF.pdfUrl && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPreviewPdfOF(machineOF);
                                    }}
                                    className="ml-auto px-1.5 py-0.5 bg-red-100 hover:bg-red-200 text-red-800 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                                    title="Consulter le rapport PDF de cet OF"
                                  >
                                    <FileText size={11} className="text-red-600" />
                                    <span>PDF OF</span>
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {/* ── Col 3 (md:col-span-2): Status & Motif ── */}
                        <div className="md:col-span-2 min-w-0">
                          <span
                            className={`hidden md:inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${m.status === 'Stopped' || m.status === 'down'
                              ? 'bg-red-50 text-red-900 border-red-300'
                              : 'bg-amber-50 text-amber-900 border-amber-300'
                              }`}
                          >
                            {m.status === 'Stopped' || m.status === 'down' ? 'ARRÊT MACHINE' : 'EN MAINTENANCE'}
                          </span>
                          {m.statusReason ? (
                            <div className="flex items-center gap-1 text-[11px] text-amber-800 truncate mt-1">
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              <span className="truncate">{m.statusReason}</span>
                            </div>
                          ) : (
                            <p className="hidden md:block text-[11px] text-slate-400 italic">Aucun motif spécifié</p>
                          )}
                        </div>

                        {/* ── Col 4 (md:col-span-3): Ticket Banner & Actions ── */}
                        <div className="md:col-span-3 flex items-center justify-between md:justify-end gap-2 shrink-0 border-t md:border-t-0 border-slate-100 pt-2 md:pt-0">
                          {workflow.stage === 'waiting_validation' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                showTabletToast(
                                  'En attente de validation',
                                  `Le ticket ${workflow.request?.refIR} est en attente du Responsable Technique.`
                                );
                              }}
                              className="h-8.5 px-3 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer truncate flex-1 md:flex-initial"
                            >
                              <Clock size={13} className="text-amber-800 shrink-0" />
                              <span className="truncate">Attente val. (1/3)</span>
                            </button>
                          )}

                          {workflow.stage === 'waiting_work_order' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                showTabletToast(
                                  'En attente création OT',
                                  `Le ticket ${workflow.request?.refIR} a été validé ! En attente création OT.`
                                );
                              }}
                              className="h-8.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer truncate flex-1 md:flex-initial"
                            >
                              <Clock size={13} className="text-slate-600 shrink-0" />
                              <span className="truncate">Attente OT (2/3)</span>
                            </button>
                          )}

                          {workflow.stage === 'waiting_3_validations' && (() => {
                            const validCount = [
                              workflow.order?.validationRespMaint?.validated,
                              workflow.order?.validationRespProd?.validated,
                              workflow.order?.validationQHSE?.validated,
                            ].filter(Boolean).length;
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTab('orders');
                                  showTabletToast(
                                    'Pré-validation OT',
                                    `OT ${workflow.order?.refOT} : ${validCount}/3 validations complétées.`
                                  );
                                }}
                                className="h-8.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-98 truncate flex-1 md:flex-initial"
                              >
                                <ShieldAlert size={13} className="shrink-0" />
                                <span className="truncate">Pré-val ({validCount}/3)</span>
                              </button>
                            );
                          })()}

                          {workflow.stage === 'ready_to_report' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTab('orders');
                              }}
                              className="h-8.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-98 truncate flex-1 md:flex-initial"
                            >
                              <CheckCircle2 size={13} className="shrink-0" />
                              <span className="truncate">Prêt rapport (3/3)</span>
                            </button>
                          )}

                          {workflow.stage === 'can_create_ticket' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMachineId(m.id);
                                setSelectedDIMachineIds((prev) =>
                                  prev.includes(m.id)
                                    ? prev.filter((id) => id !== m.id)
                                    : [...prev, m.id]
                                );
                                setActiveTab('send_di');
                                setDiSubView('create');
                              }}
                              className={`h-8.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-98 truncate flex-1 md:flex-initial ${isCheckedForDI
                                ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                : 'bg-slate-900 hover:bg-black text-white'
                                }`}
                            >
                              {isCheckedForDI ? <CheckSquare size={13} className="shrink-0" /> : <Send size={13} className="shrink-0" />}
                              <span className="truncate">{isCheckedForDI ? 'Sélectionné ✓' : '+ Ticket DI'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              generateFicheTechniquePdf(m);
                            }}
                            className="h-8.5 px-2.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border border-slate-300 transition-colors cursor-pointer shrink-0"
                            title="Télécharger la Fiche Technique (PDF)"
                          >
                            <Download size={13} />
                            <span>PDF</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Compact Machine Cards Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 animate-in fade-in">
                {filteredMachinesList.map((m) => {
                  const isSelected = selectedMachineId === m.id;

                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMachineId(m.id)}
                      className={`bg-white rounded-xl p-3 border transition-all cursor-pointer shadow-xs hover:border-slate-400 ${isSelected
                        ? 'border-slate-900 ring-2 ring-slate-900/10 shadow-sm'
                        : 'border-slate-300'
                        }`}
                    >
                      {/* ── Row 1: Machine identity + status badge ── */}
                      <div className="flex items-center gap-2.5">
                        <div className="w-11 h-11 bg-slate-900 text-white rounded-lg flex items-center justify-center font-mono font-bold text-sm tracking-wider shrink-0">
                          {m.number}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm text-slate-900 leading-tight truncate">
                            {m.name || `${m.brand} ${m.model}`}
                          </h3>
                          <p className="text-[11px] text-slate-400 font-mono truncate">
                            SN: {m.serialNumber || '—'}
                            {(m.clampingForce || m.clampingForceTons) && ` · ${m.clampingForce || m.clampingForceTons} T`}
                            {m.location && ` · ${m.location}`}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${m.status === 'Stopped' || m.status === 'down'
                            ? 'bg-red-50 text-red-900 border-red-300'
                            : 'bg-amber-50 text-amber-900 border-amber-300'
                            }`}
                        >
                          {m.status === 'Stopped' || m.status === 'down' ? 'ARRÊT' : 'MAINT'}
                        </span>
                      </div>

                      {/* ── Row 2: Mold + Product (single slim row) ── */}
                      <div className="mt-2 flex items-center gap-3 text-[11px] border-t border-slate-100 pt-2">
                        <span className="text-slate-400 font-bold uppercase tracking-wide shrink-0">Moule</span>
                        <span className="font-mono font-bold text-slate-800 truncate">{m.activeMoldRef || '—'}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-400 font-bold uppercase tracking-wide shrink-0">Pièce</span>
                        <span className="text-slate-700 truncate">{m.injectingProduct || '—'}</span>
                      </div>

                      {/* ── Active OF Row (if assigned) ── */}
                      {(() => {
                        const machineOF = syncedOFs.find(
                          (o) => (o.machineId === m.id || (o.machineName && o.machineName.includes(m.number)) || (m.ofReference && o.ofNumber === m.ofReference)) && o.status !== 'Done'
                        );
                        if (!machineOF) return null;
                        return (
                          <div className="mt-1 flex items-center justify-between text-[11px] bg-blue-50/70 border border-blue-200/80 rounded px-2 py-0.5">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wide shrink-0">OF</span>
                              <span className="font-mono font-bold text-blue-900 truncate">{machineOF.ofNumber}</span>
                            </div>
                            {machineOF.pdfUrl && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewPdfOF(machineOF);
                                }}
                                className="px-1.5 py-0.5 bg-red-100 hover:bg-red-200 text-red-800 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0 transition-colors ml-2"
                                title="Voir le PDF de l'OF"
                              >
                                <FileText size={10} className="text-red-600" />
                                <span>PDF</span>
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {/* ── Row 3: Status reason (if any) — single truncated line ── */}
                      {m.statusReason && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 truncate">
                          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                          <span className="truncate">{m.statusReason}</span>
                        </div>
                      )}

                      {/* ── Row 4: Workflow ticket banner — single line ── */}
                      {(() => {
                        const workflow = getMachineWorkflowState(m);
                        if (workflow.stage === 'waiting_validation') {
                          return (
                            <div className="mt-1.5 flex items-center justify-between gap-1 text-[11px] bg-amber-50 border border-amber-200 rounded px-2 py-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Clock size={12} className="text-amber-700 shrink-0" />
                                <span className="truncate text-amber-950">
                                  <strong>{workflow.request?.refIR}</strong> · En attente validation
                                </span>
                              </div>
                              <span className="text-[10px] font-mono font-bold bg-amber-200 text-amber-950 px-1.5 py-0.5 rounded shrink-0">1/3</span>
                            </div>
                          );
                        }
                        if (workflow.stage === 'waiting_work_order') {
                          return (
                            <div className="mt-1.5 flex items-center justify-between gap-1 text-[11px] bg-slate-100 border border-slate-200 rounded px-2 py-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <CheckCircle2 size={12} className="text-slate-600 shrink-0" />
                                <span className="truncate text-slate-800">
                                  <strong>{workflow.request?.refIR}</strong> · Validé · Attente OT
                                </span>
                              </div>
                              <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-900 px-1.5 py-0.5 rounded shrink-0">2/3</span>
                            </div>
                          );
                        }
                        if (workflow.stage === 'waiting_3_validations') {
                          const validCount = [
                            workflow.order?.validationRespMaint?.validated,
                            workflow.order?.validationRespProd?.validated,
                            workflow.order?.validationQHSE?.validated,
                          ].filter(Boolean).length;
                          return (
                            <div className="mt-1.5 flex items-center justify-between gap-1 text-[11px] bg-amber-50 border border-amber-200 rounded px-2 py-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <ShieldAlert size={12} className="text-amber-700 shrink-0" />
                                <span className="truncate text-amber-950">
                                  <strong>{workflow.order?.refOT}</strong> · Pré-validation ({validCount}/3)
                                </span>
                              </div>
                              <span className="text-[10px] font-mono font-bold bg-amber-200 text-amber-950 px-1.5 py-0.5 rounded shrink-0">OT</span>
                            </div>
                          );
                        }
                        if (workflow.stage === 'ready_to_report') {
                          return (
                            <div className="mt-1.5 flex items-center justify-between gap-1 text-[11px] bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <CheckCircle2 size={12} className="text-emerald-700 shrink-0" />
                                <span className="truncate text-emerald-950 font-bold">
                                  {workflow.order?.refOT} · 3/3 Validé · Prêt rapport
                                </span>
                              </div>
                              <span className="text-[10px] font-mono font-bold bg-emerald-200 text-emerald-950 px-1.5 py-0.5 rounded shrink-0">OK</span>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* ── Row 5: Action buttons — single row h-9 ── */}
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                        {(() => {
                          const workflow = getMachineWorkflowState(m);

                          if (workflow.stage === 'waiting_validation') {
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showTabletToast(
                                    'En attente de validation',
                                    `Le ticket ${workflow.request?.refIR} est en attente du Responsable Technique.`
                                  );
                                }}
                                className="h-9 flex-1 px-3 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer truncate"
                              >
                                <Clock size={13} className="text-amber-800 shrink-0" />
                                <span className="truncate">En attente de validation</span>
                              </button>
                            );
                          }

                          if (workflow.stage === 'waiting_work_order') {
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showTabletToast(
                                    'En attente création OT',
                                    `Le ticket ${workflow.request?.refIR} a été validé ! En attente création OT.`
                                  );
                                }}
                                className="h-9 flex-1 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer truncate"
                              >
                                <Clock size={13} className="text-slate-600 shrink-0" />
                                <span className="truncate">Attente création OT</span>
                              </button>
                            );
                          }

                          if (workflow.stage === 'waiting_3_validations') {
                            const validCount = [
                              workflow.order?.validationRespMaint?.validated,
                              workflow.order?.validationRespProd?.validated,
                              workflow.order?.validationQHSE?.validated,
                            ].filter(Boolean).length;
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTab('orders');
                                  showTabletToast(
                                    'Pré-validation OT',
                                    `OT ${workflow.order?.refOT} : ${validCount}/3 validations complétées.`
                                  );
                                }}
                                className="h-9 flex-1 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-98 truncate"
                              >
                                <ShieldAlert size={13} className="shrink-0" />
                                <span className="truncate">Pré-validation ({validCount}/3)</span>
                              </button>
                            );
                          }

                          // Default: can create new ticket — multi-machine selection
                          const isCheckedForDI = selectedDIMachineIds.includes(m.id);
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMachineId(m.id);
                                setSelectedDIMachineIds((prev) =>
                                  prev.includes(m.id)
                                    ? prev.filter((id) => id !== m.id)
                                    : [...prev, m.id]
                                );
                                setActiveTab('send_di');
                                setDiSubView('create');
                              }}
                              className={`h-9 flex-1 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-98 truncate ${isCheckedForDI
                                ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                : 'bg-slate-900 hover:bg-black text-white'
                                }`}
                            >
                              {isCheckedForDI ? <CheckSquare size={13} className="shrink-0" /> : <Send size={13} className="shrink-0" />}
                              <span className="truncate">{isCheckedForDI ? 'Sélectionné ✓' : '+ Nouveau Ticket DI'}</span>
                            </button>
                          );
                        })()}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            generateFicheTechniquePdf(m);
                          }}
                          className="h-9 px-3 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-300 transition-colors cursor-pointer shrink-0"
                          title="Télécharger la Fiche Technique (PDF)"
                        >
                          <Download size={13} />
                          <span>PDF</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ORDRES DE TRAVAIL & SUIVI DES 3 VALIDATIONS                         */}
        {/* ========================================================================= */}
        {activeTab === 'orders' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Header info */}
            <div className="bg-white rounded-xl p-5 border border-slate-300 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-base sm:text-lg text-slate-900 mt-0.5">
                  Ordres de Travail Actifs ({activeOrders.length})
                </h3>
              </div>
              <button
                onClick={() => {
                  setPrefilledDescription('');
                  setActiveTab('send_di');
                  setDiSubView('create');
                }}
                className="min-h-[44px] px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors flex items-center justify-center gap-2 self-start sm:self-auto shrink-0"
              >
                <Plus size={16} />
                <span>Nouvelle Demande (DI)</span>
              </button>
            </div>

            {/* List of Active Orders with 3-Validation Badges */}
            <div className="space-y-3.5">
              {activeOrders.length === 0 ? (
                <div className="bg-white rounded-xl p-8 border border-slate-300 text-center space-y-3 shadow-xs">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg flex items-center justify-center mx-auto">
                    <CheckCircle2 size={28} />
                  </div>
                  <h4 className="font-bold text-base text-slate-900">Aucun Ordre de Travail en Cours</h4>
                </div>
              ) : (
                activeOrders.map((ord) => {
                  const is3Val = checkIs3Validated(ord);
                  const hasReport = Boolean(ord.reportRef || ord.status === 'Waiting work validation' || ord.status === 'Completed');

                  return (
                    <div
                      key={ord.id}
                      className="bg-white rounded-xl p-5 border border-slate-300 transition-all shadow-xs space-y-3.5"
                    >
                      {/* Top Row: Ref & Status */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-slate-900 text-base">{ord.refOT}</span>
                            <span
                              className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${ord.priority === 'Urgent'
                                ? 'bg-red-50 text-red-900 border-red-300'
                                : ord.priority === 'High'
                                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                                  : 'bg-slate-100 text-slate-800 border-slate-300'
                                }`}
                            >
                              Priorité : {ord.priority}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm mt-1">{ord.equipmentName}</h4>
                        </div>

                        <span
                          className={`px-3 py-1 rounded text-xs font-mono font-bold border self-start sm:self-auto ${hasReport
                            ? 'bg-slate-100 text-slate-900 border-slate-300'
                            : is3Val
                              ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                              : 'bg-amber-50 text-amber-950 border-amber-300'
                            }`}
                        >
                          {hasReport ? 'Rapport Transmis' : is3Val ? '3/3 Validé (Prêt)' : ord.status}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">{ord.description}</p>

                      {/* ── 3-STEP PRE-VALIDATIONS STEPPER (Visual Inspection) ── */}
                      <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                          <span>Workflow de Pré-Validation (3 Responsables) :</span>
                          <span className={`font-mono text-xs ${is3Val ? 'text-emerald-700' : 'text-amber-800'}`}>
                            {is3Val ? '✓ 3/3 Validations Approuvées' : '⏳ En Attente de Signature'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {/* Step 1: Resp Maint */}
                          <div
                            className={`p-2.5 rounded-lg border text-center font-bold transition-all ${ord.validationRespMaint?.validated
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                              : 'bg-white border-slate-300 text-slate-600'
                              }`}
                          >
                            <div className="font-bold text-xs">1. Resp. Maint</div>
                            <span className="block mt-0.5 text-[11px] font-mono">
                              {ord.validationRespMaint?.validated ? '✓ Validé' : 'En attente'}
                            </span>
                          </div>

                          {/* Step 2: Resp Prod */}
                          <div
                            className={`p-2.5 rounded-lg border text-center font-bold transition-all ${ord.validationRespProd?.validated
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                              : 'bg-white border-slate-300 text-slate-600'
                              }`}
                          >
                            <div className="font-bold text-xs">2. Resp. Prod</div>
                            <span className="block mt-0.5 text-[11px] font-mono">
                              {ord.validationRespProd?.validated ? '✓ Validé' : 'En attente'}
                            </span>
                          </div>

                          {/* Step 3: Resp QHSE */}
                          <div
                            className={`p-2.5 rounded-lg border text-center font-bold transition-all ${ord.validationQHSE?.validated
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                              : 'bg-white border-slate-300 text-slate-600'
                              }`}
                          >
                            <div className="font-bold text-xs">3. QHSE</div>
                            <span className="block mt-0.5 text-[11px] font-mono">
                              {ord.validationQHSE?.validated ? '✓ Validé' : 'En attente'}
                            </span>
                          </div>
                        </div>

                        {/* Quick validation simulation helper for testing */}
                        {!is3Val && (
                          <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 border-t border-slate-200">
                            <span className="text-[11px] font-medium">Action superviseur atelier :</span>
                            <div className="flex flex-wrap gap-1.5">
                              {!ord.validationRespMaint?.validated && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickPreValidate(ord, 1)}
                                  className="min-h-[38px] px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-md font-bold text-xs transition-colors cursor-pointer"
                                >
                                  + Valider Maint
                                </button>
                              )}
                              {!ord.validationRespProd?.validated && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickPreValidate(ord, 2)}
                                  className="min-h-[38px] px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-md font-bold text-xs transition-colors cursor-pointer"
                                >
                                  + Valider Prod
                                </button>
                              )}
                              {!ord.validationQHSE?.validated && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickPreValidate(ord, 3)}
                                  className="min-h-[38px] px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-md font-bold text-xs transition-colors cursor-pointer"
                                >
                                  + Valider QHSE
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Bottom Action: Fill report button or locked state */}
                      <div>
                        {hasReport ? (
                          <div className="min-h-[46px] p-3 bg-slate-100 text-slate-800 rounded-lg text-xs font-semibold flex items-center justify-between border border-slate-200">
                            <span>Rapport d'intervention déjà enregistré ({ord.reportRef})</span>
                            <CheckCircle2 size={16} className="text-emerald-700" />
                          </div>
                        ) : is3Val ? (
                          /* ── Bouton Remplir Rapport masqué (Décommenter pour réactiver) ──
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrderForReportId(ord.id);
                              setActiveTab('fill_report');
                            }}
                            className="min-h-[48px] w-full py-3.5 px-4 bg-slate-900 hover:bg-black text-white font-bold rounded-lg text-sm shadow-xs transition-colors flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
                          >
                            <FileText size={18} />
                            <span>Remplir le Rapport d'Intervention</span>
                          </button>
                          ── Fin bouton Rapport ── */
                          <div className="min-h-[46px] p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2">
                            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                            <span>3/3 Validations complètes. Rapport activable par le bureau.</span>
                          </div>
                        ) : (
                          <div className="min-h-[48px] flex items-center justify-between p-3.5 bg-slate-100 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200">
                            <span className="flex items-center gap-2">
                              <Lock size={15} className="text-slate-500 shrink-0" />
                              <span>Rapport verrouillé : En attente des 3 pré-validations requises</span>
                            </span>
                            <span className="text-[10px] font-mono uppercase bg-slate-200 text-slate-800 px-2.5 py-1 rounded font-bold shrink-0">
                              Verrouillé
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: DEMANDES D'INTERVENTION (DI)                                      */}
        {/* ========================================================================= */}
        {activeTab === 'send_di' && (
          <div className="space-y-5 animate-in fade-in">
            {/* ── SUB-VIEW 1: TABLE LIST INTERFACE ── */}
            {diSubView === 'list' && (
              <div className="space-y-5">
                {/* Notice banner if recently created */}
                {diCreatedNotices.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center shrink-0 border border-emerald-200">
                        <CheckCircle2 size={22} />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-emerald-950">
                          {diCreatedNotices.length === 1
                            ? `Demande d'Intervention ${diCreatedNotices[0].refIR} enregistrée avec succès !`
                            : `${diCreatedNotices.length} demandes créées avec succès !`}
                        </h4>
                        <p className="text-[11px] text-emerald-800 font-mono mt-0.5">
                          {diCreatedNotices.map((d) => d.refIR).join(' · ')} — Statut : <strong className="text-emerald-950">En attente</strong> de validation Responsable Technique
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setDiCreatedNotices([]);
                          setDiSubView('create');
                        }}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                      >
                        + Créer une autre
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiCreatedNotices([])}
                        className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        Fermer
                      </button>
                    </div>
                  </div>
                )}

                {/* Top Action Header */}
                <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
                      <Send size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                          Demandes d'Intervention (DI)
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {requests.length} total
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium">
                        Registre officiel des demandes de maintenance émises depuis l'atelier
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setDiCreatedNotices([]);
                      setDiSubView('create');
                    }}
                    className="min-h-[46px] px-5 py-2.5 bg-slate-900 hover:bg-black text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer shrink-0"
                  >
                    <Plus size={18} />
                    <span>+ Nouvelle Demande d'Intervention</span>
                  </button>
                </div>

                {/* KPI Metrics Quick-Filter Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDiStatusFilter('all');
                      setDiPage(1);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      diStatusFilter === 'all'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                    }`}
                  >
                    <div className="text-[10px] font-extrabold uppercase tracking-wider opacity-75">Toutes les DI</div>
                    <div className="text-xl font-mono font-black mt-0.5">{requests.length}</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDiStatusFilter('Waiting');
                      setDiPage(1);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      diStatusFilter === 'Waiting'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-amber-950 border-amber-300'
                    }`}
                  >
                    <div className="text-[10px] font-extrabold uppercase tracking-wider opacity-85">En attente Resp. Tech</div>
                    <div className="text-xl font-mono font-black mt-0.5 text-amber-800">
                      {requests.filter((r) => r.status === 'Waiting').length}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDiStatusFilter('Validated');
                      setDiPage(1);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      diStatusFilter === 'Validated'
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-emerald-950 border-emerald-300'
                    }`}
                  >
                    <div className="text-[10px] font-extrabold uppercase tracking-wider opacity-85">Validées (En OT)</div>
                    <div className="text-xl font-mono font-black mt-0.5 text-emerald-800">
                      {requests.filter((r) => r.status === 'Validated').length}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDiStatusFilter('Rejected');
                      setDiPage(1);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      diStatusFilter === 'Rejected'
                        ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-rose-950 border-rose-300'
                    }`}
                  >
                    <div className="text-[10px] font-extrabold uppercase tracking-wider opacity-85">Rejetées</div>
                    <div className="text-xl font-mono font-black mt-0.5 text-rose-800">
                      {requests.filter((r) => r.status === 'Rejected').length}
                    </div>
                  </button>
                </div>

                {/* Search & Filter Toolbar */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-300 shadow-xs flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Rechercher par Réf DI, équipement, demandeur, anomalie..."
                      value={diSearchQuery}
                      onChange={(e) => {
                        setDiSearchQuery(e.target.value);
                        setDiPage(1);
                      }}
                      className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-slate-800 focus:bg-white"
                    />
                    {diSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setDiSearchQuery('');
                          setDiPage(1);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 font-mono shrink-0">
                    {filteredDiRequests.length} demande(s) affichée(s)
                  </div>
                </div>

                {/* THE TABLE */}
                <div className="bg-white rounded-xl border border-slate-300 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[760px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                          <th className="py-3.5 px-4">Réf. DI</th>
                          <th className="py-3.5 px-4">Date</th>
                          <th className="py-3.5 px-4">Équipement / Machine</th>
                          <th className="py-3.5 px-4">Demandeur</th>
                          <th className="py-3.5 px-4">Priorité</th>
                          <th className="py-3.5 px-4">Description Panne</th>
                          <th className="py-3.5 px-4">Statut</th>
                          <th className="py-3.5 px-4 text-right">Détails</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {paginatedDiRequests.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-14 text-center text-slate-400">
                              <div className="flex flex-col items-center justify-center gap-2.5">
                                <ClipboardList size={34} className="text-slate-300" />
                                <span className="font-bold text-slate-800 text-sm">
                                  Aucune demande d'intervention trouvée
                                </span>
                                <span className="text-xs text-slate-500 max-w-sm">
                                  {diSearchQuery || diStatusFilter !== 'all'
                                    ? "Aucun enregistrement ne correspond aux filtres appliqués."
                                    : "Aucune demande d'intervention n'a été saisie sur cette tablette pour le moment."}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDiCreatedNotices([]);
                                    setDiSubView('create');
                                  }}
                                  className="mt-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-black transition-colors cursor-pointer shadow-xs"
                                >
                                  + Créer une demande maintenant
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          paginatedDiRequests.map((req) => (
                            <tr
                              key={req.id}
                              onClick={() => setDiSelectedDetail(req)}
                              className="hover:bg-slate-50/90 transition-colors cursor-pointer group"
                            >
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className="font-mono font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded text-xs">
                                  {req.refIR}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                                {req.date}
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900">{req.equipmentName || 'Non spécifié'}</span>
                                  {req.category && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                                      {req.category}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="font-semibold text-slate-800">{req.requester}</div>
                                {req.requesterRole && (
                                  <div className="text-[10px] text-slate-500">{req.requesterRole}</div>
                                )}
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                {req.priority === 'Urgent' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200 inline-flex items-center gap-1">
                                    <AlertTriangle size={11} /> Urgent
                                  </span>
                                ) : req.priority === 'High' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 inline-flex items-center gap-1">
                                    Élevée
                                  </span>
                                ) : req.priority === 'Medium' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200 inline-flex items-center gap-1">
                                    Normale
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 inline-flex items-center gap-1">
                                    Faible
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 max-w-[260px]">
                                <p className="text-slate-700 truncate font-medium text-xs">
                                  {req.problemDescription}
                                </p>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                {req.status === 'Waiting' ? (
                                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300 inline-flex items-center gap-1.5">
                                    <Clock size={12} className="text-amber-700" />
                                    <span>En attente</span>
                                  </span>
                                ) : req.status === 'Validated' ? (
                                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-300 inline-flex items-center gap-1.5">
                                    <CheckCircle2 size={12} className="text-emerald-700" />
                                    <span>Validée</span>
                                  </span>
                                ) : req.status === 'Rejected' ? (
                                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-900 border border-rose-300 inline-flex items-center gap-1.5">
                                    <XCircle size={12} className="text-rose-700" />
                                    <span>Rejetée</span>
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 inline-flex items-center gap-1.5">
                                    {req.status}
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDiSelectedDetail(req);
                                  }}
                                  className="px-2.5 py-1 text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold border border-slate-200 inline-flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Eye size={12} />
                                  <span>Détails</span>
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer with Pagination */}
                  {filteredDiRequests.length > DI_ITEMS_PER_PAGE && (
                    <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                      <div>
                        Page {diPage} sur {Math.ceil(filteredDiRequests.length / DI_ITEMS_PER_PAGE)} ({filteredDiRequests.length} demandes)
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={diPage <= 1}
                          onClick={() => setDiPage((p) => Math.max(1, p - 1))}
                          className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Précédent
                        </button>
                        <button
                          type="button"
                          disabled={diPage * DI_ITEMS_PER_PAGE >= filteredDiRequests.length}
                          onClick={() => setDiPage((p) => p + 1)}
                          className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Suivant
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── SUB-VIEW 2: DEDICATED NEW INTERVENTION REQUEST FORM INTERFACE ── */}
            {diSubView === 'create' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                {/* Header with Back button */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-300 shadow-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPrefilledDescription('');
                        setSelectedDIMachineIds([]);
                        setDiCreatedNotices([]);
                        setDiSubView('list');
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition-colors cursor-pointer border border-slate-300 shadow-2xs"
                    >
                      <ArrowLeft size={16} />
                      <span>Retour à la liste des demandes</span>
                    </button>

                    <div>
                      <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
                        Nouvelle Demande d'Intervention (DI)
                      </h2>
                      <p className="text-xs text-slate-500 font-medium">
                        Renseignez l'équipement et décrivez le problème constaté pour transmission à la maintenance
                      </p>
                    </div>
                  </div>

                  <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-50 text-amber-900 border border-amber-300">
                    Saisie Dédiée
                  </span>
                </div>

                {/* Clean Multi-Machine DI Form */}
                <MultiMachineDIForm
                  machines={machines}
                  molds={molds}
                  selectedDIMachineIds={selectedDIMachineIds}
                  setSelectedDIMachineIds={setSelectedDIMachineIds}
                  prefilledDescription={prefilledDescription}
                  setPrefilledDescription={setPrefilledDescription}
                  getMachineWorkflowState={getMachineWorkflowState}
                  existingRequests={requests}
                  currentUser={currentUser}
                  onSubmit={(payload) => {
                    handleSubmitDIBatch(payload);
                  }}
                  onCancel={() => {
                    setPrefilledDescription('');
                    setSelectedDIMachineIds([]);
                    setDiCreatedNotices([]);
                    setDiSubView('list');
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: RAPPORT D'INTERVENTION TECHNIQUE (PV)                              */}
        {/* ========================================================================= */}
        {activeTab === 'fill_report' && (
          <div className="space-y-4 animate-in fade-in">
            {reportSuccessSubmitted ? (
              <div className="bg-white rounded-2xl p-6 sm:p-8 border border-emerald-300 shadow-md text-center space-y-6">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 size={36} className="stroke-[2.5]" />
                </div>
                <div className="space-y-2">
                  <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-mono font-bold rounded-full">
                    {reportSuccessSubmitted.refReport}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                    Rapport d'Intervention Transmis avec Succès !
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                    Le rapport pour l'ordre <strong className="text-slate-900">{reportSuccessSubmitted.refOT}</strong> a bien été enregistré. L'ordre de travail est passé à l'état <strong className="text-emerald-700">« En attente validation travail »</strong>.
                  </p>
                </div>

                {reportSuccessSubmitted.stockTaken && reportSuccessSubmitted.stockTaken.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-w-md mx-auto text-left space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span>Bon de Livraison (BL) Automatique</span>
                      <span className="font-mono text-emerald-600">BL-{reportSuccessSubmitted.refReport}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Sortie de stock enregistrée pour {reportSuccessSubmitted.stockTaken.length} article(s).
                    </p>
                    <div className="space-y-1 pt-1">
                      {reportSuccessSubmitted.stockTaken.map((st, i) => (
                        <div key={i} className="flex justify-between text-xs text-slate-700 font-mono">
                          <span>{st.partNumber} - {st.itemName}</span>
                          <span className="font-bold">x{st.qty}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReportSuccessSubmitted(null);
                      setActiveTab('orders');
                    }}
                    className="min-h-[48px] w-full sm:w-auto px-6 bg-slate-900 hover:bg-black text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
                  >
                    <ClipboardList size={18} />
                    <span>Consulter les Ordres (OT)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReportSuccessSubmitted(null);
                      setActiveTab('machines');
                      setMachineSubView('overview');
                    }}
                    className="min-h-[48px] w-full sm:w-auto px-6 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition-colors"
                  >
                    <Wrench size={18} />
                    <span>Voir le Parc Machines</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportSuccessSubmitted(null)}
                    className="min-h-[48px] w-full sm:w-auto px-5 text-slate-500 hover:text-slate-800 text-xs font-semibold cursor-pointer underline"
                  >
                    Remplir un autre rapport
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* ── PREVALIDATED ORDERS TABLE (shown when no order selected) ── */}
                {!targetReportOrder ? (
                  <div className="space-y-4 animate-in fade-in">
                    {/* Header */}
                    <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-300 shadow-xs space-y-4">
                      <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                        <div className="w-12 h-12 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold shadow-xs">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                            Ordres en Attente de Rapport
                          </h3>
                        </div>
                      </div>

                      {/* Filters */}
                      <div className="flex flex-wrap gap-2 items-center">
                        <input
                          type="search"
                          placeholder="Search"
                          value={reportTableSearch}
                          onChange={(e) => setReportTableSearch(e.target.value)}
                          className="flex-1 min-w-[160px] min-h-[40px] px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                        />
                        {(['all', 'Machine', 'Mold', 'Other'] as const).map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setReportTableFilterCat(cat)}
                            className={`min-h-[36px] px-3 rounded-lg text-xs font-bold border cursor-pointer transition-colors ${reportTableFilterCat === cat
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                          >
                            {cat === 'all' ? 'Tous' : cat === 'Mold' ? 'Moules' : cat === 'Machine' ? 'Machines' : 'Autres'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Orders list */}
                    {(() => {
                      const filtered = prevalidatedOrders.filter((o) => {
                        const matchCat =
                          reportTableFilterCat === 'all' ||
                          (reportTableFilterCat === 'Machine' && (o.category === 'Machine' || Boolean(o.machineId))) ||
                          (reportTableFilterCat === 'Mold' && (o.category === 'Mold' || Boolean(o.moldId) || Boolean(o.moldRef))) ||
                          (reportTableFilterCat === 'Other' && o.category !== 'Machine' && o.category !== 'Mold' && !o.machineId && !o.moldId && !o.moldRef);
                        const q = reportTableSearch.toLowerCase();
                        const matchSearch =
                          !q ||
                          o.refOT?.toLowerCase().includes(q) ||
                          o.equipmentName?.toLowerCase().includes(q) ||
                          o.description?.toLowerCase().includes(q);
                        return matchCat && matchSearch;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="bg-white rounded-xl border border-slate-300 p-10 text-center space-y-3">
                            <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center mx-auto border border-slate-200">
                              <ClipboardList className="w-7 h-7 text-slate-400" />
                            </div>
                            <p className="font-bold text-slate-800 text-sm">Aucun ordre en attente</p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2">
                          {filtered.map((o) => {
                            const isMach = o.category === 'Machine' || Boolean(o.machineId);
                            const isMoldO = o.category === 'Mold' || Boolean(o.moldId) || Boolean(o.moldRef);
                            const typeLabel = isMach ? 'Machine' : isMoldO ? 'Moule' : 'Autre';
                            const typeColor = isMach
                              ? 'bg-blue-50 text-blue-900 border-blue-300'
                              : isMoldO
                                ? 'bg-violet-50 text-violet-900 border-violet-300'
                                : 'bg-teal-50 text-teal-900 border-teal-300';
                            const createdAt = o.createdAt
                              ? new Date(o.createdAt).toLocaleDateString('fr-FR')
                              : '—';
                            return (
                              <button
                                key={o.id}
                                type="button"
                                onClick={() => {
                                  setSelectedOrderForReportId(o.id);
                                }}
                                className="w-full min-h-[72px] bg-white border border-slate-300 hover:border-slate-900 hover:shadow-sm rounded-xl p-4 flex items-center justify-between gap-3 text-left cursor-pointer transition-all group"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-slate-900 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                                    <FileText className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono font-black text-slate-900 text-sm">{o.refOT}</span>
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${typeColor}`}>
                                        {typeLabel}
                                      </span>
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-300">
                                        ✓ 3/3 Validé
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-700 font-semibold truncate mt-0.5">{o.equipmentName}</p>
                                    <p className="text-[11px] text-slate-500 truncate">{o.description}</p>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                                  <span className="text-[11px] text-slate-500 font-mono">{createdAt}</span>
                                  <span className="text-[11px] font-bold text-slate-700 group-hover:text-slate-900">
                                    Ouvrir →
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <>
                    {/* Back to list button */}
                    <button
                      type="button"
                      onClick={() => setSelectedOrderForReportId('')}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
                    >
                      <ChevronLeft size={16} />
                      <span>Retour à la liste des OT</span>
                    </button>

                    {/* Header info */}
                    <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-300 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold shadow-xs">
                            <FileText className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                              Rapport d'Intervention Technique (PV)
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">
                              Étape 11 du cycle GMAO · Accessible uniquement après les 3 pré-validations requises
                            </p>
                          </div>
                        </div>
                        <span className="font-mono text-xs font-black text-slate-700 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                          {targetReportOrder.refOT}
                        </span>
                      </div>

                      {/* 3-Validation Status Bar */}
                      {targetReportOrder && (
                        <div
                          className={`p-4 rounded-lg border space-y-2.5 ${isTargetOrder3Validated
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                            : 'bg-amber-50 border-amber-300 text-amber-950'
                            }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="flex items-center gap-2">
                              {isTargetOrder3Validated ? (
                                <>
                                  <CheckCircle2 size={18} className="text-emerald-700" />
                                  <span>Autorisation Accordée : 3/3 Pré-validations Complètes</span>
                                </>
                              ) : (
                                <>
                                  <Lock size={18} className="text-amber-800" />
                                  <span>Rapport Verrouillé : 3 Pré-validations Manquantes</span>
                                </>
                              )}
                            </span>
                            <span className="font-mono text-xs uppercase font-bold">
                              {targetReportOrder.refOT}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs font-bold text-center">
                            <div
                              className={`p-2 rounded border ${targetReportOrder.validationRespMaint?.validated
                                ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                                : 'bg-white border-slate-300 text-slate-500'
                                }`}
                            >
                              {targetReportOrder.validationRespMaint?.validated ? '✓ Resp. Maint' : '⏳ Resp. Maint'}
                            </div>
                            <div
                              className={`p-2 rounded border ${targetReportOrder.validationRespProd?.validated
                                ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                                : 'bg-white border-slate-300 text-slate-500'
                                }`}
                            >
                              {targetReportOrder.validationRespProd?.validated ? '✓ Resp. Prod' : '⏳ Resp. Prod'}
                            </div>
                            <div
                              className={`p-2 rounded border ${targetReportOrder.validationQHSE?.validated
                                ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                                : 'bg-white border-slate-300 text-slate-500'
                                }`}
                            >
                              {targetReportOrder.validationQHSE?.validated ? '✓ QHSE' : '⏳ QHSE'}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Draft auto-save status bar */}
                      {isTargetOrder3Validated && targetReportOrder && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 animate-in fade-in">
                          <div className="flex items-center gap-2.5">
                            <Database size={16} className="text-slate-600 shrink-0" />
                            <div>
                              <p className="font-bold text-slate-900">
                                {lastDraftSavedTime
                                  ? `Brouillon auto-enregistré à ${lastDraftSavedTime}`
                                  : 'Sauvegarde automatique active'}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {isOnline
                                  ? 'Enregistrement direct en mémoire locale tablette'
                                  : 'Mode Hors-Ligne : Données protégées localement'}
                              </p>
                            </div>
                          </div>
                          {hasReportDraft(targetReportOrder.id) && (
                            <button
                              type="button"
                              onClick={handleResetDraft}
                              className="text-xs text-red-700 hover:text-red-900 font-bold underline cursor-pointer self-start sm:self-auto"
                            >
                              Réinitialiser brouillon
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ── CONDITIONAL RENDER: LOCKED OR UNLOCKED FORM ── */}
                    {!isTargetOrder3Validated ? (
                      <div className="p-8 bg-white rounded-xl border border-slate-300 shadow-xs text-center space-y-4 animate-in fade-in">
                        <div className="w-16 h-16 bg-amber-50 text-amber-800 border border-amber-300 rounded-xl flex items-center justify-center mx-auto shadow-2xs">
                          <Lock className="w-8 h-8" />
                        </div>

                        <div className="space-y-1.5">
                          <h4 className="font-bold text-slate-900 text-lg">
                            Rapport d'Intervention Verrouillé
                          </h4>
                        </div>

                        {/* Detailed Missing Validations Checklist */}
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 max-w-md mx-auto text-left text-xs space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">1. Responsable Maintenance :</span>
                            <span
                              className={`font-mono font-bold text-xs ${targetReportOrder?.validationRespMaint?.validated ? 'text-emerald-700' : 'text-amber-800'
                                }`}
                            >
                              {targetReportOrder?.validationRespMaint?.validated ? '✓ Validé' : '⏳ En attente'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">2. Responsable Production :</span>
                            <span
                              className={`font-mono font-bold text-xs ${targetReportOrder?.validationRespProd?.validated ? 'text-emerald-700' : 'text-amber-800'
                                }`}
                            >
                              {targetReportOrder?.validationRespProd?.validated ? '✓ Validé' : '⏳ En attente'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">3. Responsable Sécurité / QHSE :</span>
                            <span
                              className={`font-mono font-bold text-xs ${targetReportOrder?.validationQHSE?.validated ? 'text-emerald-700' : 'text-amber-800'
                                }`}
                            >
                              {targetReportOrder?.validationQHSE?.validated ? '✓ Validé' : '⏳ En attente'}
                            </span>
                          </div>
                        </div>

                        {/* Supervisor quick unlock helper for testing */}
                        {targetReportOrder && (
                          <div className="pt-2 max-w-md mx-auto space-y-2">
                            <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">
                              Action superviseur atelier pour déblocage test :
                            </span>
                            <div className="flex flex-wrap gap-2 justify-center">
                              {!targetReportOrder.validationRespMaint?.validated && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickPreValidate(targetReportOrder, 1)}
                                  className="min-h-[44px] px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                                >
                                  + Valider Étape 1 (Maint)
                                </button>
                              )}
                              {!targetReportOrder.validationRespProd?.validated && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickPreValidate(targetReportOrder, 2)}
                                  className="min-h-[44px] px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                                >
                                  + Valider Étape 2 (Prod)
                                </button>
                              )}
                              {!targetReportOrder.validationQHSE?.validated && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickPreValidate(targetReportOrder, 3)}
                                  className="min-h-[44px] px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                                >
                                  + Valider Étape 3 (QHSE)
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* UNLOCKED FULL INTERVENTION REPORT FORM */
                      <form onSubmit={handleSubmitReport} className="space-y-4 text-xs animate-in fade-in">
                        {/* 1. General Info & Times */}
                        <div className="bg-white rounded-xl p-5 border border-slate-300 shadow-xs space-y-3.5">
                          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
                            1. Intervenant &amp; Horaires d'Intervention
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                            <div>
                              <label className="font-bold text-slate-800 block mb-1 text-xs">Date d'Intervention :</label>
                              <input
                                type="date"
                                value={reportDate}
                                onChange={(e) => setReportDate(e.target.value)}
                                className="w-full min-h-[48px] px-3.5 bg-white border border-slate-300 rounded-lg font-semibold text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                              />
                            </div>
                            <div>
                              <label className="font-bold text-slate-800 block mb-1 text-xs">Nom du Technicien * :</label>
                              <input
                                type="text"
                                required
                                value={reportTechName}
                                onChange={(e) => setReportTechName(e.target.value)}
                                className="w-full min-h-[48px] px-3.5 bg-white border border-slate-300 rounded-lg font-bold text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                              />
                            </div>
                            <div>
                              <label className="font-bold text-slate-800 block mb-1 text-xs">Durée Intervention (Minutes) :</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  value={reportDurationMinutes}
                                  onChange={(e) => setReportDurationMinutes(parseInt(e.target.value) || 0)}
                                  className="flex-1 min-h-[48px] px-3 bg-white border border-slate-300 rounded-lg font-mono font-bold text-sm text-center text-slate-900 focus:outline-none focus:border-slate-900"
                                />
                                <button
                                  type="button"
                                  onClick={() => setReportDurationMinutes((m) => Math.max(15, m - 15))}
                                  className="min-h-[48px] min-w-[50px] px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-300 rounded-lg text-sm cursor-pointer"
                                >
                                  -15
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setReportDurationMinutes((m) => m + 15)}
                                  className="min-h-[48px] min-w-[50px] px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-300 rounded-lg text-sm cursor-pointer"
                                >
                                  +15
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3.5">
                            <div>
                              <label className="font-bold text-slate-700 block mb-1 text-xs">Heure de Début :</label>
                              <input
                                type="time"
                                value={reportStartTime}
                                onChange={(e) => setReportStartTime(e.target.value)}
                                className="w-full min-h-[48px] px-3 bg-white border border-slate-300 rounded-lg font-mono text-center font-bold text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                              />
                            </div>
                            <div>
                              <label className="font-bold text-slate-700 block mb-1 text-xs">Heure de Fin :</label>
                              <input
                                type="time"
                                value={reportEndTime}
                                onChange={(e) => setReportEndTime(e.target.value)}
                                className="w-full min-h-[48px] px-3 bg-white border border-slate-300 rounded-lg font-mono text-center font-bold text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 1B. Machine Meter Reading (Optional for Machine work orders) */}
                        {isTargetOrderMachine && (
                          <div className="bg-blue-50/80 rounded-xl p-5 border-2 border-blue-300 shadow-xs space-y-3.5 animate-in fade-in">
                            <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-blue-700" />
                                <h4 className="font-bold text-blue-950 text-xs uppercase tracking-wider">
                                  Relevé Horamètre Machine (Optionnel)
                                </h4>
                              </div>
                              <span className="font-mono text-xs font-bold text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded border border-blue-300">
                                {targetReportMachine?.number || targetReportOrder?.equipmentName || 'Presse'}
                              </span>
                            </div>

                            <div className="bg-white p-3 rounded-lg border border-blue-200 text-xs space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-slate-600 font-medium">Dernier index enregistré :</span>
                                <span className="font-mono font-black text-slate-900 text-sm">
                                  {lastMachineHours.toLocaleString()} h
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-[11px] text-slate-500">
                                <span>Dernier relevé le :</span>
                                <span>
                                  {targetReportMachine?.lastMeterReadingDate
                                    ? new Date(targetReportMachine.lastMeterReadingDate).toLocaleDateString('fr-FR')
                                    : 'Non renseigné'}{' '}
                                  · {targetReportMachine?.lastMeterReadingBy || 'Opérateur'}
                                </span>
                              </div>
                            </div>

                            <div>
                              <label className="font-bold text-slate-900 block mb-1 text-xs">
                                Index Horamètre Actuel Constaté (h) (Optionnel) :
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  placeholder={`ex: ${lastMachineHours + 8}`}
                                  value={reportMeterReadingHours}
                                  onChange={(e) => {
                                    setReportMeterReadingHours(e.target.value);
                                    setReportMeterError(null);
                                  }}
                                  className="w-full min-h-[48px] px-3.5 bg-white border border-blue-300 rounded-lg font-mono font-bold text-base text-slate-900 focus:outline-none focus:border-blue-600"
                                />
                                <span className="absolute right-3.5 top-3.5 font-mono font-bold text-xs text-slate-400">
                                  heures
                                </span>
                              </div>
                            </div>

                            {tabletReadingStats && hasTabletReading && (
                              <div className="grid grid-cols-2 gap-2 p-2.5 bg-white rounded-lg border border-blue-200 text-xs">
                                <div>
                                  <span className="text-[10px] font-bold text-blue-700 uppercase block">
                                    Delta Heures (Δh)
                                  </span>
                                  <span className="font-mono font-black text-sm text-blue-950">
                                    {tabletReadingStats.deltaHours >= 0 ? `+${tabletReadingStats.deltaHours}` : tabletReadingStats.deltaHours} h
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold text-blue-700 uppercase block">
                                    Temps Calendaire
                                  </span>
                                  <span className="font-mono font-bold text-slate-700 text-xs">
                                    {tabletReadingStats.elapsedCalendarHours} h ({tabletReadingStats.elapsedCalendarDays}j)
                                  </span>
                                </div>
                              </div>
                            )}

                            {tabletReadingStats?.isLowerThanLast && hasTabletReading && (
                              <div className="p-2.5 bg-red-100 border border-red-300 rounded-lg text-red-900 text-xs font-bold flex items-center gap-2">
                                <AlertCircle size={15} className="shrink-0 text-red-600" />
                                <span>L'index ne peut pas être inférieur au dernier relevé ({lastMachineHours} h).</span>
                              </div>
                            )}

                            {tabletReadingStats?.exceedsCalendarHours && !tabletReadingStats.isLowerThanLast && hasTabletReading && (
                              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-950 text-xs space-y-1.5">
                                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                                  <ShieldAlert size={15} className="text-amber-600 shrink-0" />
                                  <span>Avertissement : Le delta (+{tabletReadingStats.deltaHours} h) dépasse le temps calendaire ({tabletReadingStats.elapsedCalendarHours} h).</span>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer font-bold pt-1 border-t border-amber-200">
                                  <input
                                    type="checkbox"
                                    checked={reportMeterWarningConfirmed}
                                    onChange={(e) => setReportMeterWarningConfirmed(e.target.checked)}
                                    className="w-4 h-4 rounded text-blue-600"
                                  />
                                  <span>Je confirme l'exactitude de cet index</span>
                                </label>
                              </div>
                            )}

                            {reportMeterError && (
                              <div className="p-2.5 bg-red-50 border border-red-300 rounded-lg text-red-800 text-xs flex items-center gap-2">
                                <AlertCircle size={15} className="shrink-0 text-red-600" />
                                <span>{reportMeterError}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 2. Failure Category & Diagnostics */}
                        <div className="bg-white rounded-xl p-5 border border-slate-300 shadow-xs space-y-3.5">
                          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
                            2. Diagnostic &amp; Organe Défaillant
                          </h4>

                          <div>
                            <label className="font-bold text-slate-800 block mb-1.5 text-xs">Catégorie de Défaillance :</label>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                              {(
                                [
                                  { key: 'mechanical', label: 'Mécanique' },
                                  { key: 'electrical', label: 'Électrique' },
                                  { key: 'hydraulic', label: 'Hydraulique' },
                                  { key: 'mold', label: 'Moule' },
                                  { key: 'other', label: 'Autre' },
                                ] as const
                              ).map((cat) => (
                                <button
                                  key={cat.key}
                                  type="button"
                                  onClick={() => setReportFailureCat(cat.key)}
                                  className={`min-h-[48px] py-2.5 px-3 rounded-lg font-bold text-xs transition-colors text-center cursor-pointer border ${reportFailureCat === cat.key
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                    }`}
                                >
                                  {cat.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="font-bold text-slate-800 block mb-1 text-xs">
                              Composant ou Sous-Ensemble Concerné :
                            </label>
                            <input
                              type="text"
                              value={reportFailureSub}
                              onChange={(e) => setReportFailureSub(e.target.value)}
                              placeholder="Ex: Distributeur hydraulique, buse d'injection, thermocouple, vérin..."
                              className="w-full min-h-[48px] px-3.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                            />
                          </div>

                          <div>
                            <label className="font-bold text-slate-800 block mb-1 text-xs">Cause Racine Identifiée :</label>
                            <input
                              type="text"
                              value={reportRootCause}
                              onChange={(e) => setReportRootCause(e.target.value)}
                              placeholder="Ex: Usure normale du joint, contamination huile, rupture mécanique..."
                              className="w-full min-h-[48px] px-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                            />
                          </div>
                        </div>

                        {/* 3. Actions Performed — equipment-type aware */}
                        <div className="bg-white rounded-xl p-5 border border-slate-300 shadow-xs space-y-3.5">
                          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
                            {isTargetOrderMold
                              ? '3. Travaux & Actions Réalisés sur Moule'
                              : isTargetOrderOther
                                ? '3. Travaux & Actions Réalisés sur Équipement'
                                : '3. Travaux & Actions Réalisés sur Machine'}
                          </h4>

                          {/* Quick-add action chips — per equipment type */}
                          <div>
                            <span className="text-[11px] font-bold text-slate-500 block mb-1.5 uppercase tracking-wide">
                              Actions standard (Cliquer pour ajouter) :
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {(isTargetOrderMold
                                ? [
                                  'Nettoyage et graissage du moule',
                                  'Vérification plan de joint et empreintes',
                                  'Remplacement joints de refroidissement',
                                  'Contrôle et nettoyage éjecteurs',
                                  'Polissage et reprise empreinte',
                                  'Contrôle état canaux de refroidissement',
                                  'Essai injection 10 pièces contrôlées',
                                  'Remise en stock sur rack désigné',
                                ]
                                : isTargetOrderOther
                                  ? [
                                    'Consignation sécurité effectuée',
                                    'Diagnostic et contrôle visuel',
                                    'Nettoyage et inspection générale',
                                    'Remplacement composant défaillant',
                                    'Test de bon fonctionnement',
                                    'Remise en service validée',
                                  ]
                                  : [
                                    'Consignation LOTO effectuée',
                                    'Démontage et nettoyage pièce',
                                    "Remplacement joints d'étanchéité",
                                    'Purge circuit & contrôle fuites',
                                    'Calibrage capteur fin de course',
                                    'Essai cycle automatique 20 coups',
                                  ]
                              ).map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => {
                                    if (!reportActions.includes(preset)) {
                                      setReportActions([...reportActions, preset]);
                                    }
                                  }}
                                  className="min-h-[38px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded-lg text-xs font-medium cursor-pointer"
                                >
                                  + {preset}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            {reportActions.map((act, idx) => (
                              <div
                                key={idx}
                                className="min-h-[44px] flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs"
                              >
                                <span className="font-semibold text-slate-800">{act}</span>
                                <button
                                  type="button"
                                  onClick={() => setReportActions(reportActions.filter((_, i) => i !== idx))}
                                  className="min-h-[36px] min-w-[36px] flex items-center justify-center text-red-600 hover:text-red-800 font-bold rounded-lg hover:bg-red-50 cursor-pointer"
                                >
                                  ×
                                </button>
                              </div>
                            ))}

                            <div className="flex gap-2 pt-1">
                              <input
                                type="text"
                                placeholder="Ajouter une action manuelle..."
                                value={newActionInput}
                                onChange={(e) => setNewActionInput(e.target.value)}
                                className="flex-1 min-h-[48px] px-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (newActionInput.trim()) {
                                    setReportActions([...reportActions, newActionInput.trim()]);
                                    setNewActionInput('');
                                  }
                                }}
                                className="min-h-[48px] px-5 bg-slate-900 hover:bg-black text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                              >
                                + Ajouter
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* 3B. Mold-specific fields (only when order is for a Mold) */}
                        {isTargetOrderMold && (
                          <div className="bg-violet-50 rounded-xl p-5 border-2 border-violet-300 shadow-xs space-y-3.5 animate-in fade-in">
                            <div className="flex items-center gap-2 border-b border-violet-200 pb-2">
                              <Box className="w-4 h-4 text-violet-700" />
                              <h4 className="font-bold text-violet-950 text-xs uppercase tracking-wider">
                                Informations Spécifiques Moule
                              </h4>
                              {targetReportMold && (
                                <span className="ml-auto font-mono text-xs font-black text-violet-800 bg-violet-100 px-2 py-0.5 rounded border border-violet-300">
                                  {targetReportMold.moldNumber || targetReportMold.ref}
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="font-bold text-violet-900 block mb-1 text-xs">Fournisseur / Outilleur :</label>
                                <input
                                  type="text"
                                  value={reportMoldSupplier}
                                  onChange={(e) => setReportMoldSupplier(e.target.value)}
                                  placeholder={targetReportMold?.supplier || 'Ex: Plastimold Maroc...'}
                                  className="w-full min-h-[44px] px-3 bg-white border border-violet-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-violet-600"
                                />
                              </div>
                              <div>
                                <label className="font-bold text-violet-900 block mb-1 text-xs">Réf. Devis / Bon de Commande :</label>
                                <input
                                  type="text"
                                  value={reportMoldQuoteRef}
                                  onChange={(e) => setReportMoldQuoteRef(e.target.value)}
                                  placeholder="Ex: DEV-2024-0085..."
                                  className="w-full min-h-[44px] px-3 bg-white border border-violet-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-violet-600"
                                />
                              </div>
                              <div>
                                <label className="font-bold text-violet-900 block mb-1 text-xs">Emplacement de stockage (Rack) :</label>
                                <input
                                  type="text"
                                  value={reportMoldStorageRack}
                                  onChange={(e) => setReportMoldStorageRack(e.target.value)}
                                  placeholder={targetReportMold?.rackLocation || 'Ex: Rack A-12...'}
                                  className="w-full min-h-[44px] px-3 bg-white border border-violet-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-violet-600"
                                />
                              </div>
                              <div>
                                <label className="font-bold text-violet-900 block mb-1 text-xs">Machine d'affectation prévue :</label>
                                <input
                                  type="text"
                                  value={reportMoldAssignedMachine}
                                  onChange={(e) => setReportMoldAssignedMachine(e.target.value)}
                                  placeholder="Ex: Presse 250T — Machine 07..."
                                  className="w-full min-h-[44px] px-3 bg-white border border-violet-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-violet-600"
                                />
                              </div>
                              <div>
                                <label className="font-bold text-violet-900 block mb-1 text-xs">Empreintes Affectées :</label>
                                <input
                                  type="text"
                                  value={reportAffectedCavities}
                                  onChange={(e) => setReportAffectedCavities(e.target.value)}
                                  placeholder="Ex: Empreintes #2 et #4, buse chaude..."
                                  className="w-full min-h-[44px] px-3 bg-white border border-violet-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-violet-600"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="font-bold text-violet-900 block mb-1.5 text-xs">Lieu de réparation :</label>
                              <div className="flex gap-2">
                                {(['local', 'external'] as const).map((loc) => (
                                  <button
                                    key={loc}
                                    type="button"
                                    onClick={() => setReportMoldLocation(loc)}
                                    className={`flex-1 min-h-[44px] rounded-lg font-bold text-xs border cursor-pointer transition-colors ${reportMoldLocation === loc
                                      ? 'bg-violet-700 text-white border-violet-700 shadow-xs'
                                      : 'bg-white text-violet-900 border-violet-200 hover:bg-violet-50'
                                      }`}
                                  >
                                    {loc === 'local' ? '🏭 Réparation en atelier' : '🚚 Envoi chez outilleur'}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 3C. Other Equipment-specific fields */}
                        {isTargetOrderOther && (
                          <div className="bg-teal-50 rounded-xl p-5 border-2 border-teal-300 shadow-xs space-y-3.5 animate-in fade-in">
                            <div className="flex items-center gap-2 border-b border-teal-200 pb-2">
                              <Settings className="w-4 h-4 text-teal-700" />
                              <h4 className="font-bold text-teal-950 text-xs uppercase tracking-wider">
                                Informations Spécifiques Équipement
                              </h4>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="font-bold text-teal-900 block mb-1 text-xs">Type d'équipement :</label>
                                <select
                                  value={reportOtherEquipmentType}
                                  onChange={(e) => setReportOtherEquipmentType(e.target.value)}
                                  className="w-full min-h-[44px] px-3 bg-white border border-teal-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-teal-600"
                                >
                                  {['Installation Générale', 'Convoyeur', 'Robot / Bras articulé', 'Compresseur', 'Refroidisseur', 'Groupe hydraulique', 'Armoire électrique', 'Outillage / Gabarit', 'Autre'].map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="font-bold text-teal-900 block mb-1 text-xs">Localisation dans l'atelier :</label>
                                <input
                                  type="text"
                                  value={reportOtherLocation}
                                  onChange={(e) => setReportOtherLocation(e.target.value)}
                                  placeholder="Ex: Zone packaging, allée B..."
                                  className="w-full min-h-[44px] px-3 bg-white border border-teal-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-teal-600"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="font-bold text-teal-900 block mb-1 text-xs">Mesures de sécurité appliquées :</label>
                                <input
                                  type="text"
                                  value={reportOtherSafetyMeasures}
                                  onChange={(e) => setReportOtherSafetyMeasures(e.target.value)}
                                  placeholder="Ex: Consignation électrique, balisage zone..."
                                  className="w-full min-h-[44px] px-3 bg-white border border-teal-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-teal-600"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 4. Spare Parts Consumed from Stock Magasin */}
                        <div className="bg-white rounded-xl p-5 border border-slate-300 shadow-xs space-y-3.5">
                          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
                            4. Pièces de Rechange &amp; Consommables Magasin
                          </h4>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <select
                              value={selectedStockPartId}
                              onChange={(e) => setSelectedStockPartId(e.target.value)}
                              className="flex-1 min-h-[48px] px-3 bg-white border border-slate-300 rounded-lg font-medium text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                            >
                              {stock.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.partNumber} - {s.name} (Stock : {s.currentQty} {s.unit})
                                </option>
                              ))}
                            </select>

                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                value={selectedStockQty}
                                onChange={(e) => setSelectedStockQty(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-20 min-h-[48px] px-2 bg-white border border-slate-300 rounded-lg font-mono text-center font-bold text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                              />

                              <button
                                type="button"
                                onClick={handleAddStockPart}
                                className="min-h-[48px] px-5 bg-slate-900 hover:bg-black text-white font-bold rounded-lg text-xs whitespace-nowrap cursor-pointer shadow-xs"
                              >
                                + Prélever
                              </button>
                            </div>
                          </div>

                          {consumedPartsList.length > 0 && (
                            <div className="space-y-2 pt-1">
                              {consumedPartsList.map((p, idx) => (
                                <div
                                  key={idx}
                                  className="min-h-[44px] flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs"
                                >
                                  <div>
                                    <span className="font-mono font-bold text-slate-900">{p.partNumber}</span>
                                    <span className="font-semibold text-slate-700 ml-2">{p.name}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="font-mono font-bold text-slate-900">Qté : {p.qty}</span>
                                    <button
                                      type="button"
                                      onClick={() => setConsumedPartsList(consumedPartsList.filter((_, i) => i !== idx))}
                                      className="min-h-[36px] min-w-[36px] flex items-center justify-center text-red-600 font-bold hover:text-red-800 rounded cursor-pointer"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 5. Final Equipment Status — equipment-type aware */}
                        <div className="bg-white rounded-xl p-5 border border-slate-300 shadow-xs space-y-3.5">
                          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
                            {isTargetOrderMold
                              ? '5. État Final Moule Après Travaux'
                              : isTargetOrderOther
                                ? '5. État Final Équipement Après Travaux'
                                : '5. État Final Machine Après Travaux'}
                          </h4>

                          {/* Mold status options */}
                          {isTargetOrderMold ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                {(['In Use', 'In Stock', 'Exported'] as const).map((s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => setReportMoldStatusAfter(s as 'In Use' | 'In Stock' | 'Exported')}
                                    className={`min-h-[48px] py-3 px-3 rounded-lg font-bold text-xs transition-colors border cursor-pointer flex items-center justify-center gap-2 ${reportMoldStatusAfter === s
                                      ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                                      : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800'
                                      }`}
                                  >
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${s === 'In Use' ? (reportMoldStatusAfter === s ? 'bg-emerald-400' : 'bg-emerald-600')
                                      : s === 'In Stock' ? (reportMoldStatusAfter === s ? 'bg-blue-400' : 'bg-blue-500')
                                        : (reportMoldStatusAfter === s ? 'bg-slate-400' : 'bg-slate-500')
                                      }`} />
                                    <span>
                                      {s === 'In Use' ? 'En production' : s === 'In Stock' ? 'En stock / Rack' : 'Exporté outilleur'}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            /* Machine / Other status options */
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              <button
                                type="button"
                                onClick={() => setReportStatusAfter('operational')}
                                className={`min-h-[48px] py-3 px-3 rounded-lg font-bold text-xs transition-colors border cursor-pointer flex items-center justify-center gap-2 ${reportStatusAfter === 'operational'
                                  ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                                  : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800'
                                  }`}
                              >
                                <span className={`w-2 h-2 rounded-full shrink-0 ${reportStatusAfter === 'operational' ? 'bg-emerald-400' : 'bg-emerald-600'}`} />
                                <span>{isTargetOrderOther ? 'Opérationnel' : 'Opérationnelle (En marche)'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setReportStatusAfter('idle')}
                                className={`min-h-[48px] py-3 px-3 rounded-lg font-bold text-xs transition-colors border cursor-pointer flex items-center justify-center gap-2 ${reportStatusAfter === 'idle'
                                  ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                                  : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800'
                                  }`}
                              >
                                <span className={`w-2 h-2 rounded-full shrink-0 ${reportStatusAfter === 'idle' ? 'bg-amber-400' : 'bg-amber-500'}`} />
                                <span>{isTargetOrderOther ? 'En attente vérification' : 'En Essai (Standby)'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setReportStatusAfter('down')}
                                className={`min-h-[48px] py-3 px-3 rounded-lg font-bold text-xs transition-colors border cursor-pointer flex items-center justify-center gap-2 ${reportStatusAfter === 'down'
                                  ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                                  : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800'
                                  }`}
                              >
                                <span className={`w-2 h-2 rounded-full shrink-0 ${reportStatusAfter === 'down' ? 'bg-red-400' : 'bg-red-500'}`} />
                                <span>{isTargetOrderOther ? 'Hors service' : 'Arrêtée (En Panne)'}</span>
                              </button>
                            </div>
                          )}

                          <div>
                            <label className="font-bold text-slate-800 block mb-1 text-xs">
                              Observations / Difficultés Particulières :
                            </label>
                            <textarea
                              rows={2}
                              value={reportDifficulties}
                              onChange={(e) => setReportDifficulties(e.target.value)}
                              placeholder="Notes pour la production ou les méthodes maintenance..."
                              className="w-full p-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                            />
                          </div>
                        </div>

                        {/* Submit Final Report Button */}
                        <div className="pt-2">
                          <button
                            type="submit"
                            className="min-h-[52px] w-full py-4 bg-slate-900 hover:bg-black text-white font-bold text-sm sm:text-base rounded-lg shadow-xs active:scale-[0.99] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <CheckCircle2 size={20} />
                            <span>Valider &amp; Transmettre le Rapport d'Intervention (PV)</span>
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: GESTION DES MOULES (MOLD MANAGEMENT)                               */}
        {/* ========================================================================= */}
        {activeTab === 'molds' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Header banner */}
            <div className="w-full py-3.5 px-4 bg-white border border-slate-300 text-slate-900 font-bold text-sm sm:text-base rounded-xl text-center shadow-xs flex items-center justify-center gap-2">
              <Box size={20} className="text-slate-700" />
              <span>Gestion &amp; Suivi du Parc Moules d'Injection</span>
            </div>

            {/* Mold N° selector with Search & Add */}
            <div className="flex items-center gap-2.5">
              <label className="font-bold text-slate-800 text-xs uppercase tracking-wider whitespace-nowrap">N° Moule :</label>

              <button
                type="button"
                onClick={() => {
                  setMoldSearchTerm('');
                  setIsMoldSearchModalOpen(true);
                }}
                className="flex-1 min-h-[48px] flex items-center justify-between px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold text-slate-800 shadow-2xs hover:border-slate-900 transition-colors text-left cursor-pointer"
              >
                <span className={selectedMold ? 'font-bold text-slate-900 truncate' : 'text-slate-400 font-normal'}>
                  {selectedMold
                    ? `${selectedMold.moldNumber || selectedMold.ref}${selectedMold.description ? ' — ' + selectedMold.description : ''
                    }`
                    : 'Search'}
                </span>
                <div className="flex items-center gap-1 shrink-0 ml-2 text-slate-400">
                  <Search size={16} />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsAddMoldModalOpen(true)}
                className="min-h-[48px] px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer"
                title="Ajouter un nouveau moule"
              >
                <Plus size={16} />
                <span>Moule</span>
              </button>
            </div>

            {/* Mold Information Card */}
            <div className="bg-white border border-slate-300 rounded-xl p-4 sm:p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Caractéristiques &amp; Fiche Moule
                </span>
                {selectedMold && (
                  <span className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase border ${selectedMold.status === 'In Use'
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : selectedMold.status === 'In Maintenance'
                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                      : selectedMold.status === 'Exported'
                        ? 'bg-slate-100 text-slate-800 border-slate-300'
                        : 'bg-slate-100 text-slate-800 border-slate-300'
                    }`}>
                    {selectedMold.status}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {(
                  [
                    ['Désignation Moule :', selectedMold?.description || '—'],
                    ['Référence Moule :', selectedMold?.moldNumber || selectedMold?.ref || '—'],
                    ['Statut Actuel :', selectedMold?.status || '—'],
                    [
                      selectedMold?.status === 'Exported' ? 'Destination :' : 'Emplacement / Rack :',
                      selectedMold?.location || selectedMold?.rackLocation || '—',
                    ],
                    ...(selectedMold?.status === 'Exported' && selectedMold?.exportDate
                      ? [['Date Exportation :', selectedMold.exportDate]]
                      : []),
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-600 font-semibold whitespace-nowrap">{label}</span>
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 text-right truncate min-w-0">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mold Technical File Button */}
            <button
              type="button"
              disabled={!selectedMold}
              onClick={handleDownloadMoldPdf}
              className="min-h-[48px] w-full py-3.5 px-4 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold rounded-lg shadow-xs transition-colors disabled:opacity-40 text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download size={16} />
              <span>Télécharger la Fiche Technique Moule (PDF)</span>
            </button>

            {/* Active Mold Maintenance Card & Action Buttons with Full GMAO Workflow Progression */}
            {selectedMold && selectedMold.status === 'In Maintenance' && (() => {
              const moldWorkflow = getMoldWorkflowState(selectedMold);
              const validCount = moldWorkflow.order ? [
                moldWorkflow.order.validationRespMaint?.validated,
                moldWorkflow.order.validationRespProd?.validated,
                moldWorkflow.order.validationQHSE?.validated,
              ].filter(Boolean).length : 0;

              return (
                <div className="bg-amber-50/70 border border-amber-300 rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-950">
                        Moule Actuellement en Maintenance
                      </span>
                    </div>
                    {activeMaintenanceRecord && (
                      <span className="text-[10px] font-mono font-bold text-amber-950 bg-amber-200/80 px-2.5 py-0.5 rounded border border-amber-300 uppercase">
                        {activeMaintenanceRecord.repairLocation === 'external' ? 'Atelier Externe' : 'Atelier Interne'}
                      </span>
                    )}
                  </div>

                  {/* ── GMAO WORKFLOW STAGE PROGRESSION BANNER FOR MOLD ── */}
                  {moldWorkflow.stage === 'waiting_validation' && (
                    <div className="p-3 bg-amber-100/80 border border-amber-300 rounded-lg text-xs flex items-center justify-between text-amber-950 shadow-2xs">
                      <div className="flex items-start gap-2.5">
                        <Clock size={16} className="text-amber-800 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block">
                            Ticket {moldWorkflow.request?.refIR} : En attente validation Responsable Technique
                          </strong>
                          <span className="text-[11px] text-amber-900 block mt-0.5">
                            La demande d'intervention est créée. Accès aux travaux verrouillé jusqu'à validation et signature de l'OT.
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-amber-200 text-amber-950 px-2 py-0.5 rounded shrink-0 self-start">
                        Étape 1/3
                      </span>
                    </div>
                  )}

                  {moldWorkflow.stage === 'waiting_work_order' && (
                    <div className="p-3 bg-slate-100 border border-slate-300 rounded-lg text-xs flex items-center justify-between text-slate-950 shadow-2xs">
                      <div className="flex items-start gap-2.5">
                        <CheckCircle2 size={16} className="text-slate-700 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block">
                            Ticket {moldWorkflow.request?.refIR} : Validé · En attente création Ordre de Travail (OT)
                          </strong>
                          <span className="text-[11px] text-slate-600 block mt-0.5">
                            Demande validée par le Responsable Technique. En attente de création de l'OT par les méthodes.
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-900 px-2 py-0.5 rounded shrink-0 self-start">
                        Étape 2/3
                      </span>
                    </div>
                  )}

                  {moldWorkflow.stage === 'waiting_3_validations' && (
                    <div className="p-3 bg-amber-100/90 border border-amber-300 rounded-lg text-xs space-y-2.5 text-amber-950 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldAlert size={16} className="text-amber-800 shrink-0" />
                          <strong className="text-xs">
                            OT {moldWorkflow.order?.refOT} : Pré-validation en cours ({validCount}/3 validations signées)
                          </strong>
                        </div>
                        <span className="text-[10px] font-mono font-bold bg-amber-200 text-amber-950 px-2 py-0.5 rounded">
                          Pré-Validation
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-[11px] font-bold">
                        <div
                          className={`p-2 rounded border text-center transition-all ${moldWorkflow.order?.validationRespMaint?.validated
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-white border-amber-200 text-slate-600'
                            }`}
                        >
                          <div>1. Resp. Maint</div>
                          <span className="block mt-0.5 text-[10px] font-mono">
                            {moldWorkflow.order?.validationRespMaint?.validated ? '✓ Validé' : 'En attente'}
                          </span>
                        </div>
                        <div
                          className={`p-2 rounded border text-center transition-all ${moldWorkflow.order?.validationRespProd?.validated
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-white border-amber-200 text-slate-600'
                            }`}
                        >
                          <div>2. Resp. Prod</div>
                          <span className="block mt-0.5 text-[10px] font-mono">
                            {moldWorkflow.order?.validationRespProd?.validated ? '✓ Validé' : 'En attente'}
                          </span>
                        </div>
                        <div
                          className={`p-2 rounded border text-center transition-all ${moldWorkflow.order?.validationQHSE?.validated
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-white border-amber-200 text-slate-600'
                            }`}
                        >
                          <div>3. QHSE</div>
                          <span className="block mt-0.5 text-[10px] font-mono">
                            {moldWorkflow.order?.validationQHSE?.validated ? '✓ Validé' : 'En attente'}
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-amber-900 flex items-center gap-1.5 font-medium">
                        <Lock size={13} className="shrink-0 text-amber-800" />
                        <span>Fiche travaux verrouillée jusqu'à validation complète des 3 responsables.</span>
                      </div>
                    </div>
                  )}

                  {moldWorkflow.stage === 'ready_to_report' && (
                    <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs flex items-center justify-between text-emerald-950 font-bold shadow-2xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
                        <div>
                          <span>OT {moldWorkflow.order?.refOT} : 3/3 Validations approuvées · Débloqué pour travaux</span>
                          <span className="text-[11px] font-normal text-emerald-800 block">
                            Autorisations pré-intervention complétées. La fiche travaux est déverrouillée.
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-emerald-200 text-emerald-950 px-2 py-0.5 rounded shrink-0">
                        Débloqué
                      </span>
                    </div>
                  )}

                  <div className="text-xs text-slate-800 space-y-2 bg-white rounded-lg p-3.5 border border-amber-200 shadow-2xs">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={16} className="text-amber-700 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Anomalie / Motif :</span>
                        <p className="font-bold text-slate-900 leading-snug break-words mt-0.5">
                          {activeMaintenanceRecord?.issueDescription || selectedMold.comment || 'Maintenance en cours'}
                        </p>
                      </div>
                    </div>

                    {activeMaintenanceRecord?.repairLocation === 'external' && activeMaintenanceRecord.supplierName && (
                      <div className="flex items-center gap-2 text-[11px] text-slate-700 pt-2 border-t border-slate-100">
                        <Building2 size={14} className="text-slate-600 shrink-0" />
                        <span className="truncate">
                          Fournisseur / Sous-traitant : <strong className="text-slate-900">{activeMaintenanceRecord.supplierName}</strong>
                        </span>
                      </div>
                    )}

                    {activeMaintenanceRecord?.actionsPerformed &&
                      activeMaintenanceRecord.actionsPerformed.filter(Boolean).length > 0 && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-700 pt-2 border-t border-slate-100">
                          <Wrench size={14} className="text-slate-600 shrink-0" />
                          <span className="truncate">
                            {activeMaintenanceRecord.actionsPerformed.filter(Boolean).length} action(s) enregistrée(s)
                          </span>
                        </div>
                      )}

                    {activeMaintenanceRecord?.imageUrl && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <a
                          href={activeMaintenanceRecord.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 hover:underline"
                        >
                          <ImageIcon size={14} />
                          <span>Photo de l'intervention</span>
                        </a>
                        <img
                          src={activeMaintenanceRecord.imageUrl}
                          alt="Intervention"
                          className="w-9 h-9 rounded-md object-cover border border-slate-200"
                        />
                      </div>
                    )}
                  </div>

                  {/* ── ACTION BUTTONS RESPECTING THE GMAO PIPELINE ── */}
                  <div className="flex flex-col sm:flex-row items-stretch gap-2.5 pt-1">
                    {moldWorkflow.stage === 'waiting_validation' && (
                      <button
                        type="button"
                        onClick={() =>
                          showTabletToast(
                            'En attente de validation',
                            `La demande ${moldWorkflow.request?.refIR} est en attente du Responsable Technique. L'accès à la fiche travaux reste verrouillé.`
                          )
                        }
                        className="min-h-[48px] flex-1 px-3 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Clock size={16} className="text-amber-800" />
                        <span>En attente de validation DI</span>
                      </button>
                    )}

                    {moldWorkflow.stage === 'waiting_work_order' && (
                      <button
                        type="button"
                        onClick={() =>
                          showTabletToast(
                            'En attente création OT',
                            `La demande ${moldWorkflow.request?.refIR} a été validée ! En attente de création de l'Ordre de Travail (OT).`
                          )
                        }
                        className="min-h-[48px] flex-1 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Clock size={16} className="text-slate-600" />
                        <span>En attente création OT</span>
                      </button>
                    )}

                    {moldWorkflow.stage === 'waiting_3_validations' && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('orders');
                          showTabletToast(
                            'Pré-validation OT',
                            `OT ${moldWorkflow.order?.refOT} : ${validCount}/3 signatures validées. Redirection vers les Ordres de Travail.`
                          );
                        }}
                        className="min-h-[48px] flex-1 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                      >
                        <ShieldAlert size={16} />
                        <span>Pré-validation OT ({validCount}/3)</span>
                      </button>
                    )}

                    {moldWorkflow.stage === 'ready_to_report' ? (
                      <button
                        type="button"
                        onClick={() => handleOpenMaintenanceModal()}
                        className="min-h-[48px] flex-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                      >
                        <Wrench size={16} />
                        <span>Remplir Fiche Travaux</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={true}
                        onClick={() =>
                          showTabletToast(
                            'Fiche Travaux Verrouillée',
                            'Nécessite la validation de la DI et les 3 pré-validations (Resp Maint, Resp Prod, QHSE) avant travaux.'
                          )
                        }
                        className="min-h-[48px] flex-1 px-3 bg-slate-100 text-slate-400 border border-slate-200 font-bold rounded-lg text-xs flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
                        title="Verrouillé : nécessite les 3 pré-validations complètes de l'OT"
                      >
                        <Lock size={15} />
                        <span>Fiche Travaux (Verrouillée)</span>
                      </button>
                    )}

                    {moldWorkflow.stage === 'can_create_ticket' && (
                      <button
                        type="button"
                        onClick={handleSaveMoldMaintenance}
                        className="min-h-[48px] flex-1 px-3 bg-slate-900 hover:bg-black text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                      >
                        <Send size={15} />
                        <span>+ Créer Demande DI</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenCloseModal()}
                      className="min-h-[48px] px-4 bg-slate-900 hover:bg-black text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer shrink-0"
                    >
                      <CheckCircle2 size={16} />
                      <span>Clôturer Maintenance</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Change Status Card */}
            <div className="bg-white border border-slate-300 rounded-xl p-4 sm:p-5 space-y-4 shadow-xs">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block border-b border-slate-200 pb-2">
                Changement de Statut &amp; Affectation Moule
              </span>

              <div className="space-y-4 pt-1">
                {/* In Stock row */}
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <div className="min-w-[120px] py-2 px-3 bg-slate-100 text-slate-800 border border-slate-300 font-bold rounded-lg text-xs text-center select-none flex items-center justify-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-500" />
                      <span>En Stock</span>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <label className="text-xs font-bold text-slate-700 whitespace-nowrap">N° Location :</label>
                      <input
                        type="text"
                        value={moldLocationInput}
                        onChange={(e) => setMoldLocationInput(e.target.value)}
                        placeholder=""
                        className="flex-1 min-h-[44px] px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={savingMold || !selectedMold}
                      onClick={handleSaveMoldLocation}
                      className="min-h-[44px] px-5 bg-slate-900 hover:bg-black text-white font-bold rounded-lg text-xs shadow-xs transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      {savingMold ? <RefreshCw size={14} className="animate-spin mx-auto" /> : 'Enregistrer en Stock'}
                    </button>
                  </div>
                </div>

                {/* In Maintenance row */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <div className="min-w-[120px] py-2 px-3 bg-amber-50 text-amber-950 border border-amber-300 font-bold rounded-lg text-xs text-center select-none flex items-center justify-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-600" />
                      <span>En Maintenance</span>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Raison :</label>
                      <input
                        type="text"
                        value={moldReasonInput}
                        onChange={(e) => setMoldReasonInput(e.target.value)}
                        placeholder=""
                        className="flex-1 min-h-[44px] px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    {(() => {
                      const moldWorkflow = selectedMold ? getMoldWorkflowState(selectedMold) : undefined;
                      const hasActiveWorkflow = moldWorkflow && moldWorkflow.stage !== 'can_create_ticket';

                      return (
                        <>
                          {hasActiveWorkflow ? (
                            <span className="text-[11px] text-amber-800 font-medium">
                              Procédure déjà en cours ({moldWorkflow?.label})
                            </span>
                          ) : (
                            <span />
                          )}
                          <div className="flex justify-end">
                            <button
                              type="button"
                              disabled={savingMold || !selectedMold || Boolean(hasActiveWorkflow)}
                              onClick={handleSaveMoldMaintenance}
                              className="min-h-[44px] px-5 bg-slate-900 hover:bg-black text-white font-bold rounded-lg text-xs shadow-xs transition-colors disabled:opacity-40 cursor-pointer"
                              title={hasActiveWorkflow ? `Procédure déjà en cours (${moldWorkflow?.label})` : 'Ouvrir Maintenance Moule'}
                            >
                              {savingMold ? <RefreshCw size={14} className="animate-spin mx-auto" /> : 'Ouvrir Maintenance Moule'}
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* In Use row */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <div className="min-w-[120px] py-2 px-3 bg-emerald-50 text-emerald-950 border border-emerald-300 font-bold rounded-lg text-xs text-center select-none flex items-center justify-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      <span>En Prod</span>
                    </div>
                    <div className="flex items-center gap-2 flex-1 relative">
                      <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Presse :</label>
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={inUseMachineSearch || inUseMachineName}
                          onChange={(e) => {
                            setInUseMachineSearch(e.target.value);
                            setInUseMachineName(e.target.value);
                            setInUseMachineDropdownOpen(true);
                          }}
                          onFocus={() => {
                            setInUseMachineSearch('');
                            setInUseMachineDropdownOpen(true);
                          }}
                          placeholder=""
                          className="w-full min-h-[44px] px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                        />
                        {inUseMachineDropdownOpen && (() => {
                          const q = inUseMachineSearch.toLowerCase();
                          const filtered = machines.filter(
                            (m: any) =>
                              (m.name || '').toLowerCase().includes(q) ||
                              (m.location || '').toLowerCase().includes(q) ||
                              (m.number || m.siteNumber || '').toLowerCase().includes(q)
                          );
                          return filtered.length > 0 ? (
                            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                              {filtered.map((m: any) => {
                                const displayName = m.number || m.name;
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => {
                                      setInUseMachineName(displayName);
                                      setInUseMachineSearch('');
                                      setInUseMachineDropdownOpen(false);
                                    }}
                                    className="w-full px-3 py-2.5 text-left flex items-center justify-between hover:bg-slate-50 border-b border-slate-100 last:border-0 cursor-pointer"
                                  >
                                    <div>
                                      <span className="text-xs font-bold text-slate-900 block">{displayName}</span>
                                      <span className="text-[10px] text-slate-500">
                                        {m.name && m.name !== displayName ? `${m.name} ` : ''}
                                        {m.location ? `(${m.location})` : ''}
                                      </span>
                                    </div>
                                    {inUseMachineName === displayName && (
                                      <CheckCircle2 size={14} className="text-emerald-700 shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={savingInUseMold || !selectedMold || !inUseMachineName.trim()}
                      onClick={handleSaveMoldInUse}
                      className="min-h-[44px] px-5 bg-slate-900 hover:bg-black text-white font-bold rounded-lg text-xs shadow-xs transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      {savingInUseMold ? <RefreshCw size={14} className="animate-spin mx-auto" /> : 'Monter sur Presse'}
                    </button>
                  </div>
                </div>

                {/* Exporter row */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <div className="min-w-[120px] py-2 px-3 bg-slate-100 text-slate-800 border border-slate-300 font-bold rounded-lg text-xs text-center select-none flex items-center justify-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-600" />
                      <span>Exporté</span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
                      <div className="flex items-center gap-2 flex-1">
                        <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Date :</label>
                        <input
                          type="date"
                          value={moldExportDateInput}
                          onChange={(e) => setMoldExportDateInput(e.target.value)}
                          className="flex-1 min-h-[44px] px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Destination :</label>
                        <input
                          type="text"
                          value={moldExportDestinationInput}
                          onChange={(e) => setMoldExportDestinationInput(e.target.value)}
                          placeholder="Client, Autre usine..."
                          className="flex-1 min-h-[44px] px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={savingExportMold || !selectedMold}
                      onClick={handleSaveMoldExported}
                      className="min-h-[44px] px-5 bg-slate-900 hover:bg-black text-white font-bold rounded-lg text-xs shadow-xs transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      {savingExportMold ? <RefreshCw size={14} className="animate-spin mx-auto" /> : 'Enregistrer Exportation'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: OFS LIST (DOSSIERS TECHNIQUES & RAPPORTS PDF DE FABRICATION)        */}
        {/* ========================================================================= */}
        {activeTab === 'ofs_list' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Header banner */}
            <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-300 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                      Ofs List · Ordres de Fabrication
                    </h3>
                    <p className="text-xs text-slate-500">
                      Consultez les dossiers et rapports PDF, puis marquez l&apos;OF terminé à la fin des opérations.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={refreshOFsFromBackend}
                    disabled={isRefreshingOFs}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg border border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
                    title="Actualiser la liste des OFs depuis le serveur"
                  >
                    <RefreshCw size={14} className={isRefreshingOFs ? 'animate-spin text-blue-600' : 'text-slate-600'} />
                    <span>Actualiser</span>
                  </button>
                  <span className="font-mono text-xs font-bold px-3 py-1.5 bg-blue-50 text-blue-800 rounded-lg border border-blue-200">
                    {activeOFsCount} OF(s) Actif(s)
                  </span>
                </div>
              </div>

              {/* Search & Toggle */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search size={16} className="text-slate-400 absolute left-3 top-3" />
                  <input
                    type="search"
                    placeholder="Rechercher un OF, une pièce, une machine..."
                    value={ofSearchQuery}
                    onChange={(e) => setOfSearchQuery(e.target.value)}
                    className="w-full min-h-[42px] pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer self-start sm:self-auto select-none">
                  <input
                    type="checkbox"
                    checked={showDoneOFs}
                    onChange={(e) => setShowDoneOFs(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Afficher aussi les OFs terminés</span>
                </label>
              </div>
            </div>

            {/* List of OF Cards */}
            {tabletOFs.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-300 p-10 text-center space-y-3">
                <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center mx-auto border border-slate-200">
                  <Layers className="w-7 h-7 text-slate-400" />
                </div>
                <p className="font-bold text-slate-800 text-sm">
                  {showDoneOFs
                    ? 'Aucun ordre de fabrication ne correspond à votre recherche.'
                    : 'Aucun OF actif en attente ou en cours. Les ordres terminés sont masqués.'}
                </p>
                <p className="text-xs text-slate-500">
                  Tous les OFs clôturés sont archivés côté atelier.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tabletOFs.map((ofItem) => {
                  const isDone = ofItem.status === 'Done';
                  return (
                    <div
                      key={ofItem.id}
                      className={`bg-white rounded-xl border-2 p-5 space-y-4 shadow-xs transition-all ${
                        isDone
                          ? 'border-slate-200 opacity-60'
                          : ofItem.priority === 'Urgent'
                          ? 'border-red-300 bg-red-50/10'
                          : 'border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-blue-700 text-base">
                              {ofItem.ofNumber}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                ofItem.status === 'Done'
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  : ofItem.status === 'In Progress'
                                  ? 'bg-blue-100 text-blue-900 border-blue-300'
                                  : 'bg-amber-100 text-amber-900 border-amber-300'
                              }`}
                            >
                              {ofItem.status === 'Done'
                                ? '✓ Terminé'
                                : ofItem.status === 'In Progress'
                                ? '⚙ En cours'
                                : '⏳ En attente'}
                            </span>
                            {ofItem.priority === 'Urgent' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-900 border border-red-300">
                                Urgent
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm mt-1">
                            {ofItem.title}
                          </h4>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 shrink-0">
                          {ofItem.date}
                        </span>
                      </div>

                      {/* Info grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">
                            Machine :
                          </span>
                          <span className="font-semibold text-slate-900">
                            {ofItem.machineName || 'Machine standard'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">
                            Moule / Outillage :
                          </span>
                          <span className="font-semibold text-slate-900">
                            {ofItem.moldName || 'Standard'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">
                            Quantité Cible :
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            {(ofItem.targetQuantity || 0).toLocaleString()} pcs
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">
                            Échéance :
                          </span>
                          <span className="font-semibold text-slate-800">
                            {ofItem.dueDate || 'Non définie'}
                          </span>
                        </div>
                      </div>

                      {ofItem.notes && (
                        <div className="text-xs text-slate-600 bg-amber-50/70 p-2.5 rounded-lg border border-amber-200">
                          <span className="font-bold text-amber-900 block mb-0.5">Instructions atelier :</span>
                          <p>{ofItem.notes}</p>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                        {ofItem.pdfUrl ? (
                          <button
                            type="button"
                            onClick={() => setPreviewPdfOF(ofItem)}
                            className="min-h-[44px] flex-1 px-3 bg-red-50 hover:bg-red-100 text-red-800 font-bold rounded-lg text-xs border border-red-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <FileText size={16} className="text-red-600" />
                            <span>Voir le Rapport PDF</span>
                          </button>
                        ) : (
                          <div className="min-h-[44px] flex-1 px-3 bg-slate-100 text-slate-400 font-semibold rounded-lg text-xs flex items-center justify-center">
                            Pas de PDF joint
                          </div>
                        )}

                        {!isDone ? (
                          <button
                            type="button"
                            onClick={() => handleCompleteOF(ofItem)}
                            className="min-h-[44px] flex-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                          >
                            <CheckCircle2 size={16} />
                            <span>Marquer comme Terminé</span>
                          </button>
                        ) : (
                          <div className="min-h-[44px] flex-1 px-3 bg-emerald-50 text-emerald-800 font-bold rounded-lg text-xs border border-emerald-200 flex items-center justify-center gap-1">
                            <span>✓ Clôturé ({ofItem.completedBy || 'Technicien'})</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── ERGONOMIC INDUSTRIAL BOTTOM TABLET NAVIGATION DOCK ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 text-slate-300 border-t border-slate-800 h-20 px-2 sm:px-4 shadow-2xl flex items-center justify-around">
        <button
          type="button"
          onClick={() => {
            setActiveTab('machines');
            setMachineSubView('overview');
          }}
          className={`min-h-[52px] flex-1 flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-lg transition-colors cursor-pointer border ${activeTab === 'machines'
            ? 'bg-slate-800 text-white font-bold border-slate-700 shadow-xs'
            : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
        >
          <div className="relative">
            <Wrench size={20} className={activeTab === 'machines' ? 'text-white' : 'text-slate-400'} />
            {machinesInMaintCount > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-mono text-[10px] font-black leading-tight shadow-xs">
                {machinesInMaintCount}
              </span>
            )}
          </div>
          <span className="text-[11px] font-mono tracking-tight">Machines</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`min-h-[52px] flex-1 flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-lg transition-colors cursor-pointer border ${activeTab === 'orders'
            ? 'bg-slate-800 text-white font-bold border-slate-700 shadow-xs'
            : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
        >
          <div className="relative">
            <ClipboardList size={20} className={activeTab === 'orders' ? 'text-white' : 'text-slate-400'} />
            {ordersReadyForReportCount > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 rounded bg-emerald-500 text-slate-950 font-mono text-[10px] font-black leading-tight shadow-xs">
                {ordersReadyForReportCount}
              </span>
            )}
          </div>
          <span className="text-[11px] font-mono tracking-tight">Ordres (OT)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setPrefilledDescription('');
            setPrefilledTargetMachineId('');
            setActiveTab('send_di');
            setDiSubView('list');
          }}
          className={`min-h-[52px] flex-1 flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-lg transition-colors cursor-pointer border ${activeTab === 'send_di'
            ? 'bg-slate-800 text-white font-bold border-slate-700 shadow-xs'
            : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
        >
          <div className="relative">
            <Send size={20} className={activeTab === 'send_di' ? 'text-white' : 'text-slate-400'} />
            {requests.filter((r) => r.status === 'Waiting').length > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-mono text-[10px] font-black leading-tight shadow-xs">
                {requests.filter((r) => r.status === 'Waiting').length}
              </span>
            )}
          </div>
          <span className="text-[11px] font-mono tracking-tight">Demandes (DI)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('molds')}
          className={`min-h-[52px] flex-1 flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-lg transition-colors cursor-pointer border ${activeTab === 'molds'
            ? 'bg-slate-800 text-white font-bold border-slate-700 shadow-xs'
            : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
        >
          <Box size={20} className={activeTab === 'molds' ? 'text-white' : 'text-slate-400'} />
          <span className="text-[11px] font-mono tracking-tight">Moules</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ofs_list')}
          className={`min-h-[52px] flex-1 flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-lg transition-colors cursor-pointer border ${activeTab === 'ofs_list'
            ? 'bg-slate-800 text-white font-bold border-slate-700 shadow-xs'
            : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
        >
          <div className="relative">
            <Layers size={20} className={activeTab === 'ofs_list' ? 'text-white' : 'text-slate-400'} />
            {activeOFsCount > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 rounded bg-blue-500 text-white font-mono text-[10px] font-black leading-tight shadow-xs">
                {activeOFsCount}
              </span>
            )}
          </div>
          <span className="text-[11px] font-mono tracking-tight">Ofs List</span>
        </button>
      </nav>

      {/* ── TABLET PDF REPORT VIEWER MODAL ── */}
      {previewPdfOF && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/80 backdrop-blur-xs justify-center items-center p-2 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-xl max-w-4xl w-full h-[92vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0">
                  <FileText size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm sm:text-base truncate">
                    {previewPdfOF.ofNumber} — {previewPdfOF.title}
                  </h3>
                  <p className="text-[11px] text-slate-300 truncate">
                    {previewPdfOF.pdfFileName || 'Rapport Technique PDF'}
                    {previewPdfOF.pdfFileSize ? ` · ${(previewPdfOF.pdfFileSize / 1024).toFixed(1)} Ko` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {previewPdfOF.pdfUrl && (
                  <>
                    <a
                      href={previewPdfOF.pdfUrl}
                      download={previewPdfOF.pdfFileName || `${previewPdfOF.ofNumber}.pdf`}
                      className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-200 flex items-center gap-1 transition-colors"
                      title="Télécharger le fichier PDF"
                    >
                      <Download size={16} />
                      <span className="hidden sm:inline">Télécharger</span>
                    </a>
                    <a
                      href={previewPdfOF.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-bold text-white flex items-center gap-1 transition-colors shadow-xs"
                      title="Ouvrir en plein écran"
                    >
                      <ExternalLink size={16} />
                      <span className="hidden sm:inline">Plein Écran</span>
                    </a>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewPdfOF(null)}
                  className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Quick action bar */}
            {previewPdfOF.pdfUrl && (
              <div className="flex items-center justify-between bg-slate-100 px-4 py-2 border-b border-slate-200 text-xs">
                <span className="font-medium text-slate-700 truncate">
                  Fichier : <strong>{previewPdfOF.pdfFileName || `${previewPdfOF.ofNumber}.pdf`}</strong>
                </span>
                <a
                  href={previewPdfOF.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 hover:text-blue-900 font-bold underline flex items-center gap-1 shrink-0 ml-2"
                >
                  <ExternalLink size={13} />
                  <span>Ouvrir dans le visualiseur natif</span>
                </a>
              </div>
            )}

            <div className="flex-1 bg-slate-100 p-2 overflow-hidden flex flex-col">
              {previewPdfOF.pdfUrl ? (
                <object
                  data={previewPdfOF.pdfUrl}
                  type="application/pdf"
                  className="w-full h-full rounded-lg border border-slate-300 bg-white"
                >
                  <iframe
                    src={previewPdfOF.pdfUrl}
                    title={`PDF ${previewPdfOF.ofNumber}`}
                    className="w-full h-full rounded-lg border-0 bg-white"
                  />
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 bg-white rounded-lg border border-slate-300">
                    <FileText size={48} className="text-red-500" />
                    <div>
                      <p className="font-bold text-slate-900 text-base">Rapport Technique PDF prêt</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm">
                        Sur votre tablette, touchez le bouton ci-dessous pour ouvrir et feuilleter le document PDF en plein écran :
                      </p>
                    </div>
                    <a
                      href={previewPdfOF.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md cursor-pointer transition-all"
                    >
                      <ExternalLink size={16} />
                      <span>Ouvrir le Rapport PDF ({previewPdfOF.ofNumber})</span>
                    </a>
                  </div>
                </object>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 space-y-3">
                  <AlertCircle size={40} className="text-amber-500" />
                  <p className="font-bold text-slate-800 text-sm">Fichier PDF indisponible.</p>
                  <p className="text-xs text-slate-500">Aucun document PDF n'est associé à cet ordre de fabrication.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SEARCHABLE MOLD SELECTOR MODAL ── */}
      {isMoldSearchModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/70 backdrop-blur-2xs justify-end sm:justify-center items-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-t-xl sm:rounded-xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden animate-in slide-in-from-bottom-5">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold">
                  <Box size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Sélectionner un Moule
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMoldSearchModalOpen(false)}
                className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="p-3 border-b border-slate-200 bg-white">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  value={moldSearchTerm}
                  onChange={(e) => setMoldSearchTerm(e.target.value)}
                  placeholder="Search ..."
                  className="w-full min-h-[46px] pl-10 pr-9 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-900 focus:bg-white transition-all shadow-2xs"
                />
                {moldSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setMoldSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Molds List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredSearchMolds.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <Box size={32} className="text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">Aucun moule trouvé</p>
                </div>
              ) : (
                filteredSearchMolds.map((moldItem) => {
                  const isSelected = moldItem.id === selectedMoldId;
                  return (
                    <button
                      key={moldItem.id}
                      type="button"
                      onClick={() => {
                        setSelectedMoldId(moldItem.id);
                        setIsMoldSearchModalOpen(false);
                      }}
                      className={`w-full p-3.5 rounded-lg border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${isSelected
                        ? 'bg-slate-100 border-slate-900 ring-2 ring-slate-900/10'
                        : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm text-slate-900">
                            {moldItem.moldNumber || moldItem.ref}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${moldItem.status === 'In Use' || moldItem.status === 'In Production'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : moldItem.status === 'In Maintenance' ||
                                moldItem.status === 'In Toolroom' ||
                                moldItem.status === 'Requires Repair'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : moldItem.status === 'Exported'
                                  ? 'bg-slate-100 text-slate-700 border-slate-300'
                                  : 'bg-slate-100 text-slate-800 border-slate-300'
                              }`}
                          >
                            {moldItem.status}
                          </span>
                        </div>
                        {moldItem.description && (
                          <p className="text-xs text-slate-600 font-medium truncate mt-1">
                            {moldItem.description}
                          </p>
                        )}
                        {(moldItem.location || moldItem.rackLocation) && (
                          <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-1">
                            <MapPin size={11} className="text-slate-400" />
                            <span>Location : {moldItem.location || moldItem.rackLocation}</span>
                          </p>
                        )}
                      </div>

                      {isSelected && (
                        <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                          <Check size={14} className="stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Bottom Add Action in Search Modal */}
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsMoldSearchModalOpen(false);
                  setIsAddMoldModalOpen(true);
                }}
                className="min-h-[48px] flex-1 py-2.5 px-4 bg-slate-900 hover:bg-black text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Plus size={16} />
                <span>Nouveau Moule</span>
              </button>
              <button
                type="button"
                onClick={() => setIsMoldSearchModalOpen(false)}
                className="min-h-[48px] px-5 py-2.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg text-sm hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD NEW MOLD MODAL ── */}
      {isAddMoldModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/70 backdrop-blur-2xs justify-end sm:justify-center items-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-t-xl sm:rounded-xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden animate-in slide-in-from-bottom-5">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold">
                  <Plus size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Ajouter un Nouveau Moule
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddMoldModalOpen(false)}
                className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200 cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateNewMold} className="flex-1 overflow-y-auto p-4 space-y-4 text-left text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  N° Moule <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder=""
                  value={newMoldData.moldNumber}
                  onChange={(e) => setNewMoldData({ ...newMoldData, moldNumber: e.target.value })}
                  className="w-full min-h-[46px] px-3.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 outline-none focus:border-slate-900 shadow-2xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder=""
                  value={newMoldData.description}
                  onChange={(e) => setNewMoldData({ ...newMoldData, description: e.target.value })}
                  className="w-full min-h-[46px] px-3.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 outline-none focus:border-slate-900 shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Statut Initial
                  </label>
                  <select
                    value={newMoldData.status}
                    onChange={(e) => setNewMoldData({ ...newMoldData, status: e.target.value as MoldStatus })}
                    className="w-full min-h-[46px] px-3 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 outline-none focus:border-slate-900 shadow-2xs"
                  >
                    <option value="In Stock">In Stock</option>
                    <option value="In Use">In Use</option>
                    <option value="In Maintenance">In Maintenance</option>
                    <option value="Exported">Exported</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    placeholder=""
                    value={newMoldData.location}
                    onChange={(e) => setNewMoldData({ ...newMoldData, location: e.target.value })}
                    className="w-full min-h-[46px] px-3.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 outline-none focus:border-slate-900 shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Force de Serrage (Tonnage)
                  </label>
                  <input
                    type="text"
                    placeholder=""
                    value={newMoldData.clampingForceRange}
                    onChange={(e) => setNewMoldData({ ...newMoldData, clampingForceRange: e.target.value })}
                    className="w-full min-h-[46px] px-3.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 outline-none focus:border-slate-900 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Poids (KG)
                  </label>
                  <input
                    type="text"
                    placeholder=""
                    value={newMoldData.othersWeight}
                    onChange={(e) => setNewMoldData({ ...newMoldData, othersWeight: e.target.value })}
                    className="w-full min-h-[46px] px-3.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 outline-none focus:border-slate-900 shadow-2xs"
                  />
                </div>
              </div>

              {/* Checkboxes for technical specs */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                <span className="block font-mono font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                  Caractéristiques Techniques
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="min-h-[40px] flex items-center gap-2.5 font-semibold text-slate-800 select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newMoldData.plateType2}
                      onChange={(e) => setNewMoldData({ ...newMoldData, plateType2: e.target.checked })}
                      className="w-4 h-4 rounded text-slate-900 border-slate-300 focus:ring-slate-900"
                    />
                    <span>2 Plate</span>
                  </label>

                  <label className="min-h-[40px] flex items-center gap-2.5 font-semibold text-slate-800 select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newMoldData.plateType3}
                      onChange={(e) => setNewMoldData({ ...newMoldData, plateType3: e.target.checked })}
                      className="w-4 h-4 rounded text-slate-900 border-slate-300 focus:ring-slate-900"
                    />
                    <span>3 Plate</span>
                  </label>

                  <label className="min-h-[40px] flex items-center gap-2.5 font-semibold text-slate-800 select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newMoldData.ewocon}
                      onChange={(e) => setNewMoldData({ ...newMoldData, ewocon: e.target.checked })}
                      className="w-4 h-4 rounded text-slate-900 border-slate-300 focus:ring-slate-900"
                    />
                    <span>EWOCON</span>
                  </label>

                  <label className="min-h-[40px] flex items-center gap-2.5 font-semibold text-slate-800 select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newMoldData.dme}
                      onChange={(e) => setNewMoldData({ ...newMoldData, dme: e.target.checked })}
                      className="w-4 h-4 rounded text-slate-900 border-slate-300 focus:ring-slate-900"
                    />
                    <span>DME</span>
                  </label>

                  <label className="min-h-[40px] flex items-center gap-2.5 font-semibold text-slate-800 select-none cursor-pointer col-span-2">
                    <input
                      type="checkbox"
                      checked={newMoldData.flatNozzle}
                      onChange={(e) => setNewMoldData({ ...newMoldData, flatNozzle: e.target.checked })}
                      className="w-4 h-4 rounded text-slate-900 border-slate-300 focus:ring-slate-900"
                    />
                    <span>Flat Nozzle</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Commentaires
                </label>
                <textarea
                  rows={2}
                  placeholder=""
                  value={newMoldData.comment}
                  onChange={(e) => setNewMoldData({ ...newMoldData, comment: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 outline-none focus:border-slate-900 shadow-2xs"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={creatingMold}
                  className="min-h-[48px] flex-1 py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {creatingMold ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  <span>Save Moule</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddMoldModalOpen(false)}
                  className="min-h-[48px] px-5 py-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: REMPLIR FICHE MAINTENANCE (MOBILE / TABLET) ── */}
      {isMaintenanceModalOpen && selectedMold && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-2xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-t-xl sm:rounded-xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold">
                  <Wrench size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                    Fiche Maintenance Outillage
                  </h3>
                  <p className="text-xs font-mono font-bold text-slate-700">
                    Moule : {selectedMold.moldNumber || selectedMold.ref} {selectedMold.description ? `(${selectedMold.description})` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMaintenanceModalOpen(false)}
                className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form
              onSubmit={handleSaveMaintenanceDetails}
              className="p-5 space-y-4 overflow-y-auto flex-1 text-xs"
            >
              {/* Date */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Date d'intervention <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={maintenanceFormData.date}
                  onChange={(e) => setMaintenanceFormData((prev) => ({ ...prev, date: e.target.value }))}
                  required
                  className="w-full min-h-[46px] px-3.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 outline-none focus:border-slate-900 shadow-2xs"
                />
              </div>

              {/* Lieu de Réparation */}
              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  Lieu d'intervention / Réparation <span className="text-red-600">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMaintenanceFormData((prev) => ({ ...prev, repairLocation: 'local' }))}
                    className={`min-h-[48px] px-4 rounded-lg font-bold text-xs border transition-all flex items-center justify-center gap-2 cursor-pointer ${maintenanceFormData.repairLocation === 'local'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                  >
                    <Building2 size={16} />
                    <span>Atelier Local</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMaintenanceFormData((prev) => ({ ...prev, repairLocation: 'external' }))}
                    className={`min-h-[48px] px-4 rounded-lg font-bold text-xs border transition-all flex items-center justify-center gap-2 cursor-pointer ${maintenanceFormData.repairLocation === 'external'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                  >
                    <ExternalLink size={16} />
                    <span>Fournisseur Externe</span>
                  </button>
                </div>
              </div>

              {/* External fields: Supplier & Devis */}
              {maintenanceFormData.repairLocation === 'external' && (
                <div className="p-4 bg-amber-50/70 border border-amber-300 rounded-lg space-y-3.5 animate-in fade-in duration-150">
                  <div>
                    <label className="block font-bold text-amber-950 mb-1 text-[11px] uppercase tracking-wider font-mono">
                      Nom du Prestataire / Fournisseur <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Atelier Usinage & Rectification SA..."
                      value={maintenanceFormData.supplierName}
                      onChange={(e) => setMaintenanceFormData((prev) => ({ ...prev, supplierName: e.target.value }))}
                      className="w-full min-h-[46px] px-3.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 outline-none focus:border-slate-900 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-[11px] uppercase tracking-wider font-mono">
                      Devis / Bon de commande (Document technique)
                    </label>
                    {maintenanceFormData.devisUrl ? (
                      <div className="flex items-center justify-between p-3 bg-white border border-slate-300 rounded-lg">
                        <a
                          href={maintenanceFormData.devisUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-slate-900 truncate flex items-center gap-2 hover:underline"
                        >
                          <FileText size={16} className="text-slate-700" />
                          <span>Voir le document joint</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => setMaintenanceFormData((prev) => ({ ...prev, devisUrl: '' }))}
                          className="w-8 h-8 flex items-center justify-center text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Supprimer le document"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <label className="min-h-[48px] flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 hover:border-slate-500 rounded-lg bg-white cursor-pointer transition-colors text-xs font-bold text-slate-800">
                        {uploadingDevis ? (
                          <RefreshCw size={16} className="animate-spin text-slate-600" />
                        ) : (
                          <Upload size={16} className="text-slate-600" />
                        )}
                        <span>{uploadingDevis ? 'Téléversement en cours...' : 'Téléverser devis / bon (PDF ou Photo)'}</span>
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          disabled={uploadingDevis}
                          onChange={handleMaintenanceDevisUpload}
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* Description du problème */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Description du problème / Panne <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Décrivez la nature du défaut, bavure, trace d'usure, empreinte abîmée..."
                  value={maintenanceFormData.issueDescription}
                  onChange={(e) => setMaintenanceFormData((prev) => ({ ...prev, issueDescription: e.target.value }))}
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 outline-none focus:border-slate-900 shadow-2xs"
                />
              </div>

              {/* Repeatable Actions Performed */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">
                    Actions &amp; Travaux réalisés
                  </label>
                  <button
                    type="button"
                    onClick={handleAddAction}
                    className="min-h-[36px] px-2.5 py-1 text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus size={14} />
                    <span>+ Ajouter action</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {maintenanceFormData.actionsPerformed.map((action, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-6 text-center text-xs font-mono font-bold text-slate-400 select-none">
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        placeholder={`Action ou opération effectuée ${idx + 1}...`}
                        value={action}
                        onChange={(e) => handleActionChange(idx, e.target.value)}
                        className="flex-1 min-h-[42px] px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 outline-none focus:border-slate-900 shadow-2xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveAction(idx)}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Supprimer cette action"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Photo de l'intervention */}
              <div className="space-y-2 pt-1">
                <label className="block font-bold text-slate-800">
                  Photo de l'intervention / Empreinte
                </label>
                {maintenanceFormData.imageUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-slate-300 bg-slate-50 flex items-center justify-center">
                    <img
                      src={maintenanceFormData.imageUrl}
                      alt="Photo intervention outillage"
                      className="w-full max-h-48 object-contain"
                    />
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-2xs p-1 rounded-lg">
                      <a
                        href={maintenanceFormData.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-white hover:text-slate-300 transition-colors"
                        title="Agrandir la photo"
                      >
                        <ExternalLink size={16} />
                      </a>
                      <button
                        type="button"
                        onClick={() => setMaintenanceFormData((prev) => ({ ...prev, imageUrl: '' }))}
                        className="p-1.5 text-white hover:text-red-400 transition-colors cursor-pointer"
                        title="Supprimer la photo"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-300 hover:border-slate-500 rounded-lg bg-slate-50 cursor-pointer transition-colors text-center">
                    {uploadingMaintenanceImage ? (
                      <RefreshCw size={24} className="animate-spin text-slate-600 mb-1" />
                    ) : (
                      <Camera size={24} className="text-slate-600 mb-1" />
                    )}
                    <span className="text-xs font-bold text-slate-900">
                      {uploadingMaintenanceImage ? 'Téléversement en cours...' : 'Prendre ou importer une photo'}
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5 font-mono">Caméra tablette ou fichier image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingMaintenanceImage}
                      onChange={handleMaintenancePhotoUpload}
                    />
                  </label>
                )}
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-200 space-y-2.5 shrink-0">
                <button
                  type="submit"
                  disabled={savingMaintenanceDetails}
                  className="min-h-[48px] w-full py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
                >
                  {savingMaintenanceDetails ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  <span>Enregistrer les Détails</span>
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMaintenanceModalOpen(false);
                      handleOpenCloseModal();
                    }}
                    className="min-h-[48px] py-2.5 px-3 bg-slate-900 hover:bg-black text-white font-bold rounded-lg shadow-xs text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 size={16} />
                    <span>Clôturer Maintenance</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsMaintenanceModalOpen(false)}
                    className="min-h-[48px] py-2.5 px-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-xs text-center transition-colors cursor-pointer"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CLOTURER LA MAINTENANCE (MOBILE / TABLET) ── */}
      {isCloseMaintenanceModalOpen && selectedMold && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-2xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-t-xl sm:rounded-xl p-5 shadow-2xl border border-slate-300 animate-in fade-in slide-in-from-bottom-6 duration-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 border border-slate-300 flex items-center justify-center font-bold">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                    Clôturer la Maintenance Moule
                  </h3>
                  <p className="text-xs font-mono font-bold text-slate-600">
                    Moule N° : {selectedMold.moldNumber || selectedMold.ref}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCloseMaintenanceModalOpen(false)}
                className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 font-medium">
              Veuillez sélectionner le nouveau statut du moule une fois les travaux terminés :
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => setCloseStatusChoice('In Stock')}
                className={`w-full min-h-[48px] p-3.5 rounded-lg border text-left transition-all flex items-center justify-between cursor-pointer ${closeStatusChoice === 'In Stock'
                  ? 'border-slate-900 bg-slate-100 shadow-xs'
                  : 'border-slate-300 bg-white hover:bg-slate-50'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${closeStatusChoice === 'In Stock' ? 'border-slate-900 bg-slate-900' : 'border-slate-400'
                      }`}
                  >
                    {closeStatusChoice === 'In Stock' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">En Stock (Rayonnage outillage)</span>
                  </div>
                </div>
              </button>

              {closeStatusChoice === 'In Stock' && (
                <div className="pl-3 pr-1 pt-1 animate-in fade-in duration-150">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Emplacement / Rack N° :
                  </label>
                  <input
                    type="text"
                    value={closingLocationInput}
                    onChange={(e) => setClosingLocationInput(e.target.value)}
                    placeholder="Ex: R-04, E-12..."
                    className="w-full min-h-[44px] px-3 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-slate-900 shadow-2xs"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => setCloseStatusChoice('In Use')}
                className={`w-full min-h-[48px] p-3.5 rounded-lg border text-left transition-all flex items-center justify-between cursor-pointer ${closeStatusChoice === 'In Use'
                  ? 'border-slate-900 bg-slate-100 shadow-xs'
                  : 'border-slate-300 bg-white hover:bg-slate-50'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${closeStatusChoice === 'In Use' ? 'border-slate-900 bg-slate-900' : 'border-slate-400'
                      }`}
                  >
                    {closeStatusChoice === 'In Use' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">En Production (Monté sur presse)</span>
                  </div>
                </div>
              </button>

              {closeStatusChoice === 'In Use' && (
                <div className="pl-3 pr-1 pt-1 animate-in fade-in duration-150 relative">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Presse cible (Rechercher par nom ou numéro INJ) :
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={closingInUseMachineSearch || closingLocationInput}
                      onChange={(e) => {
                        setClosingInUseMachineSearch(e.target.value);
                        setClosingLocationInput(e.target.value);
                        setClosingInUseMachineDropdown(true);
                      }}
                      onFocus={() => {
                        setClosingInUseMachineSearch('');
                        setClosingInUseMachineDropdown(true);
                      }}
                      placeholder="Search..."
                      className="w-full min-h-[44px] px-3 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-slate-900 shadow-2xs"
                    />
                    {closingInUseMachineDropdown && (() => {
                      const q = closingInUseMachineSearch.toLowerCase();
                      const filtered = machines.filter(
                        (m: any) =>
                          (m.name || '').toLowerCase().includes(q) ||
                          (m.location || '').toLowerCase().includes(q) ||
                          (m.number || m.siteNumber || '').toLowerCase().includes(q)
                      );
                      return filtered.length > 0 ? (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-xl max-h-44 overflow-y-auto">
                          {filtered.map((m: any) => {
                            const displayName = m.number || m.name;
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setClosingLocationInput(displayName);
                                  setClosingInUseMachineSearch('');
                                  setClosingInUseMachineDropdown(false);
                                }}
                                className="w-full px-3 py-2.5 text-left flex items-center justify-between hover:bg-slate-50 border-b border-slate-100 last:border-0 cursor-pointer"
                              >
                                <div>
                                  <span className="text-xs font-bold text-slate-900 block">{displayName}</span>
                                  <span className="text-[11px] text-slate-500 font-mono">
                                    {m.name && m.name !== displayName ? `${m.name} ` : ''}
                                    {m.location ? `(${m.location})` : ''}
                                  </span>
                                </div>
                                {closingLocationInput === displayName && (
                                  <CheckCircle2 size={16} className="text-slate-900 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setCloseStatusChoice('Exported')}
                className={`w-full min-h-[48px] p-3.5 rounded-lg border text-left transition-all flex items-center justify-between cursor-pointer ${closeStatusChoice === 'Exported'
                  ? 'border-slate-900 bg-slate-100 shadow-xs'
                  : 'border-slate-300 bg-white hover:bg-slate-50'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${closeStatusChoice === 'Exported' ? 'border-slate-900 bg-slate-900' : 'border-slate-400'
                      }`}
                  >
                    {closeStatusChoice === 'Exported' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">Exporté (Expédié chez tiers/client)</span>
                  </div>
                </div>
              </button>

              {closeStatusChoice === 'Exported' && (
                <div className="pl-3 pr-1 pt-1 space-y-2.5 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Date d'exportation :
                    </label>
                    <input
                      type="date"
                      value={moldExportDateInput}
                      onChange={(e) => setMoldExportDateInput(e.target.value)}
                      className="w-full min-h-[44px] px-3 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-slate-900 shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Destination / Client :
                    </label>
                    <input
                      type="text"
                      value={closingLocationInput}
                      onChange={(e) => setClosingLocationInput(e.target.value)}
                      placeholder="Ex: Client XYZ, Usine B..."
                      className="w-full min-h-[44px] px-3 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-slate-900 shadow-2xs"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center gap-3">
              <button
                type="button"
                disabled={closingMaintenance}
                onClick={handleConfirmCloseMaintenance}
                className="min-h-[48px] flex-1 py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 text-xs disabled:opacity-50 cursor-pointer"
              >
                {closingMaintenance ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                <span>Confirmer Clôture</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCloseMaintenanceModalOpen(false)}
                className="min-h-[48px] px-5 py-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: OFFLINE OUTBOX & SYNC QUEUE ── */}
      {isOfflineQueueModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-300 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}
                >
                  {isOnline ? <Wifi size={20} /> : <WifiOff size={20} />}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 leading-tight">
                    File d'Attente &amp; Synchronisation
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {isOnline ? 'Réseau usine connecté' : 'Mode hors-ligne atelier (Stockage local)'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOfflineQueueModalOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Offline storage status card */}
            <div
              className={`p-3.5 rounded-lg border text-xs flex items-center justify-between ${isOnline
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}
            >
              <div>
                <span className="font-bold block">
                  {isOnline ? 'Connexion Réseau Opérationnelle' : 'Réseau Atelier Indisponible'}
                </span>
                <span className="text-[11px] opacity-80 font-mono">
                  {offlineQueue.length === 0
                    ? 'Aucun élément en attente de synchronisation.'
                    : `${offlineQueue.length} élément(s) en attente de transmission.`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  testConnection().then((online) => {
                    showTabletToast(
                      online ? 'Connexion rétablie' : 'Toujours déconnecté',
                      online ? 'Réseau usine actif' : 'Vérifiez la borne Wi-Fi atelier'
                    );
                  });
                }}
                className="min-h-[36px] px-3 bg-white text-slate-900 font-bold rounded-md border border-slate-300 flex items-center gap-1.5 shadow-2xs cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <RefreshCw size={12} />
                <span>Tester</span>
              </button>
            </div>

            {/* Queued items list */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {offlineQueue.length === 0 ? (
                <div className="py-8 text-center text-slate-400 space-y-1">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-600/70" />
                  <p className="text-xs font-bold text-slate-700">Tout est à jour !</p>
                  <p className="text-[11px] text-slate-500">Tous vos rapports et demandes sont synchronisés avec la base centrale GMAO.</p>
                </div>
              ) : (
                offlineQueue.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-start justify-between gap-2 text-xs"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${item.type === 'report'
                            ? 'bg-slate-200 text-slate-800 border-slate-300'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                            }`}
                        >
                          {item.type === 'report' ? 'Rapport PV' : 'Demande DI'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="font-bold text-slate-900">{item.summary}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        removeFromOfflineQueue(item.id);
                        setOfflineQueue(getOfflineQueue());
                        showTabletToast('Élément retiré de la file locale');
                      }}
                      className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                      title="Supprimer de la file"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-200 flex gap-3">
              <button
                type="button"
                onClick={() => setIsOfflineQueueModalOpen(false)}
                className="min-h-[48px] flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold rounded-lg text-xs cursor-pointer transition-colors"
              >
                Fermer
              </button>
              {offlineQueue.length > 0 && (
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={handleManualSync}
                  className="min-h-[48px] flex-1 py-2.5 bg-slate-900 hover:bg-black disabled:opacity-50 text-white font-bold rounded-lg text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  <span>Synchroniser ({offlineQueue.length})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DI Request Detail Modal in Tablet */}
      {diSelectedDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-300 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-extrabold text-sm sm:text-base text-slate-900 bg-slate-100 border border-slate-300 px-3 py-1 rounded-lg">
                  {diSelectedDetail.refIR}
                </span>
                {diSelectedDetail.status === 'Waiting' ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                    <Clock size={12} className="text-amber-700" /> En attente
                  </span>
                ) : diSelectedDetail.status === 'Validated' ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-300 inline-flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-emerald-700" /> Validée
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-900 border border-rose-300 inline-flex items-center gap-1">
                    <XCircle size={12} className="text-rose-700" /> Rejetée
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDiSelectedDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 font-medium block">Date de Déclaration</span>
                  <span className="font-mono font-bold text-slate-900">{diSelectedDetail.date}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Équipement / Cible</span>
                  <span className="font-bold text-slate-900 truncate block">{diSelectedDetail.equipmentName || 'Non spécifié'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Demandeur</span>
                  <span className="font-bold text-slate-900 block truncate">
                    {diSelectedDetail.requester} {diSelectedDetail.requesterRole && `(${diSelectedDetail.requesterRole})`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Priorité</span>
                  <span className="font-bold text-slate-900">{diSelectedDetail.priority || 'Normale'}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-medium block mb-1">Description de l'Anomalie / Problème</span>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 leading-relaxed font-medium max-h-40 overflow-y-auto">
                  {diSelectedDetail.problemDescription}
                </div>
              </div>

              {diSelectedDetail.status === 'Validated' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                  <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-700" />
                    <span>Demande validée par le Responsable Technique</span>
                  </div>
                  {diSelectedDetail.validatedBy && (
                    <div className="text-slate-600">
                      Validé par : <strong>{diSelectedDetail.validatedBy}</strong> {diSelectedDetail.validatedAt && `le ${diSelectedDetail.validatedAt}`}
                    </div>
                  )}
                  {diSelectedDetail.relatedOTRef && (
                    <div className="text-slate-700 font-mono font-bold pt-0.5">
                      Ordre de Travail généré : <span className="text-emerald-900 font-extrabold">{diSelectedDetail.relatedOTRef}</span>
                    </div>
                  )}
                </div>
              )}

              {diSelectedDetail.status === 'Rejected' && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                  <div className="font-bold text-rose-950 flex items-center gap-1.5">
                    <XCircle size={14} className="text-rose-700" />
                    <span>Demande rejetée</span>
                  </div>
                  {diSelectedDetail.rejectionReason && (
                    <div className="text-rose-900 font-medium">
                      Motif : {diSelectedDetail.rejectionReason}
                    </div>
                  )}
                  {diSelectedDetail.rejectedBy && (
                    <div className="text-slate-600 text-[11px]">
                      Par {diSelectedDetail.rejectedBy} {diSelectedDetail.rejectedAt && `le ${diSelectedDetail.rejectedAt}`}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setDiSelectedDetail(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
