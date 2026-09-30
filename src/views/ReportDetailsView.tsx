import React from 'react';
import {
  Printer,
  ArrowLeft,
  Wrench,
  ShieldAlert,
  Boxes,
  CheckCircle2,
  Box,
  Cpu,
  Building2,
  Clock,
  ShieldCheck,
  Image as ImageIcon,
} from 'lucide-react';
import { InterventionReport } from '../types/gmao';
import { ThermoplasticsLogo } from '../components/ThermoplasticsLogo';

interface ReportDetailsViewProps {
  report: InterventionReport | null;
  onBack: () => void;
}

export const ReportDetailsView: React.FC<ReportDetailsViewProps> = ({
  report,
  onBack,
}) => {
  if (!report) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-neutral-500">Aucun rapport sélectionné.</p>
        <button
          onClick={onBack}
          className="px-6 py-2 bg-neutral-900 text-white rounded-xl text-sm font-bold"
        >
          Retour à la liste
        </button>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  // Strictly parts taken from stock. If none taken, 0.00 DT.
  const partsCost =
    report.stockTaken && report.stockTaken.length > 0
      ? report.stockTaken.reduce(
          (acc, st) => acc + (Number(st.qty) || 0) * (Number(st.unitPrice) || 0),
          0
        )
      : (report.sparePartsCost ?? report.totalCost ?? 0);

  return (
    <div className="p-4 sm:p-8 max-w-[1200px] mx-auto space-y-8 animate-in fade-in duration-200 font-sans">
      {/* Top Bar with Back and Print Actions */}
      <div className="flex items-center justify-between border-b border-neutral-300 pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold text-neutral-800 hover:text-neutral-950 px-3 py-1.5 rounded-xl hover:bg-black/5 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour aux Rapports</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-xs transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer Fiche Technique (PV)</span>
          </button>
        </div>
      </div>

      {/* Main Sheet Container */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-neutral-300 shadow-sm space-y-6">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b-2 border-neutral-900 pb-6 gap-6">
          <ThermoplasticsLogo size="md" />
          <div className="text-left sm:text-right text-xs space-y-1 text-neutral-600">
            <div className="font-black text-lg text-neutral-900 tracking-tight">
              PROCÈS-VERBAL D&apos;INTERVENTION TECHNIQUE
            </div>
            <div>
              Réf. Rapport :{' '}
              <span className="font-mono font-bold text-blue-700">{report.refReport}</span>
            </div>
            <div>
              Date d&apos;émission : <span className="font-bold">{report.date}</span>
            </div>
            <div>
              Statut officiel :{' '}
              <span className="font-bold text-emerald-700">{report.status}</span>
            </div>
          </div>
        </div>

        {/* References Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-[#f8faf9] rounded-2xl border border-neutral-200 text-xs">
          <div>
            <div className="text-neutral-500 font-semibold uppercase text-[10px]">Réf. OT</div>
            <div className="font-mono font-bold text-base text-blue-700 mt-0.5">{report.refOT}</div>
          </div>
          <div>
            <div className="text-neutral-500 font-semibold uppercase text-[10px]">Réf. DI</div>
            <div className="font-mono font-bold text-base text-neutral-900 mt-0.5">{report.refIR || '—'}</div>
          </div>
          <div>
            <div className="text-neutral-500 font-semibold uppercase text-[10px]">Catégorie</div>
            <div className="font-bold text-base text-neutral-900 mt-0.5">{report.category}</div>
          </div>
          <div>
            <div className="text-neutral-500 font-semibold uppercase text-[10px]">Durée estimée</div>
            <div className="font-mono font-bold text-base text-emerald-700 mt-0.5">
              {report.durationMinutes} min
            </div>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────────────────── */}
        {/* CATEGORY-SPECIFIC DETAILS SECTION */}
        {/* ───────────────────────────────────────────────────────────────────────── */}
        {report.category === 'Mold' && (
          <div className="p-5 bg-purple-50/70 rounded-2xl border-2 border-purple-200 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-purple-900 font-bold uppercase tracking-tight text-sm border-b border-purple-200 pb-2">
              <Box className="w-4 h-4 text-purple-700" />
              <span>Détails Spécifiques Outillage &amp; Moule</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-neutral-500 block">N° Moule / Réf :</span>
                <span className="font-mono font-bold text-base text-purple-900">
                  {report.moldNumber || report.equipmentName || 'Non spécifié'}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block">Lieu de réparation :</span>
                <span className="font-bold text-neutral-900">
                  {report.moldRepairLocation === 'external' ? 'Externe (Sous-traitant)' : 'Interne (Atelier moules)'}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block">Statut après réparation :</span>
                <span className="font-bold text-emerald-700">
                  {report.moldStatusAfterRepair || 'En Stock'}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block">Empreintes / Tiroirs :</span>
                <span className="font-semibold text-neutral-800">
                  {report.affectedCavities || 'Ensemble du moule'}
                </span>
              </div>
            </div>

            {report.moldRepairLocation === 'external' && report.moldSupplierName && (
              <div className="pt-2 border-t border-purple-200 text-neutral-800">
                <span className="font-bold">Sous-traitant / Prestataire : </span>
                <span>{report.moldSupplierName}</span>
              </div>
            )}

            {report.issueDescription && (
              <div className="pt-2 border-t border-purple-200 text-neutral-800">
                <span className="font-bold">Description de l&apos;Anomalie Outillage : </span>
                <p className="mt-1 font-medium">{report.issueDescription}</p>
              </div>
            )}

            {(report.imageUrl || report.moldToolingPhotoUrl) && (
              <div className="pt-3 border-t border-purple-200 space-y-2">
                <span className="font-bold text-neutral-700 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-purple-600" />
                  <span>Photo de l&apos;Outillage :</span>
                </span>
                <img
                  src={report.imageUrl || report.moldToolingPhotoUrl}
                  alt="Outillage"
                  className="max-h-60 rounded-xl border border-purple-300 shadow-xs object-contain bg-white p-1"
                />
              </div>
            )}
          </div>
        )}

        {report.category === 'Machine' && (
          <div className="p-5 bg-blue-50/70 rounded-2xl border-2 border-blue-200 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-blue-900 font-bold uppercase tracking-tight text-sm border-b border-blue-200 pb-2">
              <Cpu className="w-4 h-4 text-blue-700" />
              <span>Détails Spécifiques Presse d&apos;Injection (Machine)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <span className="text-neutral-500 block">Machine Concernée :</span>
                <span className="font-mono font-bold text-base text-blue-900">
                  {report.equipmentName || 'Presse standard'}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block">Relevé Horamètre :</span>
                <span className="font-mono font-bold text-base text-emerald-800">
                  {report.meterReadingHours !== undefined ? `${report.meterReadingHours} h` : 'Non consigné'}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block">Statut Machine après travaux :</span>
                <span className="font-bold text-neutral-900">
                  {report.equipmentStatusAfterRepair || 'Running (Opérationnelle)'}
                </span>
              </div>
            </div>
          </div>
        )}

        {report.category === 'Other' && (
          <div className="p-5 bg-amber-50/70 rounded-2xl border-2 border-amber-200 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-amber-900 font-bold uppercase tracking-tight text-sm border-b border-amber-200 pb-2">
              <Building2 className="w-4 h-4 text-amber-700" />
              <span>Détails Spécifiques Utilités &amp; Périphériques</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <span className="text-neutral-500 block">Type d&apos;Équipement Auxiliaire :</span>
                <span className="font-bold text-sm text-neutral-900">
                  {report.auxiliaryEquipmentType || report.equipmentName || 'Utilité atelier'}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block">Localisation Salle Technique :</span>
                <span className="font-semibold text-neutral-800">
                  {report.facilityLocation || 'Atelier principal'}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block">Statut après travaux :</span>
                <span className="font-bold text-neutral-900">
                  {report.equipmentStatusAfterRepair || 'Opérationnel'}
                </span>
              </div>
            </div>

            {report.preventiveMeasures && (
              <div className="pt-2 border-t border-amber-200 text-neutral-800">
                <span className="font-bold">Mesures Préventives : </span>
                <span>{report.preventiveMeasures}</span>
              </div>
            )}

            {report.safetyObservations && (
              <div className="pt-2 border-t border-amber-200 text-neutral-800">
                <span className="font-bold">Observations Sécurité &amp; Environnement : </span>
                <span>{report.safetyObservations}</span>
              </div>
            )}
          </div>
        )}

        {/* Personnel & Root Cause */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="p-4 rounded-2xl border border-neutral-200 space-y-3 bg-[#fbfcfc]">
            <div className="font-bold text-neutral-800 uppercase tracking-tight">Personnel Responsable</div>
            <div className="flex justify-between py-1 border-b border-neutral-200">
              <span className="text-neutral-500">Demandeur :</span>
              <span className="font-bold text-neutral-900">{report.requestedBy}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-neutral-200">
              <span className="text-neutral-500">Technicien Assigné :</span>
              <span className="font-bold text-neutral-900">{report.assignedTo}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-neutral-500">Rapport Clôturé Par :</span>
              <span className="font-bold text-neutral-900">{report.filledBy}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-neutral-200 space-y-3 bg-[#fbfcfc]">
            <div className="font-bold text-neutral-800 uppercase tracking-tight">Diagnostic &amp; Cause de Panne</div>
            <div className="flex justify-between py-1 border-b border-neutral-200">
              <span className="text-neutral-500">Famille de Cause :</span>
              <span className="font-bold text-red-700">{report.cause}</span>
            </div>
            <div className="py-1">
              <span className="text-neutral-500 block mb-0.5">Sous-Cause / Précision :</span>
              <span className="font-semibold text-neutral-900">{report.subCause}</span>
            </div>
            <div className="flex justify-between py-1 border-t border-neutral-200 text-[11px] text-neutral-500">
              <span>Début : {report.startingTime}</span>
              <span>Fin : {report.finishedTime}</span>
            </div>
          </div>
        </div>

        {/* Actions Executed */}
        <div className="space-y-3">
          <div className="text-sm font-bold text-neutral-900 uppercase flex items-center gap-2">
            <Wrench className="w-4 h-4 text-blue-600" />
            <span>Actions &amp; Travaux de Réparation Réalisés</span>
          </div>
          <div className="bg-[#f8faf9] p-5 rounded-2xl border border-neutral-200 space-y-2.5 text-xs">
            {report.actions.map((act, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  {i + 1}
                </span>
                <span className="text-neutral-800 text-sm leading-relaxed">{act}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Difficulties Encountered */}
        {report.difficulties && report.difficulties.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm font-bold text-neutral-900 uppercase flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Difficultés Rencontrées</span>
            </div>
            <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200 space-y-2 text-xs">
              {report.difficulties.map((diff, i) => (
                <div key={i} className="flex items-start gap-2.5 text-neutral-900 text-sm">
                  <span className="font-bold text-amber-700">•</span>
                  <span>{diff}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stock Take */}
        <div className="space-y-3">
          <div className="text-sm font-bold text-neutral-900 uppercase flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-emerald-600" />
              <span>Pièces de Rechange Prélevées du Magasin</span>
            </div>
            <span className="text-xs font-mono font-bold text-neutral-700">
              Total Stock : <strong className="text-blue-700">{partsCost.toFixed(2)} DT</strong>
            </span>
          </div>
          {report.stockTaken && report.stockTaken.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border border-neutral-200 rounded-2xl overflow-hidden">
                <thead className="bg-neutral-100 font-bold text-neutral-700">
                  <tr>
                    <th className="p-3">Réf PDR</th>
                    <th className="p-3">Désignation</th>
                    <th className="p-3 text-center">Quantité</th>
                    <th className="p-3 text-right">Prix Unitaire</th>
                    <th className="p-3 text-right">Total Ligne</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {report.stockTaken.map((st) => (
                    <tr key={st.id}>
                      <td className="p-3 font-mono font-bold text-blue-700">{st.partNumber}</td>
                      <td className="p-3 font-medium text-neutral-900">{st.itemName}</td>
                      <td className="p-3 text-center font-bold">{st.qty}</td>
                      <td className="p-3 text-right font-mono">{st.unitPrice.toFixed(2)} DT</td>
                      <td className="p-3 text-right font-mono font-bold">
                        {(st.qty * st.unitPrice).toFixed(2)} DT
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-xs text-neutral-500 italic p-4 bg-neutral-50 rounded-2xl border border-neutral-200 text-center">
              Aucune pièce de rechange consommée pour cette intervention (Valeur : 0.00 DT).
            </div>
          )}
        </div>

        {/* Financial Summary */}
        <div className="p-5 bg-neutral-900 text-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
              Coût Total de l&apos;Intervention
            </span>
            <span className="text-2xl font-black font-mono text-emerald-400">
              {partsCost.toFixed(2)} DT
            </span>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Strictement basé sur les pièces de rechange prélevées du magasin (0.00 DT si aucun prélèvement).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
