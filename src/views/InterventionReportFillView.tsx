import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Wrench,
  Box,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  Image as ImageIcon,
  Check,
  ChevronDown,
  ArrowLeft,
  X,
  Activity,
  FileText,
  AlertCircle,
  ShieldAlert,
  Cpu,
  Layers,
  Sparkles,
  ShieldCheck,
  HelpCircle,
  Boxes,
} from 'lucide-react';
import {
  InterventionReport,
  StockItem,
  MaintenanceCategory,
  StockTakeItem,
  Mold,
  Machine,
  AppUser,
} from '../types/gmao';
import { calculateReadingStats, cn, generateNextReportRef } from '../lib/gmaoUtils';
import { ThermoplasticsLogo } from '../components/ThermoplasticsLogo';

interface InterventionReportFillViewProps {
  stockItems: StockItem[];
  molds?: Mold[];
  machines?: Machine[];
  existingReports?: InterventionReport[];
  currentUser?: AppUser;
  defaultValues?: Partial<InterventionReport>;
  onSave: (report: InterventionReport) => void;
  onCancel: () => void;
}

export const InterventionReportFillView: React.FC<InterventionReportFillViewProps> = ({
  stockItems,
  molds = [],
  machines = [],
  existingReports = [],
  currentUser,
  defaultValues,
  onSave,
  onCancel,
}) => {
  // Category state (Machine vs Mold vs Other)
  const [category, setCategory] = useState<MaintenanceCategory>(
    defaultValues?.category || 'Machine'
  );

  // Common Header Identifiers
  const [reportRef, setReportRef] = useState<string>(() => {
    if (defaultValues?.refReport) return defaultValues.refReport;
    return generateNextReportRef(existingReports || [], defaultValues?.date || new Date().toISOString());
  });
  const [otRef, setOtRef] = useState(defaultValues?.refOT || '');
  const [irRef, setIrRef] = useState(defaultValues?.refIR || '');
  const [requestedBy, setRequestedBy] = useState(
    defaultValues?.requestedBy || currentUser?.name || ''
  );
  const [assignedTo, setAssignedTo] = useState(
    defaultValues?.assignedTo || currentUser?.name || ''
  );
  const [filledBy, setFilledBy] = useState(
    defaultValues?.filledBy || currentUser?.name || ''
  );
  const [date, setDate] = useState(
    defaultValues?.date || new Date().toISOString().split('T')[0]
  );
  const [startingTime, setStartingTime] = useState(
    defaultValues?.startingTime || new Date().toISOString().slice(0, 16).replace('T', ' ')
  );
  const [finishedTime, setFinishedTime] = useState(
    defaultValues?.finishedTime || new Date().toISOString().slice(0, 16).replace('T', ' ')
  );
  const [priority, setPriority] = useState(defaultValues?.priority || 'High');

  // ───────────────────────────────────────────────────────────────────────────
  // CATEGORY 1: MACHINE SPECIFIC FIELDS
  // ───────────────────────────────────────────────────────────────────────────
  const initialMachine = useMemo(() => {
    if (defaultValues?.equipmentId) {
      const found = machines.find((m) => m.id === defaultValues.equipmentId);
      if (found) return found;
    }
    if (defaultValues?.equipmentName) {
      const found = machines.find(
        (m) =>
          m.name === defaultValues.equipmentName ||
          m.number === defaultValues.equipmentName ||
          (m.name && m.name.includes(defaultValues.equipmentName!)) ||
          (m.number && defaultValues.equipmentName!.includes(m.number))
      );
      if (found) return found;
    }
    return machines[0] || null;
  }, [machines, defaultValues]);

  const [selectedMachineId, setSelectedMachineId] = useState<string>(
    defaultValues?.equipmentId || initialMachine?.id || ''
  );

  const currentMachineObj = useMemo(() => {
    return machines.find((m) => m.id === selectedMachineId) || initialMachine;
  }, [machines, selectedMachineId, initialMachine]);

  const lastRecordedHours = useMemo(() => {
    return currentMachineObj?.currentHours ?? currentMachineObj?.totalOperatingHours ?? 0;
  }, [currentMachineObj]);

  const [meterReadingInput, setMeterReadingInput] = useState<string>(
    defaultValues?.meterReadingHours !== undefined ? String(defaultValues.meterReadingHours) : ''
  );
  const [meterWarningConfirmed, setMeterWarningConfirmed] = useState<boolean>(
    defaultValues?.meterReadingConfirmedWarning ?? false
  );
  const [meterReadingError, setMeterReadingError] = useState<string | null>(null);

  const readingNum = parseFloat(meterReadingInput);
  const hasReadingInput = meterReadingInput.trim() !== '' && !isNaN(readingNum);
  const readingStats = useMemo(() => {
    if (!hasReadingInput) return null;
    return calculateReadingStats(lastRecordedHours, currentMachineObj?.lastMeterReadingDate, readingNum);
  }, [hasReadingInput, lastRecordedHours, currentMachineObj?.lastMeterReadingDate, readingNum]);

  // Machine Diagnosis & Failure Causes
  const [machineCause, setMachineCause] = useState(defaultValues?.cause || 'Mechanical');
  const [machineSubCause, setMachineSubCause] = useState(
    defaultValues?.subCause || ''
  );
  const [machineStatusAfter, setMachineStatusAfter] = useState<'Running' | 'Stopped'>('Running');

  // ───────────────────────────────────────────────────────────────────────────
  // CATEGORY 2: MOLD / TOOLING SPECIFIC FIELDS (Direct user logic)
  // ───────────────────────────────────────────────────────────────────────────
  const [reportMoldId, setReportMoldId] = useState<string>(
    defaultValues?.moldId || molds[0]?.id || ''
  );
  const [reportMoldNumber, setReportMoldNumber] = useState<string>(
    defaultValues?.moldNumber || molds[0]?.moldNumber || molds[0]?.ref || 'MLD-405'
  );
  const [moldRepairLocation, setMoldRepairLocation] = useState<'local' | 'external'>(
    defaultValues?.moldRepairLocation || 'local'
  );
  const [moldSupplierName, setMoldSupplierName] = useState(
    defaultValues?.moldSupplierName || ''
  );
  const [moldDevisRef, setMoldDevisRef] = useState('');
  const [moldStatusAfterRepair, setMoldStatusAfterRepair] = useState<'In Stock' | 'In Use'>(
    defaultValues?.moldStatusAfterRepair === 'In Use' ? 'In Use' : 'In Stock'
  );
  const [affectedCavities, setAffectedCavities] = useState(
    defaultValues?.affectedCavities || ''
  );
  const [moldIssueDescription, setMoldIssueDescription] = useState(
    defaultValues?.issueDescription || defaultValues?.subCause || ''
  );
  const [moldImageUrl, setMoldImageUrl] = useState<string>(
    defaultValues?.imageUrl || defaultValues?.moldToolingPhotoUrl || ''
  );
  const [moldSearchTerm, setMoldSearchTerm] = useState('');
  const [isMoldDropdownOpen, setIsMoldDropdownOpen] = useState(false);

  // ───────────────────────────────────────────────────────────────────────────
  // CATEGORY 3: OTHER (UTILITIES / FACILITIES / AUXILIARY) SPECIFIC FIELDS
  // ───────────────────────────────────────────────────────────────────────────
  const [auxiliaryEquipmentType, setAuxiliaryEquipmentType] = useState(
    defaultValues?.auxiliaryEquipmentType || 'Chiller System / Chilled Water Unit'
  );
  const [facilityLocation, setFacilityLocation] = useState(
    defaultValues?.facilityLocation || ''
  );
  const [otherCause, setOtherCause] = useState(defaultValues?.cause || 'Pneumatic Leak / Pressure Drop');
  const [otherSubCause, setOtherSubCause] = useState(defaultValues?.subCause || '');
  const [preventiveMeasures, setPreventiveMeasures] = useState(
    defaultValues?.preventiveMeasures || ''
  );
  const [safetyObservations, setSafetyObservations] = useState(
    defaultValues?.safetyObservations || ''
  );
  const [otherStatusAfter, setOtherStatusAfter] = useState<'Operational' | 'Standby' | 'Under Observation'>('Operational');

  // ───────────────────────────────────────────────────────────────────────────
  // COMMON INTERVENTION ACTIONS & DIFFICULTIES
  // ───────────────────────────────────────────────────────────────────────────
  const [actions, setActions] = useState<string[]>(
    defaultValues?.actions && defaultValues.actions.length > 0
      ? defaultValues.actions
      : []
  );
  const [currentActionInput, setCurrentActionInput] = useState('');

  const [difficulties, setDifficulties] = useState<string[]>(
    defaultValues?.difficulties || []
  );
  const [currentDifficultyInput, setCurrentDifficultyInput] = useState('');

  // ───────────────────────────────────────────────────────────────────────────
  // STOCK ITEMS (PDR PRÉLEVÉES DU MAGASIN)
  // ───────────────────────────────────────────────────────────────────────────
  const [stockTaken, setStockTaken] = useState<StockTakeItem[]>(
    defaultValues?.stockTaken || []
  );
  const [selectedStockItemId, setSelectedStockItemId] = useState<string>(
    stockItems[0]?.id || ''
  );
  const [stockQty, setStockQty] = useState<number>(1);
  const [partSearchQuery, setPartSearchQuery] = useState('');

  // ───────────────────────────────────────────────────────────────────────────
  // FINANCIAL CALCULATION: STRICTLY STOCK PARTS ONLY (No arbitrary surcharge, 0 DT if none)
  // ───────────────────────────────────────────────────────────────────────────
  const partsCost = useMemo(() => {
    return stockTaken.reduce((acc, it) => acc + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
  }, [stockTaken]);

  // Exact total cost is what was consumed from stock. No arbitrary labor or TVA charges.
  const totalCost = partsCost;

  // Filtered molds
  const filteredMolds = useMemo(() => {
    if (!moldSearchTerm.trim()) return molds;
    const q = moldSearchTerm.toLowerCase();
    return molds.filter(
      (m) =>
        (m.moldNumber || m.ref || '').toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q) ||
        (m.customer || '').toLowerCase().includes(q)
    );
  }, [molds, moldSearchTerm]);

  // Actions handling
  const handleAddAction = () => {
    if (currentActionInput.trim()) {
      setActions([...actions, currentActionInput.trim()]);
      setCurrentActionInput('');
    }
  };

  const handleRemoveAction = (idx: number) => {
    setActions(actions.filter((_, i) => i !== idx));
  };

  // Difficulties handling
  const handleAddDifficulty = () => {
    if (currentDifficultyInput.trim()) {
      setDifficulties([...difficulties, currentDifficultyInput.trim()]);
      setCurrentDifficultyInput('');
    }
  };

  const handleRemoveDifficulty = (idx: number) => {
    setDifficulties(difficulties.filter((_, i) => i !== idx));
  };

  // Stock items handling
  const handleAddStock = () => {
    const foundItem = stockItems.find((s) => s.id === selectedStockItemId);
    if (!foundItem) return;

    const qtyToAdd = Number(stockQty) || 1;
    const existingIdx = stockTaken.findIndex((s) => s.itemId === foundItem.id);
    if (existingIdx >= 0) {
      const updated = [...stockTaken];
      updated[existingIdx].qty += qtyToAdd;
      setStockTaken(updated);
    } else {
      setStockTaken([
        ...stockTaken,
        {
          id: `st-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          itemId: foundItem.id,
          itemName: foundItem.name,
          partNumber: foundItem.partNumber,
          qty: qtyToAdd,
          unitPrice: foundItem.unitPrice,
        },
      ]);
    }
    setStockQty(1);
  };

  const handleRemoveStock = (id: string) => {
    setStockTaken(stockTaken.filter((item) => item.id !== id));
  };

  // Photo upload handling for Mold / Machine
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMoldImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // SAVE & CLOSE INTERVENTION REPORT
  const handleSave = () => {
    // Machine category validation for meter reading (Optional)
    if (category === 'Machine' && hasReadingInput) {
      if (readingStats?.isLowerThanLast) {
        setMeterReadingError(
          `Impossible de valider : la valeur saisie (${readingNum} h) est inférieure au dernier relevé (${lastRecordedHours} h).`
        );
        return;
      }
      if (readingStats?.exceedsCalendarHours && !meterWarningConfirmed) {
        setMeterReadingError(
          `Avertissement : le delta (+${readingStats.deltaHours} h) dépasse le temps calendaire écoulé (${readingStats.elapsedCalendarHours} h). Veuillez cocher la confirmation d'exactitude.`
        );
        return;
      }
    }

    // Mold category validation
    if (category === 'Mold' && !reportMoldId) {
      alert('Veuillez sélectionner un outillage / moule concerné.');
      return;
    }

    const calculatedDuration = 60; // default duration

    const newReport: InterventionReport = {
      id: defaultValues?.id || `rep-${Date.now()}`,
      date,
      refReport: reportRef || defaultValues?.refReport || generateNextReportRef(existingReports || [], date),
      refOT: otRef,
      refIR: irRef,
      category,
      priority,
      requestedBy,
      assignedTo,
      filledBy,
      startingTime,
      finishedTime,
      durationMinutes: calculatedDuration,
      actions: actions.length > 0 ? actions : ['Maintenance exécutée selon spécifications'],
      difficulties,
      stockTaken,
      status: 'Validated',

      // Exact Cost: ONLY what was consumed from stock (0 DT if empty)
      sparePartsCost: partsCost,
      totalCost,
      laborCost: 0,
      laborHours: 0,
      externalCost: 0,

      // Specific fields based on category:
      ...(category === 'Machine'
        ? {
            cause: machineCause,
            subCause: machineSubCause || 'Diagnostic standard presse',
            equipmentId: currentMachineObj?.id,
            equipmentName: currentMachineObj?.name || currentMachineObj?.number,
            meterReadingHours: hasReadingInput ? readingNum : undefined,
            meterReadingConfirmedWarning: meterWarningConfirmed,
            equipmentStatusAfterRepair: machineStatusAfter,
          }
        : category === 'Mold'
        ? {
            cause: 'Moule / Outillage',
            subCause: moldIssueDescription || 'Maintenance et ajustage outillage',
            issueDescription: moldIssueDescription,
            moldId: reportMoldId,
            moldNumber: reportMoldNumber,
            equipmentName: reportMoldNumber,
            moldRepairLocation,
            moldSupplierName: moldRepairLocation === 'external' ? moldSupplierName : undefined,
            moldStatusAfterRepair,
            affectedCavities,
            imageUrl: moldImageUrl || undefined,
            moldToolingPhotoUrl: moldImageUrl || undefined,
            equipmentStatusAfterRepair: moldStatusAfterRepair,
          }
        : {
            cause: otherCause,
            subCause: otherSubCause || auxiliaryEquipmentType,
            auxiliaryEquipmentType,
            facilityLocation,
            equipmentName: `${auxiliaryEquipmentType} (${facilityLocation || 'Atelier'})`,
            preventiveMeasures,
            safetyObservations,
            equipmentStatusAfterRepair: otherStatusAfter,
          }),
    };

    onSave(newReport);
  };

  return (
    <div className="p-4 sm:p-8 max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-200 font-sans">
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* OFFICIAL HEADER WITH THERMOPLASTICS TUNISIA LOGO */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-300 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          {/* Logo prominently displayed */}
          <ThermoplasticsLogo size="md" />
          <div className="text-[11px] text-neutral-500 font-mono pt-1">
            Système GMAO Industriel · Procès-Verbal Officiel de Clôture d&apos;Intervention
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <button
            onClick={onCancel}
            type="button"
            className="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Annuler</span>
          </button>
          <button
            onClick={handleSave}
            type="button"
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Valider &amp; Clôturer le Rapport</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* CATEGORY SELECTOR TABS (Distinct reports for the 3 categories) */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-neutral-300 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 pb-3">
          <div>
            <h2 className="text-base font-black text-neutral-900 tracking-tight">
              Type de Rapport selon la Catégorie d&apos;Équipement
            </h2>
            <p className="text-xs text-neutral-500">
              Chaque catégorie dispose d&apos;un formulaire technique adapté à son métier et ses exigences
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full border border-neutral-200 self-start sm:self-auto">
            Catégorie : <strong className="text-blue-700">{category}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* TAB 1: MACHINE */}
          <button
            type="button"
            onClick={() => setCategory('Machine')}
            className={cn(
              'p-4 rounded-2xl border-2 text-left transition-all flex items-start gap-3.5 cursor-pointer',
              category === 'Machine'
                ? 'bg-blue-50/80 border-blue-600 text-blue-950 shadow-sm ring-2 ring-blue-500/20'
                : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:border-neutral-300'
            )}
          >
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold',
                category === 'Machine' ? 'bg-blue-600 text-white' : 'bg-neutral-200 text-neutral-700'
              )}
            >
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm">Presse d&apos;Injection (Machine)</div>
              <div className="text-[11px] opacity-80 mt-0.5">
                Relevé d&apos;horamètre, diagnostic groupe hydraulique, régulation
              </div>
            </div>
          </button>

          {/* TAB 2: MOLD */}
          <button
            type="button"
            onClick={() => setCategory('Mold')}
            className={cn(
              'p-4 rounded-2xl border-2 text-left transition-all flex items-start gap-3.5 cursor-pointer',
              category === 'Mold'
                ? 'bg-purple-50/80 border-purple-600 text-purple-950 shadow-sm ring-2 ring-purple-500/20'
                : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:border-neutral-300'
            )}
          >
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold',
                category === 'Mold' ? 'bg-purple-600 text-white' : 'bg-neutral-200 text-neutral-700'
              )}
            >
              <Box className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm">Moule &amp; Outillage (Mold)</div>
              <div className="text-[11px] opacity-80 mt-0.5">
                Empreintes, tiroirs, atelier interne vs sous-traitant, statut outillage
              </div>
            </div>
          </button>

          {/* TAB 3: OTHER */}
          <button
            type="button"
            onClick={() => setCategory('Other')}
            className={cn(
              'p-4 rounded-2xl border-2 text-left transition-all flex items-start gap-3.5 cursor-pointer',
              category === 'Other'
                ? 'bg-amber-50/80 border-amber-600 text-amber-950 shadow-sm ring-2 ring-amber-500/20'
                : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:border-neutral-300'
            )}
          >
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold',
                category === 'Other' ? 'bg-amber-600 text-white' : 'bg-neutral-200 text-neutral-700'
              )}
            >
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm">Utilités &amp; Périphériques (Other)</div>
              <div className="text-[11px] opacity-80 mt-0.5">
                Chillers, compresseurs, robots, dessicateurs, réseaux &amp; HSE
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* SECTION COMMUNE: IDENTIFICATION & CONTEXTE DU RAPPORT */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 border border-neutral-300 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-tight flex items-center gap-2 border-b pb-3">
          <Activity className="w-4 h-4 text-neutral-700" />
          <span>Informations &amp; Contexte de l&apos;Ordre de Travail (OT / DI)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
          <div>
            <label className="font-bold text-neutral-700 block mb-1">Réf. Rapport (REP) :</label>
            <input
              type="text"
              value={reportRef}
              onChange={(e) => setReportRef(e.target.value)}
              className="w-full px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-xl font-mono font-bold text-emerald-800"
              placeholder="Ex: REP-2026-0001"
            />
          </div>

          <div>
            <label className="font-bold text-neutral-700 block mb-1">Réf. OT :</label>
            <input
              type="text"
              value={otRef}
              onChange={(e) => setOtRef(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl font-mono font-bold text-blue-700"
            />
          </div>

          <div>
            <label className="font-bold text-neutral-700 block mb-1">Réf. DI :</label>
            <input
              type="text"
              value={irRef}
              onChange={(e) => setIrRef(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl font-mono font-bold text-neutral-800"
            />
          </div>

          <div>
            <label className="font-bold text-neutral-700 block mb-1">Date d&apos;intervention :</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl font-semibold"
            />
          </div>

          <div>
            <label className="font-bold text-neutral-700 block mb-1">Priorité :</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl font-bold"
            >
              <option value="Low">Low (Basse)</option>
              <option value="Medium">Medium (Normale)</option>
              <option value="High">High (Élevée)</option>
              <option value="Urgent">Urgent (Critique)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs border-t border-neutral-100">
          <div>
            <label className="font-bold text-neutral-700 block mb-1">Demandeur :</label>
            <input
              type="text"
              value={requestedBy}
              onChange={(e) => setRequestedBy(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl"
            />
          </div>

          <div>
            <label className="font-bold text-neutral-700 block mb-1">Technicien Assigné :</label>
            <input
              type="text"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl font-semibold"
            />
          </div>

          <div>
            <label className="font-bold text-neutral-700 block mb-1">Rapport Clôturé Par :</label>
            <input
              type="text"
              value={filledBy}
              onChange={(e) => setFilledBy(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl font-bold text-neutral-900"
            />
          </div>
        </div>

        {/* Timestamps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs border-t border-neutral-100">
          <div>
            <label className="font-bold text-neutral-700 block mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Heure Début :</span>
            </label>
            <input
              type="text"
              value={startingTime}
              onChange={(e) => setStartingTime(e.target.value)}
              placeholder="AAAA-MM-JJ HH:MM"
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl font-mono"
            />
          </div>

          <div>
            <label className="font-bold text-neutral-700 block mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Heure Fin :</span>
            </label>
            <input
              type="text"
              value={finishedTime}
              onChange={(e) => setFinishedTime(e.target.value)}
              placeholder="AAAA-MM-JJ HH:MM"
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl font-mono"
            />
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* CATEGORY 1: DEDICATED MACHINE INTERVENTION REPORT */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {category === 'Machine' && (
        <div className="bg-white rounded-3xl p-6 border-2 border-blue-400 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-blue-200 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-blue-950 uppercase tracking-tight">
                  Rapport Technique — Presse d&apos;Injection (Machine)
                </h3>
                <p className="text-xs text-blue-700 font-medium">
                  Relevé d&apos;horamètre, diagnostic de panne machine et remise en service de la presse
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold border border-blue-300">
              Formulaire Machine Actif
            </span>
          </div>

          {/* Machine Selection & Meter Reading */}
          <div className="p-5 bg-gradient-to-br from-blue-50/70 to-white rounded-2xl border border-blue-200 space-y-5 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="font-bold text-neutral-800 block">
                  Presse / Machine Concernée * :
                </label>
                {machines.length > 0 ? (
                  <select
                    value={selectedMachineId}
                    onChange={(e) => {
                      setSelectedMachineId(e.target.value);
                      setMeterReadingError(null);
                    }}
                    className="w-full p-2.5 bg-white border border-blue-300 rounded-xl font-bold text-neutral-900 shadow-2xs focus:ring-2 focus:ring-blue-500"
                  >
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.number} — {m.name || m.brand} (Index actuel : {m.currentHours || m.totalOperatingHours || 0} h)
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-2.5 bg-neutral-100 border border-neutral-300 rounded-xl font-bold font-mono">
                    {currentMachineObj?.number || 'Machine standard'}
                  </div>
                )}
              </div>

              {/* Last Recorded Reading Summary */}
              <div className="p-3.5 bg-white border border-blue-200 rounded-2xl shadow-2xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500 font-medium">Dernier index enregistré :</span>
                  <span className="font-mono text-sm font-black text-blue-900">
                    {lastRecordedHours.toLocaleString()} h
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-neutral-500">Dernier relevé le :</span>
                  <span className="font-medium text-neutral-700">
                    {currentMachineObj?.lastMeterReadingDate
                      ? new Date(currentMachineObj.lastMeterReadingDate).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Non consigné'}
                  </span>
                </div>
              </div>
            </div>

            {/* Meter Reading Input */}
            <div className="pt-3 border-t border-blue-200 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-neutral-800 uppercase tracking-wider mb-1.5">
                    Index Horamètre Actuel Relevé (h) (Optionnel) :
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder={`ex: ${lastRecordedHours + 8}`}
                      value={meterReadingInput}
                      onChange={(e) => {
                        setMeterReadingInput(e.target.value);
                        setMeterReadingError(null);
                      }}
                      className="w-full px-4 py-2.5 bg-white border border-blue-300 rounded-xl text-base font-bold font-mono text-neutral-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <span className="absolute right-3.5 top-2.5 font-mono font-bold text-neutral-400">
                      heures
                    </span>
                  </div>
                </div>

                {readingStats && hasReadingInput && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-white rounded-xl border border-blue-200">
                    <div>
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                        Delta Heures (Δh)
                      </span>
                      <span
                        className={cn(
                          'text-base font-black font-mono',
                          readingStats.deltaHours >= 0 ? 'text-emerald-700' : 'text-red-600'
                        )}
                      >
                        {readingStats.deltaHours >= 0 ? `+${readingStats.deltaHours}` : readingStats.deltaHours} h
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                        Cadence Moyenne
                      </span>
                      <span className="text-base font-black font-mono text-neutral-900">
                        {readingStats.averageHoursPerDay} h/j
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {readingStats?.isLowerThanLast && hasReadingInput && (
                <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-red-800 flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
                  <div>
                    <p className="font-bold">Valeur d&apos;index inférieure au dernier relevé :</p>
                    <p className="text-[11px] mt-0.5">
                      L&apos;index saisi ({readingNum} h) ne peut pas être inférieur à {lastRecordedHours} h.
                    </p>
                  </div>
                </div>
              )}

              {readingStats?.exceedsCalendarHours && !readingStats.isLowerThanLast && hasReadingInput && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 space-y-2">
                  <div className="flex items-start gap-2">
                    <ShieldAlert size={16} className="shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <p className="font-bold">Avertissement de cohérence calendaire :</p>
                      <p className="text-[11px]">
                        Le delta calculé (+{readingStats.deltaHours} h) dépasse les heures calendaires écoulées ({readingStats.elapsedCalendarHours} h).
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-950">
                    <input
                      type="checkbox"
                      checked={meterWarningConfirmed}
                      onChange={(e) => setMeterWarningConfirmed(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span>Je confirme l&apos;exactitude de cet index</span>
                  </label>
                </div>
              )}

              {meterReadingError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{meterReadingError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Machine Cause & Diagnosis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-neutral-800 block mb-1">
                Famille de Panne Machine * :
              </label>
              <select
                value={machineCause}
                onChange={(e) => setMachineCause(e.target.value)}
                className="w-full p-2.5 bg-white border border-neutral-300 rounded-xl font-bold"
              >
                <option value="Mechanical">Mécanique (Guidage, Colonnes, Genouillère)</option>
                <option value="Hydraulic">Hydraulique (Pompe, Distributeur, Vérin, Fuite)</option>
                <option value="Electrical">Électrique (Moteur, Disjoncteur, Câblage)</option>
                <option value="Electronic">Électronique (Cartes I/O, Variateur, Capteurs)</option>
                <option value="Thermal">Thermique (Colliers chauffants, Sondes thermocouples)</option>
                <option value="Pneumatic">Pneumatique (Vannes, Éjecteurs pneumatiques)</option>
                <option value="Software">Automatisme &amp; Logiciel CNC</option>
                <option value="Operator Error">Faute de Conduite / Réglage</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-neutral-800 block mb-1">
                Sous-cause &amp; Précision du Diagnostic :
              </label>
              <input
                type="text"
                value={machineSubCause}
                onChange={(e) => setMachineSubCause(e.target.value)}
                placeholder="ex: Joint de vérin d'injection fuyard, surchauffe zone 3..."
                className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl font-medium"
              />
            </div>
          </div>

          {/* Machine Status After Intervention */}
          <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-blue-950 block">Statut de la Presse après Travaux :</span>
              <span className="text-neutral-500">Mise à jour automatique du statut machine en atelier</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMachineStatusAfter('Running')}
                className={cn(
                  'px-4 py-2 rounded-xl font-bold border transition-all flex items-center justify-center gap-1.5',
                  machineStatusAfter === 'Running'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                    : 'bg-white text-neutral-700 border-neutral-300 hover:bg-emerald-50'
                )}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Running (En Production)</span>
              </button>
              <button
                type="button"
                onClick={() => setMachineStatusAfter('Stopped')}
                className={cn(
                  'px-4 py-2 rounded-xl font-bold border transition-all flex items-center justify-center gap-1.5',
                  machineStatusAfter === 'Stopped'
                    ? 'bg-red-600 text-white border-red-700 shadow-2xs'
                    : 'bg-white text-neutral-700 border-neutral-300 hover:bg-red-50'
                )}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Stopped (À l&apos;Arrêt)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* CATEGORY 2: DEDICATED MOLD INTERVENTION REPORT (Direct User Logic) */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {category === 'Mold' && (
        <div className="bg-white rounded-3xl p-6 border-2 border-purple-400 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-purple-200 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-bold">
                <Box className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-purple-950 uppercase tracking-tight">
                  Rapport Technique — Moule &amp; Outillage de Précision
                </h3>
                <p className="text-xs text-purple-700 font-medium">
                  Atelier toolroom, intervention sur empreintes, tiroirs, et synchronisation du moule
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-bold border border-purple-300">
              Formulaire Moule Actif
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Searchable Mold Selector */}
            <div className="space-y-1.5">
              <label className="font-bold text-neutral-800 block">
                Moule Concerné * :
              </label>
              <div className="relative">
                <div
                  onClick={() => setIsMoldDropdownOpen(!isMoldDropdownOpen)}
                  className="w-full p-2.5 bg-white border border-purple-300 rounded-xl flex items-center justify-between cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-purple-900 bg-purple-100 px-2 py-0.5 rounded">
                      {reportMoldNumber}
                    </span>
                    <span className="text-neutral-600 truncate max-w-[200px]">
                      {molds.find((m) => m.id === reportMoldId)?.description || 'Moule sélectionné'}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-neutral-400" />
                </div>

                {isMoldDropdownOpen && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-purple-200 rounded-2xl shadow-xl p-2 max-h-56 overflow-y-auto space-y-1">
                    <div className="p-1">
                      <input
                        type="text"
                        placeholder="Rechercher par N° de moule ou description..."
                        value={moldSearchTerm}
                        onChange={(e) => setMoldSearchTerm(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs"
                      />
                    </div>
                    {filteredMolds.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setReportMoldId(m.id);
                          setReportMoldNumber(m.moldNumber || m.ref || 'MLD-XXX');
                          setIsMoldDropdownOpen(false);
                        }}
                        className={`w-full text-left p-2 rounded-xl flex items-center justify-between text-xs hover:bg-purple-50 transition-colors ${
                          reportMoldId === m.id ? 'bg-purple-100 font-bold text-purple-900' : 'text-neutral-800'
                        }`}
                      >
                        <div>
                          <div className="font-mono font-bold">{m.moldNumber || m.ref}</div>
                          <div className="text-[11px] text-neutral-500">{m.description}</div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100">
                          {m.status}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Affected Cavities */}
            <div className="space-y-1.5">
              <label className="font-bold text-neutral-800 block">
                Empreintes / Tiroirs / Éléments Impactés :
              </label>
              <input
                type="text"
                value={affectedCavities}
                onChange={(e) => setAffectedCavities(e.target.value)}
                placeholder="ex: Empreinte N°4 rayée, tiroir hydraulique côté fixe..."
                className="w-full p-2.5 bg-white border border-purple-300 rounded-xl font-medium text-neutral-800"
              />
            </div>
          </div>

          {/* Description du problème outillage */}
          <div className="text-xs space-y-1.5">
            <label className="font-bold text-neutral-800 block">
              Description de l&apos;Anomalie / Problème Outillage Constaté * :
            </label>
            <textarea
              rows={2}
              value={moldIssueDescription}
              onChange={(e) => setMoldIssueDescription(e.target.value)}
              placeholder="Décrire en détail le problème sur le moule (bavures pièce, grippage éjecteur, fuite circuit de refroidissement, etc.)..."
              className="w-full p-3 bg-neutral-50 border border-purple-200 rounded-xl font-medium text-neutral-900"
            />
          </div>

          {/* Lieu de Réparation & Statut du moule */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Repair Location */}
            <div className="space-y-1.5">
              <label className="font-bold text-neutral-800 block">
                Lieu de Réparation * :
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMoldRepairLocation('local')}
                  className={cn(
                    'p-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition-all',
                    moldRepairLocation === 'local'
                      ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                      : 'bg-white text-neutral-700 border-neutral-300 hover:bg-purple-50'
                  )}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Interne (Atelier Moules)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMoldRepairLocation('external')}
                  className={cn(
                    'p-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition-all',
                    moldRepairLocation === 'external'
                      ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                      : 'bg-white text-neutral-700 border-neutral-300 hover:bg-purple-50'
                  )}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Externe (Sous-traitant)</span>
                </button>
              </div>
            </div>

            {/* Mold Status After Repair */}
            <div className="space-y-1.5">
              <label className="font-bold text-neutral-800 block">
                Statut du Moule à la Clôture * :
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMoldStatusAfterRepair('In Stock')}
                  className={cn(
                    'p-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition-all',
                    moldStatusAfterRepair === 'In Stock'
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                      : 'bg-white text-neutral-700 border-neutral-300 hover:bg-emerald-50'
                  )}
                >
                  <Box className="w-3.5 h-3.5" />
                  <span>En Stock (Râtelier Toolroom)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMoldStatusAfterRepair('In Use')}
                  className={cn(
                    'p-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition-all',
                    moldStatusAfterRepair === 'In Use'
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                      : 'bg-white text-neutral-700 border-neutral-300 hover:bg-emerald-50'
                  )}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>En Utilisation (Sur Presse)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Subcontractor details if external */}
          {moldRepairLocation === 'external' && (
            <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-200 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">
                    Nom du Sous-traitant / Prestataire :
                  </label>
                  <input
                    type="text"
                    value={moldSupplierName}
                    onChange={(e) => setMoldSupplierName(e.target.value)}
                    placeholder="ex: MouleTech Precision, Outillage Laser S.A."
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">
                    Réf Devis / Bon de Commande :
                  </label>
                  <input
                    type="text"
                    value={moldDevisRef}
                    onChange={(e) => setMoldDevisRef(e.target.value)}
                    placeholder="ex: DEV-2026-OUT-089"
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Photo / Imagerie Outillage */}
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3 text-xs">
            <span className="font-bold text-neutral-800 block flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-purple-600" />
              <span>Photo de l&apos;Outillage / Empreinte (Optionnel) :</span>
            </span>

            {moldImageUrl ? (
              <div className="relative inline-block border border-neutral-300 rounded-xl overflow-hidden bg-white p-2">
                <img
                  src={moldImageUrl}
                  alt="Outillage"
                  className="max-h-48 object-contain rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setMoldImageUrl('')}
                  className="absolute top-3 right-3 p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-md"
                  title="Supprimer la photo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-3 px-4 py-3 bg-white border-2 border-dashed border-purple-300 hover:border-purple-500 rounded-xl cursor-pointer text-purple-700 font-semibold w-fit transition-colors">
                <Upload className="w-4 h-4" />
                <span>Téléverser une photo de l&apos;outillage</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* CATEGORY 3: DEDICATED OTHER / UTILITIES INTERVENTION REPORT */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {category === 'Other' && (
        <div className="bg-white rounded-3xl p-6 border-2 border-amber-400 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-amber-200 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-amber-950 uppercase tracking-tight">
                  Rapport Technique — Utilités, Périphériques &amp; Bâtiment
                </h3>
                <p className="text-xs text-amber-700 font-medium">
                  Centrales d&apos;air, chillers, sécheurs matière, robots cartésiens et sécurité HSE
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-bold border border-amber-300">
              Formulaire Utilités Actif
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div>
              <label className="font-bold text-neutral-800 block mb-1">
                Type d&apos;Équipement Auxiliaire * :
              </label>
              <select
                value={auxiliaryEquipmentType}
                onChange={(e) => setAuxiliaryEquipmentType(e.target.value)}
                className="w-full p-2.5 bg-white border border-amber-300 rounded-xl font-bold text-neutral-900"
              >
                <option value="Chiller System / Chilled Water Unit">
                  Chiller System / Groupe d&apos;Eau Glacée
                </option>
                <option value="Air Compressor / Compressed Air Station">
                  Centrale Air Comprimé &amp; Sécheur d&apos;Air
                </option>
                <option value="Dessicateur / Trémie Chauffante Matière">
                  Dessicateur / Trémie Chauffante Matière
                </option>
                <option value="Part Removal Robot / Automation">
                  Robot Cartésien de Déchargement / Automatisation
                </option>
                <option value="Tapis Convoyeur & Triage">Tapis Convoyeur &amp; Triage Pièces</option>
                <option value="Broyeur de Carottes / Granulateur">
                  Broyeur de Carottes / Granulateur
                </option>
                <option value="Poste Électrique HT/BT & TGBT">
                  Poste Électrique HT/BT &amp; TGBT Atelier
                </option>
                <option value="Infrastructure Bâtiment & Chaufferie">
                  Infrastructure Bâtiment &amp; Réseaux d&apos;Usine
                </option>
              </select>
            </div>

            <div>
              <label className="font-bold text-neutral-800 block mb-1">
                Localisation Précise / Salle Technique :
              </label>
              <input
                type="text"
                value={facilityLocation}
                onChange={(e) => setFacilityLocation(e.target.value)}
                placeholder="ex: Salle des compresseurs Sud, Zone Silo Matière..."
                className="w-full p-2.5 bg-white border border-amber-300 rounded-xl font-medium text-neutral-800"
              />
            </div>

            <div>
              <label className="font-bold text-neutral-800 block mb-1">
                Cause Principale du Dysfonctionnement :
              </label>
              <input
                type="text"
                value={otherCause}
                onChange={(e) => setOtherCause(e.target.value)}
                placeholder="ex: Chute de pression d'air comprimé, colmatage filtre..."
                className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl font-medium"
              />
            </div>

            <div>
              <label className="font-bold text-neutral-800 block mb-1">
                Statut de l&apos;Équipement après Travaux :
              </label>
              <select
                value={otherStatusAfter}
                onChange={(e) => setOtherStatusAfter(e.target.value as any)}
                className="w-full p-2.5 bg-white border border-amber-300 rounded-xl font-bold"
              >
                <option value="Operational">Opérationnel / En Service Normal</option>
                <option value="Standby">En Attente / Standby</option>
                <option value="Under Observation">En Observation / Surveillance</option>
              </select>
            </div>
          </div>

          {/* HSE & Preventive measures */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2 border-t border-amber-200">
            <div>
              <label className="font-bold text-neutral-800 block mb-1">
                Mesures Préventives pour Éviter la Récidive :
              </label>
              <textarea
                rows={2}
                value={preventiveMeasures}
                onChange={(e) => setPreventiveMeasures(e.target.value)}
                placeholder="ex: Mettre en place une purge hebdomadaire des condensats..."
                className="w-full p-2.5 bg-white border border-amber-300 rounded-xl"
              />
            </div>

            <div>
              <label className="font-bold text-neutral-800 block mb-1">
                Observations Sécurité &amp; Environnement (HSE / LOTO) :
              </label>
              <textarea
                rows={2}
                value={safetyObservations}
                onChange={(e) => setSafetyObservations(e.target.value)}
                placeholder="ex: Consignation pneumatique effectuée, zéro fuite résiduelle..."
                className="w-full p-2.5 bg-white border border-amber-300 rounded-xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* SECTION COMMUNE: ACTIONS RÉALISÉES PAR LE TECHNICIEN */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 border border-neutral-300 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-tight flex items-center gap-2">
            <Wrench className="w-4 h-4 text-emerald-600" />
            <span>Actions &amp; Travaux de Réparation Exécutés</span>
          </h3>
          <span className="text-xs font-semibold text-neutral-500">
            {actions.length} action(s) répertoriée(s)
          </span>
        </div>

        <div className="space-y-2">
          {actions.map((act, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs"
            >
              <div className="flex items-start gap-2.5">
                <span className="font-mono font-bold text-blue-700 mt-0.5">#{idx + 1}</span>
                <span className="font-medium text-neutral-800">{act}</span>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveAction(idx)}
                className="text-neutral-400 hover:text-red-600 p-1 cursor-pointer transition-colors"
                title="Supprimer cette action"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* Add new action input */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="text"
              placeholder="Décrire une action réalisée par le technicien..."
              value={currentActionInput}
              onChange={(e) => setCurrentActionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddAction();
                }
              }}
              className="flex-1 px-3 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              type="button"
              onClick={handleAddAction}
              className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter Action</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* SECTION PIÈCES DE RECHANGE (PDR PRÉLEVÉES DU STOCK MAGASIN) */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 border border-neutral-300 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 gap-2">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-tight flex items-center gap-2">
              <Boxes className="w-4 h-4 text-blue-600" />
              <span>Pièces de Rechange (PDR) Prélevées du Magasin</span>
            </h3>
            <p className="text-xs text-neutral-500">
              Déduction automatique du stock physique lors de la clôture
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-neutral-500 block">Total Pièces Prélevées :</span>
            <span className="text-base font-mono font-black text-blue-700">
              {partsCost.toFixed(2)} DT
            </span>
          </div>
        </div>

        {/* Consumed list */}
        {stockTaken.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-neutral-200 rounded-xl overflow-hidden">
              <thead className="bg-neutral-100 font-bold text-neutral-700">
                <tr>
                  <th className="p-3">Réf PDR</th>
                  <th className="p-3">Désignation</th>
                  <th className="p-3 text-center">Quantité</th>
                  <th className="p-3 text-right">Prix Unitaire</th>
                  <th className="p-3 text-right">Total Ligne</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {stockTaken.map((st) => (
                  <tr key={st.id} className="hover:bg-neutral-50">
                    <td className="p-3 font-mono font-bold text-blue-700">{st.partNumber}</td>
                    <td className="p-3 font-medium">{st.itemName}</td>
                    <td className="p-3 text-center font-bold">{st.qty}</td>
                    <td className="p-3 text-right font-mono">{st.unitPrice.toFixed(2)} DT</td>
                    <td className="p-3 text-right font-mono font-bold">
                      {(st.qty * st.unitPrice).toFixed(2)} DT
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveStock(st.id)}
                        className="text-neutral-400 hover:text-red-600 p-1 cursor-pointer transition-colors"
                        title="Retirer cet article"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 text-xs text-neutral-500 italic text-center">
            Aucune pièce prélevée du stock magasin pour cette intervention (Coût : 0.00 DT).
          </div>
        )}

        {/* Add part picker */}
        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-2">
          <span className="text-xs font-bold text-neutral-700 block">
            Ajouter une pièce de rechange consommée :
          </span>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs">
            <select
              value={selectedStockItemId}
              onChange={(e) => setSelectedStockItemId(e.target.value)}
              className="flex-1 p-2 bg-white border border-neutral-300 rounded-xl font-medium"
            >
              {stockItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.partNumber} — {item.name} ({item.currentQty} dispo en stock · {item.unitPrice.toFixed(2)} DT)
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={stockQty}
                onChange={(e) => setStockQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 p-2 bg-white border border-neutral-300 rounded-xl text-center font-bold font-mono"
              />
              <button
                type="button"
                onClick={handleAddStock}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* BILAN FINANCIER DE L'INTERVENTION: STRICTEMENT CE QUI EST PRÉLEVÉ DU STOCK */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-neutral-900 text-white rounded-3xl p-6 sm:p-8 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
            Bilan Financier Réel de l&apos;Intervention
          </span>
          <div className="flex items-baseline gap-3 mt-1.5">
            <span className="text-4xl font-black font-mono tabular-nums text-emerald-400">
              {totalCost.toFixed(2)} DT
            </span>
            <span className="text-xs text-neutral-400">
              {totalCost === 0
                ? 'Aucune pièce sortie de stock (Valeur 0.00 DT)'
                : 'Exact montant prélevé du stock magasin'}
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-2">
            Calcul strict basé uniquement sur les pièces de rechange consommées. Aucun frais forfaitaire ni TVA ajoutée.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={onCancel}
            type="button"
            className="flex-1 md:flex-none px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold rounded-2xl text-xs transition-colors cursor-pointer text-center"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            type="button"
            className="flex-1 md:flex-none px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-black rounded-2xl text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2 active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Valider &amp; Clôturer les Travaux</span>
          </button>
        </div>
      </div>
    </div>
  );
};
