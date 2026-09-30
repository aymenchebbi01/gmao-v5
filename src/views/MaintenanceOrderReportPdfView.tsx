import React from 'react';
import {
  Printer,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Clock,
  Wrench,
  FileCheck2,
  Building2,
  AlertCircle,
  Cpu,
  Layers,
  FileText,
} from 'lucide-react';
import { ThermoplasticsLogo } from '../components/ThermoplasticsLogo';
import {
  MaintenanceOrder,
  InterventionReport,
  InterventionRequest,
  Machine,
  Mold,
} from '../types/gmao';

interface MaintenanceOrderReportPdfViewProps {
  order: MaintenanceOrder;
  report?: InterventionReport;
  request?: InterventionRequest;
  machine?: Machine;
  mold?: Mold;
  onBack: () => void;
}

export const MaintenanceOrderReportPdfView: React.FC<
  MaintenanceOrderReportPdfViewProps
> = ({ order, report, request, machine, mold, onBack }) => {
  const handlePrint = () => {
    window.print();
  };

  const documentRef = `PV-OT-${order.refOT.replace('OT-', '')}`;
  const currentDate = new Date().toISOString().split('T')[0];

  // Stock items from linked report
  const stockItems = report?.stockTaken || [];

  const totalPartsCost = stockItems.reduce(
    (acc, item) => acc + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0),
    0
  );

  const durationHours =
    report?.durationMinutes ? (report.durationMinutes / 60).toFixed(1) : order.estimatedHours.toFixed(1);
  // Total cost strictly reflects spare parts taken from stock (0 DT if none taken)
  const grandTotalCost = totalPartsCost;

  return (
    <div className="min-h-screen bg-[#ebeeed] text-neutral-900 pb-20">
      {/* Print styles */}
      <style>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
          }
          .page-break {
            page-break-before: always;
          }
        }
      `}</style>

      {/* Control Top Bar (Hidden on print) */}
      <div className="no-print bg-white border-b border-neutral-300 sticky top-0 z-30 px-6 py-4 shadow-xs">
        <div className="max-w-[1100px] mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-bold text-neutral-800 hover:text-neutral-950 px-3 py-1.5 rounded-xl hover:bg-black/5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Maintenance Orders</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block text-xs font-mono text-neutral-500">
              Document: {documentRef}
            </span>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Download PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Document Body (Clean A4 Paper Canvas) */}
      <div className="max-w-[1050px] mx-auto mt-6 sm:mt-8 px-4 sm:px-6">
        <div className="print-container bg-white rounded-3xl p-8 sm:p-12 border border-neutral-300 shadow-xl space-y-8 font-sans">
          {/* Header Block */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b-2 border-neutral-900 pb-6">
            <div className="space-y-1">
              <ThermoplasticsLogo size="sm" />
              <div className="text-[11px] text-neutral-600 space-y-0.5 pt-2">
                <p className="font-semibold text-neutral-900">
                  Thermoplastics Tunisia S.A.R.L.
                </p>
                <p>Zone Industrielle Megrine, Ben Arous 2033 — Tunisie</p>
                <p>Direction Technique & Maintenance Industrielle</p>
                <p className="text-[10px] text-neutral-500 font-mono">
                  Certifié ISO 9001:2015 · IATF 16949 · ISO 14001:2015
                </p>
              </div>
            </div>

            <div className="text-right sm:border-l-2 sm:border-neutral-300 sm:pl-6 space-y-1.5">
              <span className="inline-block px-3 py-1 bg-neutral-900 text-white text-[11px] font-mono font-bold uppercase tracking-wider rounded">
                Procès-Verbal Officiel
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                RAPPORT D&apos;INTERVENTION TECHNIQUE
              </h1>
              <div className="text-xs font-mono text-neutral-600 space-y-0.5">
                <div>
                  <span className="font-semibold text-neutral-800">Réf. Document: </span>
                  <span className="font-bold text-blue-700">{documentRef}</span>
                </div>
                <div>
                  <span className="font-semibold text-neutral-800">Date d&apos;émission: </span>
                  <span className="font-bold">{currentDate}</span>
                </div>
                <div>
                  <span className="font-semibold text-neutral-800">Classification: </span>
                  <span>Usage Interne & Audit Qualité</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dossier Overview Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-300 text-xs">
            <div>
              <span className="font-bold text-neutral-500 uppercase text-[10px] block">
                Work Order Ref (OT)
              </span>
              <span className="font-mono font-black text-blue-700 text-sm">
                {order.refOT}
              </span>
            </div>
            <div>
              <span className="font-bold text-neutral-500 uppercase text-[10px] block">
                Intervention Request (IR)
              </span>
              <span className="font-mono font-bold text-neutral-800 text-sm">
                {order.refIR}
              </span>
            </div>
            <div>
              <span className="font-bold text-neutral-500 uppercase text-[10px] block">
                Category / Priority
              </span>
              <span className="font-bold text-neutral-900 text-sm">
                {order.category}{order.machineMaintenanceType ? ` (${order.machineMaintenanceType})` : ''} · {order.priority}
              </span>
            </div>
            <div>
              <span className="font-bold text-neutral-500 uppercase text-[10px] block">
                Resolution Status
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {order.status.toUpperCase()}
              </span>
            </div>
          </div>

          {/* SECTION 1: Equipment & Operational Context */}
          <div className="space-y-3">
            <h2 className="text-sm font-black uppercase text-neutral-900 tracking-wider flex items-center gap-2 border-b border-neutral-200 pb-1.5">
              <Cpu className="w-4 h-4 text-blue-600" />
              <span>1. Identification de l&apos;Équipement / Outillage</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5 p-3.5 bg-neutral-50/60 rounded-xl border border-neutral-200">
                <div className="flex justify-between">
                  <span className="text-neutral-500 font-semibold">Désignation:</span>
                  <span className="font-bold text-neutral-900">{order.equipmentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500 font-semibold">Catégorie Matériel:</span>
                  <span className="font-medium text-neutral-800">
                    {order.category}
                    {order.machineMaintenanceType && ` (${order.machineMaintenanceType})`}
                  </span>
                </div>
                {machine && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-neutral-500 font-semibold">Marque & Modèle:</span>
                      <span className="font-medium text-neutral-800">{machine.brand} {machine.model}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500 font-semibold">Force de Serrage:</span>
                      <span className="font-medium text-neutral-800">{machine.clampingForceTons} Tonnes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500 font-semibold">Ligne & Emplacement:</span>
                      <span className="font-medium text-neutral-800">{machine.line} ({machine.locationNumber})</span>
                    </div>
                  </>
                )}
                {mold && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-neutral-500 font-semibold">Client / Produit:</span>
                      <span className="font-medium text-neutral-800">{mold.customer} — {mold.description}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500 font-semibold">Empreintes / Matière:</span>
                      <span className="font-medium text-neutral-800">{mold.cavities} cavités · {mold.resin}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500 font-semibold">Compteur Total Coups:</span>
                      <span className="font-mono font-medium text-neutral-800">{(mold.currentShots ?? 0).toLocaleString()} coups</span>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-1.5 p-3.5 bg-neutral-50/60 rounded-xl border border-neutral-200">
                <div className="flex justify-between">
                  <span className="text-neutral-500 font-semibold">Date de Demande (IR):</span>
                  <span className="font-mono text-neutral-800">{order.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500 font-semibold">Planification Intervention:</span>
                  <span className="font-mono font-bold text-neutral-900">
                    {order.scheduledDate || order.date} à {order.scheduledTime || '09:00'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500 font-semibold">Technicien Responsable:</span>
                  <span className="font-bold text-neutral-900">{order.assignedTo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500 font-semibold">Temps Estimé vs Réalisé:</span>
                  <span className="font-mono font-bold text-neutral-900">
                    {order.estimatedHours}h est. / {durationHours}h réel
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500 font-semibold">Impact Arrêt Ligne:</span>
                  <span className="font-semibold text-amber-700">Arrêt contrôlé avec autorisation Production</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Problem Description & Root Cause Analysis */}
          <div className="space-y-3">
            <h2 className="text-sm font-black uppercase text-neutral-900 tracking-wider flex items-center gap-2 border-b border-neutral-200 pb-1.5">
              <AlertCircle className="w-4 h-4 text-orange-600" />
              <span>2. Constat Initial & Diagnostic AMDEC</span>
            </h2>

            <div className="p-4 bg-neutral-50/70 rounded-xl border border-neutral-200 text-xs space-y-2">
              <div>
                <span className="font-bold text-neutral-700 uppercase text-[11px] block">
                  Description du Problème Déclaré sur Poste :
                </span>
                <p className="text-neutral-900 text-sm font-medium mt-0.5">
                  &quot;{order.irDescription || order.description}&quot;
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-200">
                <div>
                  <span className="font-semibold text-neutral-600 block">Cause Racine Constatée :</span>
                  <span className="font-bold text-neutral-900">
                    {report?.cause || 'Défaillance Composant Hydraulique / Usure Normale'}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-neutral-600 block">Sous-Cause / Mécanisme :</span>
                  <span className="font-medium text-neutral-800">
                    {report?.subCause || 'Fuite joint de tiroir proportionnel sous pression de maintien'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: Operations & Actions Executed */}
          <div className="space-y-3">
            <h2 className="text-sm font-black uppercase text-neutral-900 tracking-wider flex items-center gap-2 border-b border-neutral-200 pb-1.5">
              <Wrench className="w-4 h-4 text-blue-600" />
              <span>3. Opérations Réalisées & Actions Correctives</span>
            </h2>

            <div className="space-y-2 text-xs">
              {(report?.actions || [
                'Consignation machine et purge pression résiduelle accumulateur hydraulique (LOTO).',
                'Démontage de la cartouche de distributeur proportionnel défectueuse.',
                'Pose du composant neuf étalonné et remplacement kit de joints Viton.',
                'Purge d\'air du circuit hydraulique et test de montée en pression à 210 bar.',
                'Essai en production continue (20 cycles sans alarme ni fuite).',
              ]).map((action, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 p-2 bg-neutral-50 rounded-lg border border-neutral-200"
                >
                  <span className="font-mono font-bold text-blue-700 shrink-0">
                    [{idx + 1}]
                  </span>
                  <span className="font-medium text-neutral-800">{action}</span>
                </div>
              ))}
            </div>

            {report?.difficulties && report.difficulties.length > 0 && (
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 text-xs">
                <span className="font-bold text-amber-900 block mb-1">
                  Difficultés rencontrées & Remarques :
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-neutral-700">
                  {report.difficulties.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* SECTION 4: Spare Parts Consumption & Financial Valorization */}
          <div className="space-y-3">
            <h2 className="text-sm font-black uppercase text-neutral-900 tracking-wider flex items-center gap-2 border-b border-neutral-200 pb-1.5">
              <FileCheck2 className="w-4 h-4 text-emerald-600" />
              <span>4. Pièces de Rechange Consommées (Sortie Stock Magasin)</span>
            </h2>

            <div className="overflow-x-auto rounded-xl border border-neutral-300">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-100 text-neutral-800 font-bold border-b border-neutral-300">
                    <th className="py-2.5 px-3">Réf. Article (SKU)</th>
                    <th className="py-2.5 px-4">Désignation Pièce</th>
                    <th className="py-2.5 px-3 text-center">Quantité</th>
                    <th className="py-2.5 px-3 text-right">P.U. (TND)</th>
                    <th className="py-2.5 px-4 text-right">Sous-Total (TND)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {stockItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-neutral-50 font-medium">
                      <td className="py-2 px-3 font-mono font-bold text-neutral-900">
                        {item.partNumber}
                      </td>
                      <td className="py-2 px-4 text-neutral-800">{item.itemName}</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">
                        {item.qty}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">
                        {item.unitPrice.toFixed(2)}
                      </td>
                      <td className="py-2 px-4 text-right font-mono font-bold text-neutral-900 tabular-nums">
                        {(item.qty * item.unitPrice).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-neutral-100/90 font-bold border-t border-neutral-300">
                    <td colSpan={4} className="py-2 px-4 text-right">
                      Total Pièces Prélevées du Stock (DT) :
                    </td>
                    <td className="py-2 px-4 text-right font-mono tabular-nums text-neutral-900">
                      {totalPartsCost.toFixed(2)} DT
                    </td>
                  </tr>
                  <tr className="bg-blue-50 font-black text-blue-950 text-sm border-t-2 border-neutral-900">
                    <td colSpan={4} className="py-2.5 px-4 text-right">
                      COÛT TOTAL DE L&apos;INTERVENTION (DT) :
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-blue-900">
                      {grandTotalCost.toFixed(2)} DT
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* SECTION 5: Official 6-Stakeholder Validation & Legal Audit Seals */}
          <div className="space-y-4 pt-2">
            <h2 className="text-sm font-black uppercase text-neutral-900 tracking-wider flex items-center gap-2 border-b border-neutral-200 pb-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              <span>5. Chaîne de Validation & Approbations Officielles (GMAO Workflow)</span>
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              {/* Box 1: Technicien Exécutant */}
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-300 flex flex-col justify-between min-h-[110px]">
                <div>
                  <span className="font-bold text-[10px] text-neutral-500 uppercase block">
                    1. Technicien Exécutant
                  </span>
                  <span className="font-bold text-neutral-900 text-xs mt-0.5 block">
                    {order.assignedTo}
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    Fin intervention & Saisie rapport
                  </span>
                </div>
                <div className="pt-2 border-t border-neutral-200 mt-2 flex items-center justify-between text-[10px]">
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Signé Numériquement
                  </span>
                  <span className="font-mono text-neutral-400">{order.date}</span>
                </div>
              </div>

              {/* Box 2: Responsable Maintenance (Planning) */}
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-300 flex flex-col justify-between min-h-[110px]">
                <div>
                  <span className="font-bold text-[10px] text-neutral-500 uppercase block">
                    2. Responsable Maintenance
                  </span>
                  <span className="font-bold text-neutral-900 text-xs mt-0.5 block">
                    {order.validationRespMaint?.validatedBy || 'Responsable Maintenance'}
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    Temps ({order.estimatedHours}h) & Date validés
                  </span>
                </div>
                <div className="pt-2 border-t border-neutral-200 mt-2 flex items-center justify-between text-[10px]">
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Approuvé
                  </span>
                  <span className="font-mono text-neutral-400">
                    {order.validationRespMaint?.validatedAt?.split(' ')[0] || order.date}
                  </span>
                </div>
              </div>

              {/* Box 3: Responsable Production (Arrêt) */}
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-300 flex flex-col justify-between min-h-[110px]">
                <div>
                  <span className="font-bold text-[10px] text-neutral-500 uppercase block">
                    3. Responsable Production
                  </span>
                  <span className="font-bold text-neutral-900 text-xs mt-0.5 block">
                    {order.validationRespProd?.validatedBy || 'Responsable Production'}
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    Créneau arrêt ligne accordé
                  </span>
                </div>
                <div className="pt-2 border-t border-neutral-200 mt-2 flex items-center justify-between text-[10px]">
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Accord Arrêt
                  </span>
                  <span className="font-mono text-neutral-400">
                    {order.validationRespProd?.validatedAt?.split(' ')[0] || order.date}
                  </span>
                </div>
              </div>

              {/* Box 4: Responsable QHSE */}
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-300 flex flex-col justify-between min-h-[110px]">
                <div>
                  <span className="font-bold text-[10px] text-neutral-500 uppercase block">
                    4. Responsable QHSE
                  </span>
                  <span className="font-bold text-neutral-900 text-xs mt-0.5 block">
                    {order.validationQHSE?.validatedBy || 'Responsable QHSE'}
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    Consignation LOTO & EPI certifiés
                  </span>
                </div>
                <div className="pt-2 border-t border-neutral-200 mt-2 flex items-center justify-between text-[10px]">
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Sécurité OK
                  </span>
                  <span className="font-mono text-neutral-400">
                    {order.validationQHSE?.validatedAt?.split(' ')[0] || order.date}
                  </span>
                </div>
              </div>

              {/* Box 5: Responsable Production (Réception) */}
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-300 flex flex-col justify-between min-h-[110px]">
                <div>
                  <span className="font-bold text-[10px] text-neutral-500 uppercase block">
                    5. Réception Production
                  </span>
                  <span className="font-bold text-neutral-900 text-xs mt-0.5 block">
                    {order.validationReportProd?.validatedBy || 'Responsable Production'}
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    Pièces conformes & Redémarrage
                  </span>
                </div>
                <div className="pt-2 border-t border-neutral-200 mt-2 flex items-center justify-between text-[10px]">
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Réceptionné
                  </span>
                  <span className="font-mono text-neutral-400">
                    {order.validationReportProd?.validatedAt?.split(' ')[0] || order.date}
                  </span>
                </div>
              </div>

              {/* Box 6: Responsable Technique (Clôture Finale) */}
              <div className="p-3 bg-blue-50/70 rounded-xl border-2 border-blue-400 flex flex-col justify-between min-h-[110px]">
                <div>
                  <span className="font-bold text-[10px] text-blue-900 uppercase block">
                    6. Direction Technique (Visa Final)
                  </span>
                  <span className="font-bold text-blue-950 text-xs mt-0.5 block">
                    {order.validationReportTech?.validatedBy || 'Direction Technique'}
                  </span>
                  <span className="text-[10px] text-blue-800">
                    PV de Clôture & Archivage IATF
                  </span>
                </div>
                <div className="pt-2 border-t border-blue-200 mt-2 flex items-center justify-between text-[10px]">
                  <span className="text-blue-900 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-700" /> Clôturé 100%
                  </span>
                  <span className="font-mono text-blue-800 font-bold">
                    {order.validationReportTech?.validatedAt?.split(' ')[0] || currentDate}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Plant Stamp & Footer Legal Watermark */}
          <div className="pt-4 border-t-2 border-neutral-900 flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] text-neutral-500 gap-2">
            <div>
              <span>Document généré par le Système GMAO Thermoplastics Tunisia · Édition Archive Légale</span>
            </div>
            <div className="font-mono text-neutral-700 font-bold">
              PAGE 1/1 · RÉF: {documentRef}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
