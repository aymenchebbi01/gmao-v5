import React, { useState, useMemo } from 'react';
import { GmaoToolbar } from '../components/GmaoToolbar';
import { PaginationBar } from '../components/PaginationBar';
import { InterventionReport, MaintenanceCategory, AppUser, ReportStatus, PriorityLevel } from '../types/gmao';
import { Eye, Printer, CheckCircle2, Clock, Wrench, ShieldAlert, Trash2, Edit2, AlertTriangle, X } from 'lucide-react';

interface InterventionReportsViewProps {
  reports: InterventionReport[];
  onOpenReportDetails: (report: InterventionReport) => void;
  onOpenNewReportModal: () => void;
  onDeleteReport?: (id: string) => void;
  onEditReport?: (report: InterventionReport) => void;
  currentUser?: AppUser;
}

export const InterventionReportsView: React.FC<InterventionReportsViewProps> = ({
  reports,
  onOpenReportDetails,
  onOpenNewReportModal,
  onDeleteReport,
  onEditReport,
  currentUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MaintenanceCategory | 'All'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Admin Delete & Edit States
  const [deletingReport, setDeletingReport] = useState<InterventionReport | null>(null);
  const [editingReport, setEditingReport] = useState<InterventionReport | null>(null);
  const [editReportData, setEditReportData] = useState<{
    date: string;
    cause: string;
    subCause: string;
    filledBy: string;
    durationMinutes: number;
    status: ReportStatus;
    priority: PriorityLevel;
  }>({
    date: '',
    cause: '',
    subCause: '',
    filledBy: '',
    durationMinutes: 60,
    status: 'Draft',
    priority: 'High',
  });

  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    return (currentUser.role || '').toLowerCase() === 'admin';
  }, [currentUser]);

  const handleOpenEdit = (rep: InterventionReport) => {
    setEditingReport(rep);
    setEditReportData({
      date: rep.date || '',
      cause: rep.cause || '',
      subCause: rep.subCause || '',
      filledBy: rep.filledBy || '',
      durationMinutes: rep.durationMinutes || 60,
      status: rep.status,
      priority: rep.priority || 'High',
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReport) return;
    const updated: InterventionReport = {
      ...editingReport,
      date: editReportData.date,
      cause: editReportData.cause.trim(),
      subCause: editReportData.subCause.trim(),
      filledBy: editReportData.filledBy.trim(),
      durationMinutes: Number(editReportData.durationMinutes) || 0,
      status: editReportData.status,
      priority: editReportData.priority,
    };
    onEditReport?.(updated);
    setEditingReport(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingReport) return;
    onDeleteReport?.(deletingReport.id);
    setDeletingReport(null);
  };

  // Deduplicate reports by work order (refOT) to guarantee one row per work order
  const deduplicatedReports = useMemo(() => {
    const seenOT = new Set<string>();
    const list: InterventionReport[] = [];
    for (const r of reports) {
      const key = (r.refOT || r.id).trim().toUpperCase();
      if (!seenOT.has(key)) {
        seenOT.add(key);
        list.push(r);
      }
    }
    return list;
  }, [reports]);

  const filteredReports = useMemo(() => {
    return deduplicatedReports.filter((r) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        r.refReport.toLowerCase().includes(q) ||
        r.refOT.toLowerCase().includes(q) ||
        r.refIR.toLowerCase().includes(q) ||
        r.filledBy.toLowerCase().includes(q) ||
        r.cause.toLowerCase().includes(q) ||
        r.subCause.toLowerCase().includes(q) ||
        r.actions.some((a) => a.toLowerCase().includes(q));

      const matchCategory =
        selectedCategory === 'All' || r.category === selectedCategory;

      let matchDate = true;
      if (startDate && r.date < startDate) matchDate = false;
      if (endDate && r.date > endDate) matchDate = false;

      return matchSearch && matchCategory && matchDate;
    });
  }, [deduplicatedReports, searchQuery, startDate, endDate, selectedCategory]);

  const paginatedReports = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReports.slice(start, start + pageSize);
  }, [filteredReports, currentPage, pageSize]);

  // Stat boxes: Total Reports, Waiting, Validated, In Progress / Parts Used
  const totalCount = deduplicatedReports.length;
  const waitingCount = deduplicatedReports.filter((r) => r.status === 'Waiting' || r.status === 'Draft').length;
  const validatedCount = deduplicatedReports.filter((r) => r.status === 'Validated').length;
  const partsUsedCount = deduplicatedReports.reduce((acc, r) => acc + (r.stockTaken?.length || 0), 0);

  const statBoxes = [
    { label: 'Total Reports :', value: totalCount },
    { label: 'Waiting :', value: waitingCount, color: 'text-amber-600' },
    { label: 'Validated :', value: validatedCount, color: 'text-emerald-700' },
    { label: 'Parts Replaced :', value: `${partsUsedCount} items`, color: 'text-blue-600' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Toolbar */}
      <GmaoToolbar
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={(d) => {
          setStartDate(d);
          setCurrentPage(1);
        }}
        onEndDateChange={(d) => {
          setEndDate(d);
          setCurrentPage(1);
        }}
        onClearDates={() => {
          setStartDate('');
          setEndDate('');
        }}
        showCategoryFilter={true}
        selectedCategory={selectedCategory}
        onCategoryChange={(c) => {
          setSelectedCategory(c);
          setCurrentPage(1);
        }}
        statBoxes={statBoxes}
      />

      {/* Main Table Container matching Intervention Reports.png */}
      <div className="bg-[#ebeeed] rounded-3xl border border-neutral-400/80 shadow-xs overflow-hidden flex flex-col justify-between min-h-[500px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-300 text-sm font-bold text-neutral-900 bg-black/5">
                <th className="py-4 px-5">Date</th>
                <th className="py-4 px-5">Ref OT</th>
                <th className="py-4 px-5">Ref IR</th>
                <th className="py-4 px-5">Category</th>
                <th className="py-4 px-5">Priority</th>
                <th className="py-4 px-6">Filled By</th>
                <th className="py-4 px-4 text-right">Coût Stock (DT)</th>
                <th className="py-4 px-5">Status</th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-300/70 text-sm font-medium text-neutral-800">
              {paginatedReports.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-500">
                    No intervention reports recorded.
                  </td>
                </tr>
              ) : (
                paginatedReports.map((rep) => {
                  const repCost =
                    rep.stockTaken && rep.stockTaken.length > 0
                      ? rep.stockTaken.reduce(
                          (acc, st) => acc + (Number(st.qty) || 0) * (Number(st.unitPrice) || 0),
                          0
                        )
                      : (rep.sparePartsCost ?? rep.totalCost ?? 0);

                  return (
                    <tr key={rep.id} className="hover:bg-white/40 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-xs tabular-nums text-neutral-700 whitespace-nowrap">
                        {rep.date}
                      </td>
                      <td className="py-3.5 px-5 font-mono font-bold text-blue-700 whitespace-nowrap">
                        {rep.refOT}
                      </td>
                      <td className="py-3.5 px-5 font-mono font-semibold text-neutral-600 whitespace-nowrap">
                        {rep.refIR}
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span className="font-semibold text-xs text-neutral-800">
                          {rep.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                            rep.priority === 'Urgent'
                              ? 'bg-red-100 text-red-800'
                              : rep.priority === 'High'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {rep.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 whitespace-nowrap">
                        <div className="font-semibold text-neutral-900">{rep.filledBy}</div>
                        <div className="text-[11px] text-neutral-500">
                          Cause: {rep.cause} ({rep.durationMinutes} min)
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-xs whitespace-nowrap">
                        <span className={repCost > 0 ? 'text-blue-700' : 'text-neutral-500'}>
                          {repCost.toFixed(2)} DT
                        </span>
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            rep.status === 'Validated'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>{rep.status}</span>
                        </span>
                      </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenReportDetails(rep)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-neutral-100 text-neutral-900 rounded-lg text-xs font-bold border border-neutral-300 transition-colors shadow-xs"
                          title="Consulter les détails du rapport"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          <span>View Details</span>
                        </button>

                        {isAdmin && (
                          <div className="flex items-center gap-1 pl-1 border-l border-neutral-300">
                            <button
                              onClick={() => handleOpenEdit(rep)}
                              className="p-1.5 bg-white hover:bg-blue-50 text-blue-700 rounded-lg border border-neutral-300 hover:border-blue-300 transition-colors shadow-2xs cursor-pointer"
                              title="Modifier le rapport (Admin)"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingReport(rep)}
                              className="p-1.5 bg-white hover:bg-red-50 text-red-700 rounded-lg border border-neutral-300 hover:border-red-300 transition-colors shadow-2xs cursor-pointer"
                              title="Supprimer le rapport (Admin)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          </table>
        </div>

        {/* Bottom Pagination */}
        <PaginationBar
          totalItems={filteredReports.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADMIN EDIT REPORT                                                  */}
      {/* ========================================================================= */}
      {editingReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-neutral-900 rounded-3xl p-6 sm:p-8 border border-neutral-300 shadow-2xl max-w-lg w-full space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2 text-blue-600 font-bold">
                <Edit2 className="w-5 h-5" />
                <h3 className="text-base font-black text-neutral-900">
                  Modifier le Rapport {editingReport.refReport}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingReport(null)}
                className="p-1 text-neutral-400 hover:text-neutral-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editReportData.date}
                    onChange={(e) => setEditReportData({ ...editReportData, date: e.target.value })}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Rempli par
                  </label>
                  <input
                    type="text"
                    required
                    value={editReportData.filledBy}
                    onChange={(e) => setEditReportData({ ...editReportData, filledBy: e.target.value })}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Statut
                  </label>
                  <select
                    value={editReportData.status}
                    onChange={(e) => setEditReportData({ ...editReportData, status: e.target.value as ReportStatus })}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Waiting">Waiting</option>
                    <option value="Validated">Validated</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Durée (min)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editReportData.durationMinutes}
                    onChange={(e) => setEditReportData({ ...editReportData, durationMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                  Cause
                </label>
                <input
                  type="text"
                  required
                  value={editReportData.cause}
                  onChange={(e) => setEditReportData({ ...editReportData, cause: e.target.value })}
                  className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                  Sous-cause
                </label>
                <input
                  type="text"
                  value={editReportData.subCause}
                  onChange={(e) => setEditReportData({ ...editReportData, subCause: e.target.value })}
                  className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setEditingReport(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADMIN DELETE REPORT CONFIRMATION                                   */}
      {/* ========================================================================= */}
      {deletingReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-neutral-900 rounded-3xl p-6 sm:p-8 border border-neutral-300 shadow-2xl max-w-md w-full space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2 text-red-600 font-bold">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-base font-black text-neutral-900">
                  Supprimer le Rapport {deletingReport.refReport}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingReport(null)}
                className="p-1 text-neutral-400 hover:text-neutral-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-neutral-600">
                Êtes-vous sûr de vouloir supprimer définitivement ce rapport d'intervention ? Cette action est irréversible.
              </p>

              <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 text-xs space-y-1.5 text-neutral-700">
                <div>
                  <span className="font-bold text-neutral-900">Réf Rapport : </span>
                  <span className="font-mono text-blue-700">{deletingReport.refReport}</span>
                </div>
                <div>
                  <span className="font-bold text-neutral-900">Réf OT : </span>
                  <span className="font-mono text-neutral-700">{deletingReport.refOT}</span>
                </div>
                <div>
                  <span className="font-bold text-neutral-900">Rempli par : </span>
                  {deletingReport.filledBy}
                </div>
                <div>
                  <span className="font-bold text-neutral-900">Cause : </span>
                  {deletingReport.cause}
                </div>
                {deletingReport.stockTaken && deletingReport.stockTaken.length > 0 && (
                  <div>
                    <span className="font-bold text-neutral-900">Pièces consommées : </span>
                    {deletingReport.stockTaken.length} article(s)
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingReport(null)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
