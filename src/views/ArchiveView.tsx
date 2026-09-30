import React, { useState, useMemo } from 'react';
import {
  Archive,
  Search,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  Check,
  FileText,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Cpu,
  UserCheck,
  Wrench,
  Boxes,
  Lock,
  ChevronRight,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import {
  InterventionRequest,
  MaintenanceOrder,
  InterventionReport,
  AppUser,
} from '../types/gmao';
import { ThermoplasticsLogo } from '../components/ThermoplasticsLogo';
import { PaginationBar } from '../components/PaginationBar';
import { exportToXLSX } from '../lib/exportUtils';
import { toast } from 'sonner';

interface ArchiveViewProps {
  requests: InterventionRequest[];
  orders: MaintenanceOrder[];
  reports: InterventionReport[];
  currentUser?: AppUser;
  onUnarchiveRequest: (id: string) => void;
  onOpenPdfReport?: (order: MaintenanceOrder) => void;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({
  requests,
  orders,
  reports,
  currentUser,
  onUnarchiveRequest,
  onOpenPdfReport,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Selected request for viewing related OT and Report
  const [selectedRequest, setSelectedRequest] = useState<InterventionRequest | null>(null);

  // Filter ONLY archived requests
  const archivedRequests = useMemo(() => {
    return requests.filter((r) => r.isArchived);
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return archivedRequests.filter((req) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        req.refIR.toLowerCase().includes(q) ||
        req.problemDescription.toLowerCase().includes(q) ||
        req.requester.toLowerCase().includes(q) ||
        (req.equipmentName && req.equipmentName.toLowerCase().includes(q)) ||
        (req.archivedBy && req.archivedBy.toLowerCase().includes(q)) ||
        (req.relatedOTRef && req.relatedOTRef.toLowerCase().includes(q));

      let matchDate = true;
      if (startDate && req.date < startDate) matchDate = false;
      if (endDate && req.date > endDate) matchDate = false;

      return matchSearch && matchDate;
    });
  }, [archivedRequests, searchQuery, startDate, endDate]);

  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  // Find linked order and report for the selected request
  const relatedOrder = useMemo(() => {
    if (!selectedRequest) return null;
    return (
      orders.find((o) => o.refIR === selectedRequest.refIR) ||
      (selectedRequest.relatedOTRef
        ? orders.find((o) => o.refOT === selectedRequest.relatedOTRef)
        : null)
    );
  }, [selectedRequest, orders]);

  const relatedReport = useMemo(() => {
    if (!selectedRequest) return null;
    if (relatedOrder) {
      const rep = reports.find(
        (r) =>
          r.refOT === relatedOrder.refOT ||
          (relatedOrder.reportRef && (r.refReport === relatedOrder.reportRef || r.id === relatedOrder.reportRef))
      );
      if (rep) return rep;
    }
    return reports.find((r) => r.refIR === selectedRequest.refIR);
  }, [selectedRequest, relatedOrder, reports]);

  // Stats
  const totalArchived = archivedRequests.length;
  const validatedArchived = archivedRequests.filter((r) => r.status === 'Validated').length;
  const withOrderCount = archivedRequests.filter((r) => Boolean(r.relatedOTRef)).length;
  const rejectedArchived = archivedRequests.filter((r) => r.status === 'Rejected').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-200">
      {/* Official Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-300 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <ThermoplasticsLogo size="md" />
          <div className="text-xs text-neutral-500 font-mono pt-1">
            Système GMAO Industriel · Registre Officiel des Demandes d&apos;Intervention Archivées
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => {
              const exportData = filteredRequests.map((r) => ({
                'N° DI': r.refIR,
                Date: r.date,
                Problème: r.problemDescription,
                Équipement: r.equipmentName || '-',
                Demandeur: r.requester,
                'Statut DI': r.status,
                'OT Lié': r.relatedOTRef || '-',
                'Archivé le': r.archivedAt ? new Date(r.archivedAt).toLocaleDateString('fr-FR') : '-',
                'Archivé par': r.archivedBy || '-',
                'Motif Archivage': r.archiveReason || 'Manuel',
              }));
              exportToXLSX(
                exportData,
                `GMAO_Archives_DI_${new Date().toISOString().slice(0, 10)}.xlsx`,
                'Archives DI'
              );
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-neutral-100 text-neutral-800 font-bold text-xs rounded-xl border border-neutral-300 transition-all shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-neutral-300 shadow-2xs">
          <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">Total Archivées</span>
          <span className="text-2xl font-black text-neutral-900 font-mono mt-1 block">{totalArchived}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-neutral-300 shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Validées Antérieurement</span>
          <span className="text-2xl font-black text-emerald-700 font-mono mt-1 block">{validatedArchived}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-neutral-300 shadow-2xs">
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">Avec OT Lié</span>
          <span className="text-2xl font-black text-blue-700 font-mono mt-1 block">{withOrderCount}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-neutral-300 shadow-2xs">
          <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider block">Refusées</span>
          <span className="text-2xl font-black text-red-600 font-mono mt-1 block">{rejectedArchived}</span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-neutral-300 shadow-2xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-1 items-center gap-3 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher par N° DI, problème, équipement, demandeur, archivé par..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl font-medium text-neutral-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-300 rounded-xl font-mono text-xs"
              title="Date début"
            />
            <span className="text-neutral-400">à</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 bg-neutral-50 border border-neutral-300 rounded-xl font-mono text-xs"
              title="Date fin"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="px-2 py-1 text-neutral-500 hover:text-neutral-900 underline text-xs cursor-pointer"
              >
                Effacer
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-[#ebeeed] rounded-3xl border border-neutral-400/80 shadow-xs overflow-hidden flex flex-col justify-between min-h-[460px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-300 text-xs font-bold text-neutral-900 bg-black/5 uppercase tracking-wider">
                <th className="py-3.5 px-5">Date DI</th>
                <th className="py-3.5 px-5">Réf. DI</th>
                <th className="py-3.5 px-6">Problème Constaté</th>
                <th className="py-3.5 px-5">Équipement</th>
                <th className="py-3.5 px-5">Demandeur</th>
                <th className="py-3.5 px-5 text-center">Statut DI</th>
                <th className="py-3.5 px-5">Date Archivage</th>
                <th className="py-3.5 px-5">OT Lié</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-300/70 text-xs font-medium text-neutral-800">
              {paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-500 font-medium">
                    Aucune demande d&apos;intervention archivée. Pour archiver une demande, cliquez sur le bouton d&apos;archivage dans l&apos;interface &quot;Intervention Requests&quot;.
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => setSelectedRequest(req)}
                    className="hover:bg-white/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-5 font-mono text-neutral-700 whitespace-nowrap">
                      {req.date}
                    </td>
                    <td className="py-3.5 px-5 font-mono font-black text-blue-700 whitespace-nowrap">
                      {req.refIR}
                    </td>
                    <td className="py-3.5 px-6 max-w-sm">
                      <div className="font-bold text-neutral-900 text-sm leading-snug line-clamp-2">
                        {req.problemDescription}
                      </div>
                    </td>
                    <td className="py-3.5 px-5 max-w-xs">
                      <span className="font-bold text-neutral-800">
                        {req.equipmentName || '-'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <div className="font-semibold text-neutral-900">{req.requester}</div>
                      <div className="text-[11px] text-neutral-500 capitalize">
                        {req.requesterRole || 'Technicien'}
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          req.status === 'Validated'
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : req.status === 'Waiting'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-red-100 text-red-900 border-red-300'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 whitespace-nowrap text-neutral-700 font-mono">
                      <div>
                        {req.archivedAt ? new Date(req.archivedAt).toLocaleDateString('fr-FR') : '—'}
                      </div>
                      <div className="text-[11px] text-neutral-500">Par: {req.archivedBy || 'Admin'}</div>
                    </td>
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      {req.relatedOTRef ? (
                        <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          {req.relatedOTRef}
                        </span>
                      ) : (
                        <span className="text-neutral-400 italic text-[11px]">Aucun OT</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div
                        className="flex items-center justify-end gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedRequest(req)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                          title="Voir le dossier complet, l'OT associé et le rapport d'intervention"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Dossier &amp; Workflow</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Désarchiver la demande ${req.refIR} et la restaurer dans les demandes actives ?`)) {
                              onUnarchiveRequest(req.id);
                              toast.success(`Demande ${req.refIR} restaurée avec succès.`);
                            }
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                          title="Restaurer cette demande vers la liste active des DI"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                          <span>Désarchiver</span>
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
          totalItems={filteredRequests.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* ========================================================================= */}
      {/* RELATED WORK ORDER & INTERVENTION REPORT WORKFLOW MODAL                   */}
      {/* ========================================================================= */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-6 sm:p-8 border border-neutral-300 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
            {/* Modal Top Header */}
            <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-neutral-900 text-white flex items-center justify-center shadow-xs">
                  <Archive className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black bg-blue-100 text-blue-900 px-2.5 py-0.5 rounded border border-blue-300">
                      {selectedRequest.refIR}
                    </span>
                    <span className="text-xs font-mono text-neutral-500">
                      Dossier d&apos;Archive Complet
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-neutral-900 tracking-tight mt-0.5">
                    {selectedRequest.equipmentName || 'Équipement non spécifié'} — Suivi &amp; Workflow de Validation
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="w-9 h-9 rounded-xl text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Archive Meta Status Banner */}
            <div className="bg-neutral-50 border border-neutral-300 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <Archive className="w-5 h-5 text-neutral-600" />
                <div>
                  <span className="font-bold text-neutral-900">Demande Archivée le : </span>
                  <span className="font-mono font-bold text-neutral-700">
                    {selectedRequest.archivedAt
                      ? new Date(selectedRequest.archivedAt).toLocaleString('fr-FR')
                      : 'Date non renseignée'}
                  </span>
                  <span className="text-neutral-500 ml-2">· Par : <strong>{selectedRequest.archivedBy || 'Admin'}</strong></span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onUnarchiveRequest(selectedRequest.id);
                  setSelectedRequest(null);
                  toast.success(`Demande ${selectedRequest.refIR} désarchivée.`);
                }}
                className="px-3.5 py-1.5 bg-white hover:bg-neutral-100 text-neutral-800 font-bold border border-neutral-300 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                <span>Restaurer vers Demandes Actives</span>
              </button>
            </div>

            {/* ─────────────────────────────────────────────────────────────────── */}
            {/* WORKFLOW SUMMARY TABLE (DI -> OT -> REPORT -> ARCHIVE)            */}
            {/* ─────────────────────────────────────────────────────────────────── */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-neutral-700 flex items-center gap-2">
                <Layers className="w-4 h-4 text-neutral-700" />
                <span>Cycle de Vie Complet &amp; Workflow de Validation Associé</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* 1. DI Card */}
                <div className="p-4 bg-white rounded-2xl border-2 border-neutral-300 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-bold text-neutral-900 uppercase">1. Demande (DI)</span>
                    <span className="font-mono font-black text-blue-700">{selectedRequest.refIR}</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-neutral-600">
                      <span>Date :</span>
                      <span className="font-mono font-bold text-neutral-900">{selectedRequest.date}</span>
                    </div>
                    <div className="flex justify-between text-neutral-600">
                      <span>Demandeur :</span>
                      <span className="font-bold text-neutral-900">{selectedRequest.requester}</span>
                    </div>
                    <div className="flex justify-between text-neutral-600">
                      <span>Statut :</span>
                      <span className="font-bold text-emerald-700">{selectedRequest.status}</span>
                    </div>
                    {selectedRequest.validatedBy && (
                      <div className="flex justify-between text-neutral-600">
                        <span>Validé par :</span>
                        <span className="font-bold text-purple-800">{selectedRequest.validatedBy}</span>
                      </div>
                    )}
                  </div>
                  <div className="pt-2 border-t text-[11px] text-neutral-700">
                    <span className="font-bold block text-neutral-500 mb-0.5">Description :</span>
                    <p className="bg-neutral-50 p-2 rounded-lg border border-neutral-200">
                      {selectedRequest.problemDescription}
                    </p>
                  </div>
                </div>

                {/* 2. Related OT Card */}
                <div className="p-4 bg-white rounded-2xl border-2 border-neutral-300 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-bold text-neutral-900 uppercase">2. Ordre de Travail (OT)</span>
                    {relatedOrder ? (
                      <span className="font-mono font-black text-purple-700">{relatedOrder.refOT}</span>
                    ) : (
                      <span className="text-neutral-400 italic text-[11px]">Non généré</span>
                    )}
                  </div>
                  {relatedOrder ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-neutral-600">
                        <span>Assigné à :</span>
                        <span className="font-bold text-neutral-900">{relatedOrder.assignedTo || 'Technicien'}</span>
                      </div>
                      <div className="flex justify-between text-neutral-600">
                        <span>Catégorie :</span>
                        <span className="font-bold text-neutral-900">{relatedOrder.category}</span>
                      </div>
                      <div className="flex justify-between text-neutral-600">
                        <span>Priorité :</span>
                        <span className="font-bold text-neutral-900">{relatedOrder.priority}</span>
                      </div>
                      <div className="flex justify-between text-neutral-600">
                        <span>Statut OT :</span>
                        <span className="font-bold text-blue-700">{relatedOrder.status}</span>
                      </div>
                      <div className="pt-2 border-t text-[11px] text-neutral-700">
                        <span className="font-bold block text-neutral-500 mb-0.5">Description OT :</span>
                        <p className="bg-neutral-50 p-2 rounded-lg border border-neutral-200 truncate">
                          {relatedOrder.description}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-neutral-400 italic">
                      Aucun ordre de travail créé pour cette demande.
                    </div>
                  )}
                </div>

                {/* 3. Related Report (PV) Card */}
                <div className="p-4 bg-white rounded-2xl border-2 border-neutral-300 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-bold text-neutral-900 uppercase">3. Rapport &amp; PV Clôture</span>
                    {relatedReport ? (
                      <span className="font-mono font-black text-emerald-700">{relatedReport.refReport}</span>
                    ) : (
                      <span className="text-neutral-400 italic text-[11px]">En attente PV</span>
                    )}
                  </div>
                  {relatedReport ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-neutral-600">
                        <span>Intervenant :</span>
                        <span className="font-bold text-neutral-900">{relatedReport.filledBy || relatedReport.assignedTo}</span>
                      </div>
                      <div className="flex justify-between text-neutral-600">
                        <span>Durée :</span>
                        <span className="font-mono font-bold text-neutral-900">{relatedReport.durationMinutes} min</span>
                      </div>
                      {relatedReport.meterReadingHours != null && (
                        <div className="flex justify-between text-neutral-600">
                          <span>Relevé Horamètre :</span>
                          <span className="font-mono font-bold text-blue-700">{relatedReport.meterReadingHours} h</span>
                        </div>
                      )}
                      <div className="flex justify-between text-neutral-600">
                        <span>Coût Pièces :</span>
                        <span className="font-mono font-bold text-emerald-800">
                          {(relatedReport.sparePartsCost || relatedReport.totalCost || 0).toLocaleString()} DT
                        </span>
                      </div>
                      <div className="flex justify-between text-neutral-600">
                        <span>Statut Rapport :</span>
                        <span className="font-bold text-emerald-700">{relatedReport.status}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-neutral-400 italic">
                      Aucun rapport d&apos;intervention clôturé pour cet ordre.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────────── */}
            {/* WORK ORDER 3 PRE-VALIDATIONS TABLE                                  */}
            {/* ─────────────────────────────────────────────────────────────────── */}
            {relatedOrder && (
              <div className="space-y-3 bg-neutral-50 p-5 rounded-2xl border border-neutral-300">
                <h4 className="text-xs font-black uppercase tracking-wider text-neutral-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-neutral-700" />
                    <span>Tableau des 3 Pré-Validations d&apos;Autorisation de Travaux (Point 10)</span>
                  </div>
                  <span className="font-mono font-bold text-[11px] text-neutral-500">
                    OT : {relatedOrder.refOT}
                  </span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Step 1: Resp Maint */}
                  <div className="bg-white p-3.5 rounded-xl border border-neutral-300 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-neutral-800">1. Resp. Maintenance :</span>
                      {relatedOrder.validationRespMaint?.validated ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          ✓ Validé
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          ⏳ En attente
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-600">
                      Par : <strong>{relatedOrder.validationRespMaint?.validatedBy || '-'}</strong>
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono">
                      {relatedOrder.validationRespMaint?.validatedAt || '-'}
                    </div>
                    {relatedOrder.validationRespMaint?.estimatedHours && (
                      <div className="text-[11px] text-blue-700 font-bold font-mono pt-1 border-t">
                        Temps alloué : {relatedOrder.validationRespMaint.estimatedHours} h
                      </div>
                    )}
                  </div>

                  {/* Step 2: Resp Prod */}
                  <div className="bg-white p-3.5 rounded-xl border border-neutral-300 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-neutral-800">2. Resp. Production :</span>
                      {relatedOrder.validationRespProd?.validated ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          ✓ Validé
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          ⏳ En attente
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-600">
                      Par : <strong>{relatedOrder.validationRespProd?.validatedBy || '-'}</strong>
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono">
                      {relatedOrder.validationRespProd?.validatedAt || '-'}
                    </div>
                  </div>

                  {/* Step 3: QHSE */}
                  <div className="bg-white p-3.5 rounded-xl border border-neutral-300 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-neutral-800">3. Sécurité / QHSE :</span>
                      {relatedOrder.validationQHSE?.validated ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          ✓ Validé
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          ⏳ En attente
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-600">
                      Par : <strong>{relatedOrder.validationQHSE?.validatedBy || '-'}</strong>
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono">
                      {relatedOrder.validationQHSE?.validatedAt || '-'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────── */}
            {/* WORK ORDER 2 POST-VALIDATIONS TABLE (RECEVAL & CLOSEOUT)            */}
            {/* ─────────────────────────────────────────────────────────────────── */}
            {relatedOrder && (
              <div className="space-y-3 bg-neutral-50 p-5 rounded-2xl border border-neutral-300">
                <h4 className="text-xs font-black uppercase tracking-wider text-neutral-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-neutral-700" />
                    <span>Tableau des 2 Post-Validations de Clôture &amp; Réception des Travaux (Point 13)</span>
                  </div>
                  {relatedOrder.status === 'Completed' && onOpenPdfReport && (
                    <button
                      type="button"
                      onClick={() => onOpenPdfReport(relatedOrder)}
                      className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Télécharger PV Officiel PDF</span>
                    </button>
                  )}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Post 1: Resp Prod Reception */}
                  <div className="bg-white p-3.5 rounded-xl border border-neutral-300 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-neutral-800">Post-Étape 1 : Réception Production</span>
                      {relatedOrder.validationReportProd?.validated ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          ✓ Conforme &amp; Réceptionné
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200">
                          Non clôturé
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-600">
                      Signé par : <strong>{relatedOrder.validationReportProd?.validatedBy || '-'}</strong>
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono">
                      {relatedOrder.validationReportProd?.validatedAt || '-'}
                    </div>
                  </div>

                  {/* Post 2: Resp Tech Closeout */}
                  <div className="bg-white p-3.5 rounded-xl border border-neutral-300 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-neutral-800">Post-Étape 2 : Clôture Technique Finale</span>
                      {relatedOrder.validationReportTech?.validated ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          ✓ Clôturé &amp; Signé
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200">
                          Non clôturé
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-600">
                      Signé par : <strong>{relatedOrder.validationReportTech?.validatedBy || '-'}</strong>
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono">
                      {relatedOrder.validationReportTech?.validatedAt || '-'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────── */}
            {/* SPARE PARTS CONSUMED FROM WAREHOUSE                                */}
            {/* ─────────────────────────────────────────────────────────────────── */}
            {relatedReport && relatedReport.stockTaken && relatedReport.stockTaken.length > 0 && (
              <div className="space-y-3 bg-neutral-50 p-5 rounded-2xl border border-neutral-300 text-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-neutral-700" />
                    <span className="font-bold text-neutral-900 uppercase">
                      Pièces de Rechange Sorties du Magasin pour cette Intervention
                    </span>
                  </div>
                  <span className="font-mono font-bold text-emerald-800">
                    Total : {(relatedReport.sparePartsCost || relatedReport.totalCost || 0).toLocaleString()} DT
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b text-[11px] font-bold text-neutral-600">
                        <th className="py-1.5 px-3">Référence</th>
                        <th className="py-1.5 px-3">Désignation</th>
                        <th className="py-1.5 px-3 text-center">Quantité</th>
                        <th className="py-1.5 px-3 text-right">Prix Unitaire</th>
                        <th className="py-1.5 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-xs font-mono">
                      {relatedReport.stockTaken.map((st, i) => (
                        <tr key={i}>
                          <td className="py-2 px-3 font-bold text-blue-700">{st.partNumber}</td>
                          <td className="py-2 px-3 font-sans text-neutral-800">{st.itemName}</td>
                          <td className="py-2 px-3 text-center font-bold text-neutral-900">{st.qty}</td>
                          <td className="py-2 px-3 text-right text-neutral-600">{st.unitPrice} DT</td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-700">
                            {(st.qty * st.unitPrice).toFixed(2)} DT
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
              <span className="text-xs text-neutral-500 font-mono">
                Référence dossier : ARCH-{selectedRequest.refIR}
              </span>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="px-5 py-2.5 bg-neutral-900 hover:bg-black text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Fermer le dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
