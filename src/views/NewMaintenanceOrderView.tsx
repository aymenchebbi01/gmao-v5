import React, { useState, useMemo } from 'react';
import {
  MaintenanceOrder,
  Machine,
  Mold,
  MaintenanceCategory,
  PriorityLevel,
  InterventionRequest,
  AppUser,
} from '../types/gmao';
import { ArrowLeft, Cpu, Layers, HelpCircle, AlertCircle, Wrench, ShieldCheck, Hash, Calendar } from 'lucide-react';
import { generateNextOTRef } from '../lib/gmaoUtils';

interface NewMaintenanceOrderViewProps {
  machines: Machine[];
  molds: Mold[];
  pendingRequests: InterventionRequest[];
  existingOrders?: MaintenanceOrder[];
  selectedIR?: InterventionRequest | null;
  onSave: (order: MaintenanceOrder) => void;
  onCancel: () => void;
  currentUser?: AppUser;
  users?: AppUser[];
}

export const NewMaintenanceOrderView: React.FC<NewMaintenanceOrderViewProps> = ({
  machines,
  molds,
  pendingRequests,
  existingOrders = [],
  selectedIR,
  onSave,
  onCancel,
  currentUser,
  users = [],
}) => {
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Dynamic reference generation based on Year: OT-YYYY-0001, OT-YYYY-0002...
  // When year rolls over to 2027 -> resets cleanly to OT-2027-0001!
  const generatedRefOT = useMemo(() => {
    return generateNextOTRef(existingOrders, orderDate);
  }, [existingOrders, orderDate]);

  // Pre-selected IR if passed or user selects from dropdown
  const [selectedIRId, setSelectedIRId] = useState<string>(
    selectedIR?.id || (pendingRequests.length > 0 ? pendingRequests[0]?.id : 'none')
  );

  // Point 4 & 5: Categories are: Machine ; Mold ; Other
  const [category, setCategory] = useState<MaintenanceCategory>('Machine');

  // Point 6: If it's a machine: select a machine, priority, assigned to, preventive or corrective
  const [machineId, setMachineId] = useState<string>(machines[0]?.id || '');
  const [machineMaintenanceType, setMachineMaintenanceType] = useState<'Preventive' | 'Corrective'>(
    selectedIRId === 'none' ? 'Preventive' : 'Corrective'
  );

  // Point 7 & 8: If it's mold: select a mold, priority, assigned to
  // In mold selection as well: either "Mold Maintenance" OR "Mold Request to put in machine", in that case select machine!
  const [moldId, setMoldId] = useState<string>(molds[0]?.id || '');
  const [moldActionType, setMoldActionType] = useState<'Mold Maintenance' | 'Put in Machine'>(
    'Mold Maintenance'
  );
  const [targetMachineId, setTargetMachineId] = useState<string>(machines[0]?.id || '');

  // Point 9: If category is Other: a simple field to write what is the problem
  const [otherProblemDescription, setOtherProblemDescription] = useState('');

  // Common fields: Priority & Assigned to
  const [priority, setPriority] = useState<PriorityLevel>('High');
  const [assignedTo, setAssignedTo] = useState(
    users.length > 0 ? `${users[0].name} (${users[0].role})` : currentUser?.name || ''
  );
  const [orderDescription, setOrderDescription] = useState(
    selectedIR?.problemDescription || ''
  );

  const activeIR = pendingRequests.find((r) => r.id === selectedIRId) || selectedIR;

  const handleIRChange = (irId: string) => {
    setSelectedIRId(irId);
    if (irId !== 'none') {
      const found = pendingRequests.find((r) => r.id === irId);
      if (found) {
        setOrderDescription(found.problemDescription);
      }
      setMachineMaintenanceType('Corrective');
    } else {
      setMachineMaintenanceType('Preventive');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let computedEquipmentName = 'General Plant Asset';
    let targetEquipId = '';

    if (category === 'Machine') {
      const m = machines.find((item) => item.id === machineId);
      if (m) {
        computedEquipmentName = `${m.number} (${m.brand} ${m.model})`;
        targetEquipId = m.id;
      }
    } else if (category === 'Mold') {
      const mld = molds.find((item) => item.id === moldId);
      if (mld) {
        if (moldActionType === 'Put in Machine') {
          const targetM = machines.find((item) => item.id === targetMachineId);
          computedEquipmentName = `${mld.ref} [Install on ${targetM?.number || 'Machine'}]`;
        } else {
          computedEquipmentName = `${mld.ref} (${mld.description}) - Toolroom`;
        }
        targetEquipId = mld.id;
      }
    } else {
      computedEquipmentName = otherProblemDescription
        ? `Other: ${otherProblemDescription.slice(0, 40)}`
        : 'Plant Utilities / Auxiliary';
    }

    const refIR = activeIR ? activeIR.refIR : `IR-DIR-${Math.floor(100 + Math.random() * 900)}`;

    // Point 10: After creating the maintenance order -> starts in 'Waiting' with 3-step validation pipeline
    const newOrder: MaintenanceOrder = {
      id: `ot-${Date.now()}`,
      date: orderDate,
      refOT: generatedRefOT,
      refIR,
      irDescription: activeIR?.problemDescription,
      category,
      machineId: category === 'Machine' ? machineId : undefined,
      machineNumber:
        category === 'Machine'
          ? machines.find((m) => m.id === machineId)?.number
          : undefined,
      machineMaintenanceType: category === 'Machine' ? machineMaintenanceType : undefined,
      maintenanceType: category === 'Machine' ? machineMaintenanceType : undefined,
      moldId: category === 'Mold' ? moldId : undefined,
      moldRef: category === 'Mold' ? molds.find((m) => m.id === moldId)?.ref : undefined,
      moldActionType: category === 'Mold' ? moldActionType : undefined,
      targetMachineId:
        category === 'Mold' && moldActionType === 'Put in Machine'
          ? targetMachineId
          : undefined,
      targetMachineNumber:
        category === 'Mold' && moldActionType === 'Put in Machine'
          ? machines.find((m) => m.id === targetMachineId)?.number
          : undefined,
      otherDescription: category === 'Other' ? otherProblemDescription : undefined,
      equipmentId: targetEquipId,
      equipmentName: computedEquipmentName,
      priority,
      assignedTo,
      status: 'Waiting', // Pre-execution waiting
      validationProgress: 0,
      description:
        category === 'Other'
          ? otherProblemDescription
          : orderDescription || 'Execute maintenance order per plant procedure.',
      estimatedHours: 2.0, // Default until Responsable Maintenance validates with specific time
      validationRespMaint: { validated: false },
      validationRespProd: { validated: false },
      validationQHSE: { validated: false },
      validationReportProd: { validated: false },
      validationReportTech: { validated: false },
    };

    onSave(newOrder);
  };

  return (
    <div className="p-4 sm:p-8 max-w-[1000px] mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-neutral-300 pb-4">
        <button
          onClick={onCancel}
          className="p-2 rounded-xl text-neutral-600 hover:text-neutral-900 hover:bg-black/5 transition-colors"
          title="Cancel and go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
            New Maintenance Order (OT)
          </h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-300 shadow-xs space-y-6">
        {/* Dynamic Sequential Reference OT Badge & Annual Rollover */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-200 text-xs">
          <div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono font-black text-blue-700 bg-blue-100 border border-blue-300 px-3 py-1 rounded-lg text-base">
                {generatedRefOT}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 font-bold block text-[11px] uppercase">
                Order Date
              </span>
              {/*<div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setOrderDate('2026-09-26')}
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition-colors ${orderDate.startsWith('2026')
                    ? 'bg-blue-600 text-white'
                    : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                    }`}
                  title="Test Year 2026 numbering"
                >
                  2026
                </button>
                <button
                  type="button"
                  onClick={() => setOrderDate('2027-01-15')}
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition-colors ${orderDate.startsWith('2027')
                    ? 'bg-purple-600 text-white'
                    : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                    }`}
                  title="Test Year 2027 annual reset"
                >
                  2027
                </button>
              </div>*/}
            </div>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="mt-1 bg-white border border-neutral-300 rounded-lg px-2 py-1 text-xs font-mono font-bold w-full"
            />
          </div>
        </div>

        {/* Linked Validated IR Selection */}
        <div>
          <label className="block text-xs font-bold text-neutral-700 uppercase mb-2">
            Target Intervention Request
          </label>
          <select
            value={selectedIRId}
            onChange={(e) => handleIRChange(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
          >
            {pendingRequests.map((ir) => (
              <option key={ir.id} value={ir.id}>
                {ir.refIR} — &quot;{ir.problemDescription.slice(0, 80)}&quot; (Requester: {ir.requester})
              </option>
            ))}
            <option value="none">-- Standalone Preventive / Direct Order --</option>
          </select>

          {activeIR && (
            <div className="mt-2 p-3 bg-neutral-100 rounded-xl text-xs text-neutral-700 font-medium">
              <span className="font-bold text-neutral-900">Reported Problem: </span>
              {activeIR.problemDescription}
            </div>
          )}
        </div>

        {/* Point 4 & 5: Category Selection (Machine | Mold | Other) */}
        <div>
          <label className="block text-xs font-bold text-neutral-700 uppercase mb-2">
            Category (Select based on the problem description) *
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'Machine', label: 'Machine', icon: Cpu },
              { id: 'Mold', label: 'Mold', icon: Layers },
              { id: 'Other', label: 'Other', icon: HelpCircle },
            ].map((cat) => {
              const Icon = cat.icon;
              const isSelected = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id as MaintenanceCategory)}
                  className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all font-bold text-sm cursor-pointer ${isSelected
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-xs'
                    : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                    }`}
                >
                  <Icon className={`w-6 h-6 ${isSelected ? 'text-blue-600' : 'text-neutral-500'}`} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* POINT 6: If it's a MACHINE */}
        {category === 'Machine' && (
          <div className="p-4 bg-blue-50/40 rounded-2xl border border-blue-200 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-blue-900 tracking-tight">
                Machine Specific Fields
              </h4>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${machineMaintenanceType === 'Preventive'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-red-100 text-red-800 border border-red-300'
                }`}>
                Intervention Nature: {machineMaintenanceType}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                Select Machine *
              </label>
              <select
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="w-full bg-white border border-neutral-300 rounded-xl px-3 py-2 text-sm font-bold text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
              >
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.number} — {m.brand} {m.model} ({m.clampingForceTons}T) · Line: {m.line} [{m.locationNumber}]
                  </option>
                ))}
              </select>
            </div>

            {/* Select whether it's preventive or corrective */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5">
                Maintenance Type *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMachineMaintenanceType('Corrective')}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-left cursor-pointer transition-all ${machineMaintenanceType === 'Corrective'
                    ? 'border-red-600 bg-red-50 text-red-950 shadow-xs ring-2 ring-red-400/20'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${machineMaintenanceType === 'Corrective'
                      ? 'bg-red-600 text-white'
                      : 'bg-red-100 text-red-700'
                      }`}
                  >
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="block text-sm font-black">Corrective Maintenance</span>
                      {machineMaintenanceType === 'Corrective' && (
                        <span className="text-[10px] font-bold uppercase bg-red-200 text-red-900 px-1.5 py-0.5 rounded">
                          Selected
                        </span>
                      )}
                    </div>
                    <span className="block text-[11px] text-neutral-500 font-normal mt-0.5">
                      Dépannage, réparation après panne, remplacement de pièce
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMachineMaintenanceType('Preventive')}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-left cursor-pointer transition-all ${machineMaintenanceType === 'Preventive'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-xs ring-2 ring-emerald-400/20'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${machineMaintenanceType === 'Preventive'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-100 text-emerald-700'
                      }`}
                  >
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="block text-sm font-black">Preventive Maintenance</span>
                      {machineMaintenanceType === 'Preventive' && (
                        <span className="text-[10px] font-bold uppercase bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded">
                          Selected
                        </span>
                      )}
                    </div>
                    <span className="block text-[11px] text-neutral-500 font-normal mt-0.5">
                      Plan systématique, révision périodique, vidange, graissage TPM
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* POINT 7 & 8: If it's a MOLD */}
        {category === 'Mold' && (
          <div className="p-4 bg-emerald-50/40 rounded-2xl border border-emerald-200 space-y-4 animate-in fade-in duration-150">
            <h4 className="text-xs font-black uppercase text-emerald-900 tracking-tight">
              Mold Specific Fields
            </h4>
            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                Select Mold *
              </label>
              <select
                value={moldId}
                onChange={(e) => setMoldId(e.target.value)}
                className="w-full bg-white border border-neutral-300 rounded-xl px-3 py-2 text-sm font-bold text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
              >
                {molds.map((mld) => (
                  <option key={mld.id} value={mld.id}>
                    {mld.ref} — {mld.description} ({mld.customer}) · Status: {mld.status}
                  </option>
                ))}
              </select>
            </div>

            {/* Point 8: In mold selection as well: either maintenance OR request to put in machine */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                Mold Action Type *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                <label
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${moldActionType === 'Mold Maintenance'
                    ? 'border-emerald-600 bg-emerald-100 text-emerald-900'
                    : 'border-neutral-200 bg-white text-neutral-700'
                    }`}
                >
                  <input
                    type="radio"
                    name="moldActionType"
                    checked={moldActionType === 'Mold Maintenance'}
                    onChange={() => setMoldActionType('Mold Maintenance')}
                    className="accent-emerald-600"
                  />
                  <span>Mold Maintenance</span>
                </label>

                <label
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${moldActionType === 'Put in Machine'
                    ? 'border-emerald-600 bg-emerald-100 text-emerald-900'
                    : 'border-neutral-200 bg-white text-neutral-700'
                    }`}
                >
                  <input
                    type="radio"
                    name="moldActionType"
                    checked={moldActionType === 'Put in Machine'}
                    onChange={() => setMoldActionType('Put in Machine')}
                    className="accent-emerald-600"
                  />
                  <span>Mold Request to Put in Machine</span>
                </label>
              </div>
            </div>

            {/* If "Put in Machine", select target machine (Point 8) */}
            {moldActionType === 'Put in Machine' && (
              <div className="p-3 bg-white rounded-xl border border-emerald-300">
                <label className="block text-xs font-black text-emerald-900 uppercase mb-1">
                  Select Target Machine to install mold on *
                </label>
                <select
                  value={targetMachineId}
                  onChange={(e) => setTargetMachineId(e.target.value)}
                  className="w-full bg-emerald-50 border border-emerald-300 rounded-lg px-3 py-2 text-sm font-bold text-neutral-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                >
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.number} — {m.brand} {m.model} ({m.clampingForceTons}T)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* POINT 9: If it's OTHER */}
        {category === 'Other' && (
          <div className="p-4 bg-amber-50/40 rounded-2xl border border-amber-200 space-y-3 animate-in fade-in duration-150">
            <h4 className="text-xs font-black uppercase text-amber-900 tracking-tight">
              Other Specific Fields
            </h4>
            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                Write what is the problem / equipment details *
              </label>
              <textarea
                rows={3}
                required
                value={otherProblemDescription}
                onChange={(e) => setOtherProblemDescription(e.target.value)}
                placeholder=""
                className="w-full bg-white border border-neutral-300 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Common Fields: Priority and Assigned To (Point 6 & 7) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
              Priority Level *
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityLevel)}
              className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-sm font-bold text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent (Line Stoppage)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
              Assigned To (Technician) *
            </label>
            {users.length > 0 ? (
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-sm font-bold text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="">Sélectionner un intervenant...</option>
                {users.map((u) => (
                  <option key={u.id} value={`${u.name} (${u.role})`}>
                    {u.name} — {u.role} ({u.department || 'Maintenance'})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder=""
                className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-sm font-bold text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            )}
          </div>
        </div>

        {/* Technical Instructions */}
        {category !== 'Other' && (
          <div>
            <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
              Instructions for Technician
            </label>
            <textarea
              rows={3}
              value={orderDescription}
              onChange={(e) => setOrderDescription(e.target.value)}
              placeholder=""
              className="w-full bg-neutral-50 border border-neutral-300 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-neutral-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-8 py-3 bg-black hover:bg-neutral-800 text-white font-bold text-sm sm:text-base rounded-full shadow-xs transition-all active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-10 py-3 bg-[#002aff] hover:bg-blue-700 text-white font-bold text-sm sm:text-base rounded-full shadow-md transition-all active:scale-[0.98] cursor-pointer"
          >
            Save Maintenance Order
          </button>
        </div>
      </form>
    </div>
  );
};
