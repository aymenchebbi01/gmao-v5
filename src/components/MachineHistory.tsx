import React, { useState } from 'react';
import { MaintenanceOrder, InterventionReport, Machine, CounterReading } from '../types/gmao';
import {
  Wrench,
  Clock,
  Calendar,
  User,
  History,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Edit3,
  ShieldAlert,
  ArrowRight,
  Info,
  X,
} from 'lucide-react';
import { cn, isMeterReadingStale } from '../lib/gmaoUtils';

interface MachineHistoryProps {
  machineId: string;
  machineName: string;
  machine?: Machine;
  orders?: MaintenanceOrder[];
  reports?: InterventionReport[];
  initialTab?: 'interventions' | 'readings';
  canEditReadings?: boolean;
  onCorrectReading?: (
    machineId: string,
    originalReadingId: string,
    correctedHours: number,
    reason: string
  ) => void;
  onOpenNewReadingModal?: (machine: Machine) => void;
}

export const MachineHistory: React.FC<MachineHistoryProps> = ({
  machineId,
  machineName,
  machine,
  orders = [],
  reports = [],
  initialTab = 'readings',
  canEditReadings = false,
  onCorrectReading,
  onOpenNewReadingModal,
}) => {
  const [activeTab, setActiveTab] = useState<'interventions' | 'readings'>(initialTab);
  const [correctionTarget, setCorrectionTarget] = useState<CounterReading | null>(null);
  const [correctedValue, setCorrectedValue] = useState<number>(0);
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  // Filter orders matching this machine
  const machineOrders = orders.filter(
    (o) =>
      o.machineId === machineId ||
      o.equipmentId === machineId ||
      (o.equipmentName && o.equipmentName.toLowerCase().includes(machineName.toLowerCase()))
  );

  // Read counter readings from machine or build default
  const counterReadings: CounterReading[] = machine?.counterReadings || [];
  const sortedReadings = [...counterReadings].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const isStale = machine ? isMeterReadingStale(machine) : false;

  const handleStartCorrection = (reading: CounterReading) => {
    setCorrectionTarget(reading);
    setCorrectedValue(reading.newHours);
    setCorrectionReason('');
    setCorrectionError(null);
  };

  const handleSaveCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionTarget) return;

    if (!correctionReason.trim()) {
      setCorrectionError('Le motif de la correction est obligatoire pour le journal d\'audit.');
      return;
    }

    if (correctedValue < 0) {
      setCorrectionError('L\'index ne peut pas être négatif.');
      return;
    }

    if (onCorrectReading) {
      onCorrectReading(machineId, correctionTarget.id, correctedValue, correctionReason.trim());
    }

    setCorrectionTarget(null);
    setCorrectionReason('');
    setCorrectionError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-black text-gray-900 font-sans tracking-tight">
              {machineName}
            </h3>
            {machine?.siteNumber && (
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-mono text-xs font-bold border border-blue-200">
                #{machine.siteNumber}
              </span>
            )}
            {isStale && (
              <span className="px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded-md font-mono text-[11px] font-bold border border-neutral-300">
                ⏱️ Relevé &gt; 7j
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Horamètre actuel : <b className="text-gray-900 font-mono">{(machine?.currentHours || machine?.totalOperatingHours || 0).toLocaleString()} h</b>
            {machine?.lastMeterReadingDate && (
              <span> · Dernier relevé le {new Date(machine.lastMeterReadingDate).toLocaleDateString()} par {machine.lastMeterReadingBy || 'Opérateur'}</span>
            )}
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl self-start sm:self-center">
          <button
            type="button"
            onClick={() => setActiveTab('readings')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
              activeTab === 'readings'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <Clock size={14} className={activeTab === 'readings' ? 'text-blue-600' : 'text-gray-400'} />
            <span>Historique des Relevés</span>
            <span className="ml-1 px-1.5 py-0.2 bg-gray-200 text-gray-700 rounded-full text-[10px]">
              {counterReadings.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('interventions')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
              activeTab === 'interventions'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <Wrench size={14} className={activeTab === 'interventions' ? 'text-blue-600' : 'text-gray-400'} />
            <span>Interventions &amp; OT</span>
            <span className="ml-1 px-1.5 py-0.2 bg-gray-200 text-gray-700 rounded-full text-[10px]">
              {machineOrders.length}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: HISTORIQUE DES RELEVÉS COMPTEUR (AUDIT LOG IMMUABLE)               */}
      {/* ========================================================================= */}
      {activeTab === 'readings' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50 border border-neutral-200 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                  Journal d'Audit des Index Compteur
                </p>
                <p className="text-[11px] text-gray-500">
                  Tous les relevés (clôture OT, contrôle manuel, corrections autorisées) sont consignés sans écrasement.
                </p>
              </div>
            </div>

            {machine && onOpenNewReadingModal && (
              <button
                type="button"
                onClick={() => onOpenNewReadingModal(machine)}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Clock size={14} />
                <span>+ Relever Compteur</span>
              </button>
            )}
          </div>

          {sortedReadings.length === 0 ? (
            <div className="py-12 text-center bg-gray-50 rounded-2xl border border-gray-200">
              <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700">Aucun relevé enregistré pour cette machine</p>
              <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                Effectuez un premier relevé manuel via le bouton « Relever Compteur » ou clôturez un ordre de travail pour initialiser l'horamètre.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {sortedReadings.map((reading) => {
                const isCorrection = reading.isCorrection || reading.source === 'Correction';
                const formattedDate = new Date(reading.date).toLocaleString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={reading.id}
                    className={cn(
                      'p-4 rounded-2xl border transition-all text-xs',
                      isCorrection
                        ? 'bg-amber-50/50 border-amber-300 hover:border-amber-400'
                        : reading.source === 'Work Order'
                        ? 'bg-white border-blue-200 hover:border-blue-300'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        {/* Source Badge */}
                        <span
                          className={cn(
                            'px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] border',
                            reading.source === 'Work Order'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : isCorrection
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          )}
                        >
                          {reading.source === 'Work Order'
                            ? '📋 Clôture OT'
                            : isCorrection
                            ? '⚖️ Correction'
                            : '⏱️ Relevé Manuel'}
                        </span>

                        {reading.refOT && (
                          <span className="font-mono font-bold text-[11px] text-blue-700 bg-blue-50/70 px-2 py-0.5 rounded">
                            {reading.refOT}
                          </span>
                        )}
                        {reading.refReport && (
                          <span className="font-mono text-[11px] text-gray-500">
                            ({reading.refReport})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-gray-500 font-mono text-[11px]">
                          <Calendar size={13} className="text-gray-400" />
                          <span>{formattedDate}</span>
                        </div>

                        {canEditReadings && !isCorrection && onCorrectReading && (
                          <button
                            type="button"
                            onClick={() => handleStartCorrection(reading)}
                            className="px-2 py-1 text-gray-500 hover:text-amber-700 hover:bg-amber-100/60 rounded-lg text-[11px] font-bold border border-transparent hover:border-amber-300 transition-colors flex items-center gap-1 cursor-pointer"
                            title="Corriger une faute de frappe sur ce relevé (Réservé Manager / Admin)"
                          >
                            <Edit3 size={12} />
                            <span>Corriger</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Reading Index Evolution & Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                          Index Précédent → Nouvel Index
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-gray-600 font-medium">
                            {reading.previousHours.toLocaleString()} h
                          </span>
                          <ArrowRight size={13} className="text-gray-400" />
                          <span className="font-mono text-sm font-black text-gray-900">
                            {reading.newHours.toLocaleString()} h
                          </span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                          Delta Heures Fonctionnement
                        </span>
                        <span
                          className={cn(
                            'font-mono text-xs font-black inline-block mt-0.5',
                            reading.deltaHours >= 0 ? 'text-emerald-700' : 'text-red-700'
                          )}
                        >
                          {reading.deltaHours >= 0 ? `+${reading.deltaHours}` : reading.deltaHours} h
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                          Opérateur / Signataire
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5 text-gray-800 font-semibold">
                          <User size={13} className="text-gray-400" />
                          <span>{reading.operator}</span>
                        </div>
                      </div>
                    </div>

                    {/* Notes or Correction Reason */}
                    {reading.note && (
                      <p className="mt-2.5 pt-2 border-t border-gray-100 text-gray-600 italic">
                        Note : {reading.note}
                      </p>
                    )}

                    {reading.correctionReason && (
                      <div className="mt-2.5 p-2.5 bg-amber-100/70 border border-amber-300 rounded-xl text-amber-950 font-medium flex items-start gap-2">
                        <ShieldAlert size={14} className="text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Motif de la régularisation : </span>
                          <span>{reading.correctionReason}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INTERVENTIONS & ORDRES DE TRAVAIL                                  */}
      {/* ========================================================================= */}
      {activeTab === 'interventions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Ordres de Travail &amp; Interventions Réalisées
            </h4>
            <span className="text-xs text-gray-500 font-medium">
              {machineOrders.length} enregistrements
            </span>
          </div>

          {machineOrders.length === 0 ? (
            <div className="py-12 text-center bg-gray-50 rounded-2xl border border-gray-100">
              <Wrench className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700">Aucun historique d'intervention</p>
              <p className="text-xs text-gray-400 mt-1">
                Aucun ordre de travail correctif ou préventif n'a encore été rattaché à cet équipement.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {machineOrders.map((ord) => {
                const report = reports.find(
                  (r) => r.refOT === ord.refOT || r.refReport === ord.reportRef
                );

                return (
                  <div
                    key={ord.id}
                    className="p-4 bg-white rounded-2xl border border-gray-200 shadow-2xs hover:border-blue-300 transition-all space-y-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                          {ord.refOT}
                        </span>
                        {ord.refIR && (
                          <span className="font-mono text-xs text-gray-500">
                            (Demande: {ord.refIR})
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                            ord.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : ord.status === 'In Progress'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
                        <Calendar size={13} className="text-gray-400" />
                        <span>{ord.date}</span>
                      </div>
                    </div>

                    <p className="text-xs text-gray-800 font-medium">
                      {ord.description || 'Intervention de maintenance sur la presse d\'injection.'}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-[11px] text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <User size={13} className="text-gray-400" />
                        <span>
                          Technicien : <b className="text-gray-800">{ord.assignedTo}</b>
                        </span>
                      </div>

                      {report?.meterReadingHours !== undefined && (
                        <div className="font-mono font-bold text-blue-700">
                          ⏱️ Relevé compteur : {report.meterReadingHours.toLocaleString()} h
                        </div>
                      )}

                      {report && (
                        <div className="text-emerald-700 font-bold">
                          Rapport {report.refReport} ({report.durationMinutes} min)
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

      {/* ========================================================================= */}
      {/* CORRECTION MODAL (MANAGER / ADMIN AUDIT TRAIL ONLY)                        */}
      {/* ========================================================================= */}
      {correctionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 border border-neutral-300 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                <h4 className="text-base font-bold text-neutral-900">
                  Corriger un Relevé de Compteur
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setCorrectionTarget(null)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-neutral-500 font-medium">Relevé sélectionné du :</span>
                <span className="font-mono font-bold text-neutral-800">
                  {new Date(correctionTarget.date).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-medium">Valeur actuelle enregistrée :</span>
                <span className="font-mono font-bold text-neutral-900">
                  {correctionTarget.newHours.toLocaleString()} h
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-medium">Opérateur initial :</span>
                <span className="font-bold text-neutral-800">{correctionTarget.operator}</span>
              </div>
            </div>

            <form onSubmit={handleSaveCorrection} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Nouvelle Valeur Corrigée (h) * :
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  required
                  value={correctedValue}
                  onChange={(e) => setCorrectedValue(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-300 rounded-xl text-sm font-bold font-mono text-neutral-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Motif Obligatoire de la Correction (Audit) * :
                </label>
                <textarea
                  rows={3}
                  required
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="Ex: Erreur de frappe sur le dernier chiffre, confirmation physique effectuée sur la machine..."
                  className="w-full p-3 bg-white border border-neutral-300 rounded-xl text-xs text-neutral-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {correctionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>{correctionError}</span>
                </div>
              )}

              <div className="p-3 bg-blue-50/70 border border-blue-200 text-blue-900 rounded-xl flex items-start gap-2 text-[11px]">
                <Info size={14} className="shrink-0 mt-0.5 text-blue-600" />
                <span>
                  Cette régularisation sera consignée avec votre signature dans l'historique sans écraser le relevé d'origine.
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCorrectionTarget(null)}
                  className="flex-1 px-4 py-2.5 text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  Enregistrer Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
