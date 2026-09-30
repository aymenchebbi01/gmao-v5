import React, { useState, useMemo } from 'react';
import { GmaoToolbar } from '../components/GmaoToolbar';
import { PaginationBar } from '../components/PaginationBar';
import { InterventionRequest, AppUser, RequestStatus, PriorityLevel } from '../types/gmao';
import { exportToXLSX } from '../lib/exportUtils';
import {
  Check,
  X,
  FilePlus2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Edit2,
  RotateCcw,
  MessageSquare,
  Lock,
  FileSpreadsheet,
  Trash2,
  Archive,
} from 'lucide-react';

interface InterventionRequestViewProps {
  requests: InterventionRequest[];
  onValidate: (id: string) => void;
  onReject: (id: string, reason?: string) => void;
  onChangeDecision?: (id: string, newStatus: 'Waiting' | 'Validated' | 'Rejected', reason?: string) => void;
  onCreateOTFromIR: (req: InterventionRequest) => void;
  onOpenNewIRModal: () => void;
  onEditRequest?: (req: InterventionRequest) => void;
  onDeleteRequest?: (id: string) => void;
  onArchiveRequest?: (id: string, reason?: string) => void;
  currentUser?: AppUser;
}

export const InterventionRequestView: React.FC<InterventionRequestViewProps> = ({
  requests,
  onValidate,
  onReject,
  onChangeDecision,
  onCreateOTFromIR,
  onOpenNewIRModal,
  onEditRequest,
  onDeleteRequest,
  onArchiveRequest,
  currentUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Admin Edit Modal State
  const [editingIR, setEditingIR] = useState<InterventionRequest | null>(null);
  const [editFormData, setEditFormData] = useState<{
    date: string;
    problemDescription: string;
    equipmentName: string;
    requester: string;
    requesterRole: string;
    status: RequestStatus;
    priority: PriorityLevel;
    rejectionReason: string;
  }>({
    date: '',
    problemDescription: '',
    equipmentName: '',
    requester: '',
    requesterRole: '',
    status: 'Waiting',
    priority: 'High',
    rejectionReason: '',
  });

  // Admin Delete Modal State
  const [deletingIR, setDeletingIR] = useState<InterventionRequest | null>(null);

  // Archive Modal State
  const [archivingIR, setArchivingIR] = useState<InterventionRequest | null>(null);
  const [archiveReasonInput, setArchiveReasonInput] = useState('Archivée manuellement');

  const handleConfirmArchive = () => {
    if (archivingIR && onArchiveRequest) {
      onArchiveRequest(archivingIR.id, archiveReasonInput.trim() || 'Archivée manuellement');
      setArchivingIR(null);
    }
  };

  // Rejection Modal State
  const [rejectingIR, setRejectingIR] = useState<InterventionRequest | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  // Modify Decision Modal State
  const [modifyingIR, setModifyingIR] = useState<InterventionRequest | null>(null);
  const [targetDecision, setTargetDecision] = useState<'Validated' | 'Rejected' | 'Waiting'>('Validated');
  const [modifyReasonInput, setModifyReasonInput] = useState('');

  // Role verification: Admin check
  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    const r = (currentUser.role || '').toLowerCase();
    return r === 'admin';
  }, [currentUser]);

  // Role verification: Only Technical Manager or Admin can validate/reject
  const isRespTechOrAdmin = useMemo(() => {
    if (!currentUser) return false;
    const r = (currentUser.role || '').toLowerCase();
    return r === 'admin' || r === 'responsable technique' || r.includes('technique');
  }, [currentUser]);

  const isMethodeOrAdmin = useMemo(() => {
    if (!currentUser) return false;
    const r = (currentUser.role || '').toLowerCase();
    return r === 'admin' || r === 'methode maintenance' || r.includes('methode');
  }, [currentUser]);

  // Active (non-archived) requests
  const activeRequests = useMemo(() => {
    return requests.filter((req) => !req.isArchived);
  }, [requests]);

  // Filtered dataset
  const filteredRequests = useMemo(() => {
    return activeRequests.filter((req) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        req.refIR.toLowerCase().includes(q) ||
        req.problemDescription.toLowerCase().includes(q) ||
        req.requester.toLowerCase().includes(q) ||
        (req.equipmentName && req.equipmentName.toLowerCase().includes(q)) ||
        req.status.toLowerCase().includes(q);

      let matchDate = true;
      if (startDate && req.date < startDate) matchDate = false;
      if (endDate && req.date > endDate) matchDate = false;

      return matchSearch && matchDate;
    });
  }, [activeRequests, searchQuery, startDate, endDate]);

  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  // Counts for stat boxes
  const totalCount = activeRequests.length;
  const waitingCount = activeRequests.filter((r) => r.status === 'Waiting').length;
  const validatedCount = activeRequests.filter((r) => r.status === 'Validated').length;
  const rejectedCount = activeRequests.filter((r) => r.status === 'Rejected').length;

  const statBoxes = [
    { label: 'Total Requests:', value: totalCount },
    { label: 'Waiting:', value: waitingCount, color: 'text-amber-600' },
    { label: 'Validated:', value: validatedCount, color: 'text-emerald-700' },
    { label: 'Rejected:', value: rejectedCount, color: 'text-red-600' },
  ];

  // Admin Edit Handlers
  const handleOpenEdit = (req: InterventionRequest) => {
    setEditingIR(req);
    setEditFormData({
      date: req.date || '',
      problemDescription: req.problemDescription || '',
      equipmentName: req.equipmentName || '',
      requester: req.requester || '',
      requesterRole: req.requesterRole || 'technician',
      status: req.status,
      priority: req.priority || 'High',
      rejectionReason: req.rejectionReason || '',
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIR) return;
    const updated: InterventionRequest = {
      ...editingIR,
      date: editFormData.date,
      problemDescription: editFormData.problemDescription.trim(),
      equipmentName: editFormData.equipmentName.trim() || undefined,
      requester: editFormData.requester.trim(),
      requesterRole: editFormData.requesterRole,
      status: editFormData.status,
      priority: editFormData.priority,
      rejectionReason: editFormData.status === 'Rejected' ? editFormData.rejectionReason : undefined,
    };
    onEditRequest?.(updated);
    setEditingIR(null);
  };

  // Admin Delete Handler
  const handleConfirmDelete = () => {
    if (!deletingIR) return;
    onDeleteRequest?.(deletingIR.id);
    setDeletingIR(null);
  };

  // Submit Rejection
  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingIR) return;
    if (!rejectionReasonInput.trim()) return;

    if (onChangeDecision) {
      onChangeDecision(rejectingIR.id, 'Rejected', rejectionReasonInput.trim());
    } else {
      onReject(rejectingIR.id, rejectionReasonInput.trim());
    }
    setRejectingIR(null);
    setRejectionReasonInput('');
  };

  // Submit Decision Modification
  const handleConfirmModifyDecision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modifyingIR) return;

    if (targetDecision === 'Rejected' && !modifyReasonInput.trim()) {
      return;
    }

    if (onChangeDecision) {
      onChangeDecision(
        modifyingIR.id,
        targetDecision,
        targetDecision === 'Rejected' ? modifyReasonInput.trim() : undefined
      );
    } else if (targetDecision === 'Validated') {
      onValidate(modifyingIR.id);
    } else if (targetDecision === 'Rejected') {
      onReject(modifyingIR.id, modifyReasonInput.trim());
    }

    setModifyingIR(null);
    setModifyReasonInput('');
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Workflow Guidance Strip */}
      <div className="bg-white rounded-2xl p-4 border border-neutral-300 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const exportData = filteredRequests.map((r) => ({
                Date: r.date,
                'IR Ref': r.refIR,
                'Problem Description': r.problemDescription,
                'Target Equipment': r.equipmentName || '-',
                'Rejection Reason': r.status === 'Rejected' ? r.rejectionReason || 'Non spécifié' : '-',
                Requester: r.requester,
                Role: r.requesterRole || 'Technicien',
                Status: r.status,
                'Validated / Rejected By': r.validatedBy || r.rejectedBy || '-',
                Timestamp: r.validatedAt || r.rejectedAt || '-',
              }));
              exportToXLSX(exportData, `GMAO_Intervention_Requests_${new Date().toISOString().slice(0, 10)}.xlsx`, 'Intervention Requests');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-neutral-100 text-neutral-800 font-bold text-xs rounded-xl border border-neutral-300 transition-all shadow-2xs cursor-pointer"
            title="Exporter les demandes d'intervention au format Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={onOpenNewIRModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-xs cursor-pointer"
          >
            + New Request (IR)
          </button>
        </div>
      </div>

      {/* Search & Stat Row */}
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
        statBoxes={statBoxes}
      />

      {/* Main Table Container */}
      <div className="bg-[#ebeeed] rounded-3xl border border-neutral-400/80 shadow-xs overflow-hidden flex flex-col justify-between min-h-[500px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-300 text-sm font-bold text-neutral-900 bg-black/5">
                <th className="py-4 px-5">Date</th>
                <th className="py-4 px-5">IR Ref</th>
                <th className="py-4 px-6">Problem</th>
                <th className="py-4 px-5">Reason</th>
                <th className="py-4 px-5">Requester</th>
                <th className="py-4 px-5">Validation Status</th>
                <th className="py-4 px-5">Validated / Rejected By</th>
                <th className="py-4 px-5">Timestamp</th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-300/70 text-sm font-medium text-neutral-800">
              {paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-500">
                    No intervention requests found.
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((req) => {
                  const isLockedByNextStep = Boolean(req.relatedOTRef);

                  return (
                    <tr key={req.id} className="hover:bg-white/40 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-xs tabular-nums text-neutral-700 whitespace-nowrap">
                        {req.date}
                      </td>
                      <td className="py-3.5 px-5 font-mono font-bold text-blue-700 whitespace-nowrap">
                        {req.refIR}
                      </td>
                      <td className="py-3.5 px-6 max-w-sm">
                        <div className="font-bold text-neutral-900 text-sm leading-snug">
                          {req.problemDescription}
                        </div>
                        {req.equipmentName && (
                          <div className="text-xs text-neutral-500 mt-1 flex items-center gap-1">
                            <span className="font-medium text-neutral-400">Target:</span>
                            <span className="text-neutral-700 font-semibold">{req.equipmentName}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-5 max-w-xs">
                        {req.status === 'Rejected' && req.rejectionReason ? (
                          <div className="text-xs text-red-800 bg-red-50 p-2.5 rounded-xl border border-red-200/90 flex items-start gap-1.5 shadow-2xs">
                            <div className="space-y-0.5">
                              <span className="font-medium text-neutral-900 leading-snug block">
                                {req.rejectionReason}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-neutral-400 font-mono text-xs pl-2">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-neutral-800 whitespace-nowrap">
                        <div className="font-semibold">{req.requester}</div>
                        <div className="text-[11px] text-neutral-500 capitalize">
                          {req.requesterRole || 'Technicien'}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${req.status === 'Waiting'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : req.status === 'Validated'
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : 'bg-red-100 text-red-900 border-red-300'
                            }`}
                        >
                          {req.status === 'Waiting' && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                          {req.status === 'Validated' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                          {req.status === 'Rejected' && <X className="w-3.5 h-3.5 text-red-600" />}
                          <span>
                            {req.status === 'Waiting' ? 'En attente Resp. Tech' : req.status}
                          </span>
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-xs text-neutral-700 whitespace-nowrap">
                        {req.validatedBy ? (
                          <span className="font-semibold text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                            {req.validatedBy}
                          </span>
                        ) : req.rejectedBy ? (
                          <span className="font-semibold text-red-900 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                            {req.rejectedBy}
                          </span>
                        ) : (
                          <span className="text-neutral-400 italic">En attente Resp. Tech</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-xs text-neutral-600 whitespace-nowrap">
                        {req.validatedAt || req.rejectedAt || '-'}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {/* CASE 1: TICKET IS IN 'Waiting' STATUS */}
                          {req.status === 'Waiting' && (
                            <>
                              {isRespTechOrAdmin ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => onValidate(req.id)}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                                    title="Valider la demande (Autorité Technical Manager)"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRejectingIR(req);
                                      setRejectionReasonInput('');
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                                    title="Reject with mandatory reason"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>Reject</span>
                                  </button>
                                </div>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 cursor-not-allowed"
                                  title={`En attente de validation par le rôle: Technical Manager (Votre rôle actuel: ${currentUser?.role || 'Opérateur'})`}
                                >
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  <span>En attente de validation par: Technical Manager</span>
                                </span>
                              )}
                            </>
                          )}

                          {/* CASE 2: TICKET IS ALREADY VALIDATED OR REJECTED */}
                          {req.status !== 'Waiting' && (
                            <div className="flex items-center gap-2">
                              {/* Next Step Lock Check: If OT is created, previous validation cannot be modified! */}
                              {isLockedByNextStep ? (
                                <span
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold border border-neutral-300"
                                  title={`Ordre de travail ${req.relatedOTRef} déjà créé : la décision de validation précédente est verrouillée et ne peut plus être modifiée.`}
                                >
                                  <Lock className="w-3.5 h-3.5 text-neutral-600" />
                                  <span>Locked ({req.relatedOTRef})</span>
                                </span>
                              ) : (
                                /* IF NEXT STEP NOT YET VALIDATED/EXECUTED: Technical Manager CAN CHANGE DECISION! */
                                isRespTechOrAdmin && (
                                  <button
                                    onClick={() => {
                                      setModifyingIR(req);
                                      setTargetDecision(req.status === 'Validated' ? 'Rejected' : 'Validated');
                                      setModifyReasonInput(req.rejectionReason || '');
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-bold rounded-lg border border-neutral-300 shadow-2xs transition-colors cursor-pointer"
                                    title="Changer d'avis avant que l'étape suivante (création OT) ne soit effectuée"
                                  >
                                    <RotateCcw className="w-3 h-3 text-blue-600" />
                                    <span>Modify Decision</span>
                                  </button>
                                )
                              )}

                              {/* Create OT button for Maintenance Method */}
                              {req.status === 'Validated' && !req.relatedOTRef && (
                                <button
                                  onClick={() => onCreateOTFromIR(req)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                                  title="Maintenance Method : Créer l'Ordre de Travail"
                                >
                                  <FilePlus2 className="w-3.5 h-3.5" />
                                  <span>Create WO (Method)</span>
                                </button>
                              )}
                            </div>
                          )}

                          {/* Archive Action */}
                          <button
                            type="button"
                            onClick={() => {
                              setArchivingIR(req);
                              setArchiveReasonInput('Archivée manuellement');
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-neutral-900 rounded-xl text-xs font-bold border border-neutral-300 shadow-2xs transition-colors cursor-pointer"
                            title="Archiver cette demande (elle ne sera plus visible ici et apparaîtra dans les Archives)"
                          >
                            <Archive className="w-3.5 h-3.5 text-neutral-600" />
                            <span>Archiver</span>
                          </button>

                          {/* Admin Edit & Delete Actions */}
                          {isAdmin && (
                            <div className="flex items-center gap-1 pl-1.5 border-l border-neutral-300 ml-1">
                              <button
                                onClick={() => handleOpenEdit(req)}
                                className="p-1.5 bg-white hover:bg-blue-50 text-blue-700 rounded-lg border border-neutral-300 hover:border-blue-300 transition-colors shadow-2xs cursor-pointer"
                                title="Modifier la demande (Admin)"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingIR(req)}
                                className="p-1.5 bg-white hover:bg-red-50 text-red-700 rounded-lg border border-neutral-300 hover:border-red-300 transition-colors shadow-2xs cursor-pointer"
                                title="Supprimer la demande (Admin)"
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

        {/* Bottom Pagination Bar */}
        <PaginationBar
          totalItems={filteredRequests.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* ========================================================================= */}
      {/* MODAL: MOTIF DU REFUS OBLIGATOIRE (REJECTION REASON MODAL)                */}
      {/* ========================================================================= */}
      {rejectingIR && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-neutral-900 rounded-3xl p-6 sm:p-8 border border-neutral-300 shadow-2xl max-w-lg w-full space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2 text-red-600 font-bold">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-black text-neutral-900">
                  Reject Intervention Request {rejectingIR.refIR}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectingIR(null)}
                className="p-1 text-neutral-400 hover:text-neutral-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-neutral-600 space-y-1 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
              <div>
                <span className="font-bold text-neutral-800">Reported problem: </span>
                {rejectingIR.problemDescription}
              </div>
              <div>
                <span className="font-bold text-neutral-800">Requester: </span>
                {rejectingIR.requester}
              </div>
            </div>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-800 uppercase mb-1.5">
                  Rejection Reason (Mandatory) *
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  placeholder="Explain reason for rejection (e.g.: Operational issue already handled, false sensor alarm, duplicate ticket, process adjustment sufficient...)"
                  className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-3 text-xs font-medium focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingIR(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!rejectionReasonInput.trim()}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CHANGER D'AVIS AVANT L'ÉTAPE SUIVANTE                              */}
      {/* ========================================================================= */}
      {modifyingIR && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-neutral-900 rounded-3xl p-6 sm:p-8 border border-neutral-300 shadow-2xl max-w-lg w-full space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2 text-blue-600 font-bold">
                <RotateCcw className="w-5 h-5" />
                <h3 className="text-base font-black text-neutral-900">
                  Modify Decision for {modifyingIR.refIR}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModifyingIR(null)}
                className="p-1 text-neutral-400 hover:text-neutral-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-600">
              Since the Work Order (WO) has not been issued yet, you can modify your validation or rejection decision with full traceability.
            </p>

            <form onSubmit={handleConfirmModifyDecision} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-2">
                  Nouvelle Décision du Technical Manager :
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetDecision('Validated')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${targetDecision === 'Validated'
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                      : 'bg-neutral-50 text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                      }`}
                  >
                    Approve Request
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetDecision('Rejected')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${targetDecision === 'Rejected'
                      ? 'bg-red-600 text-white border-red-700 shadow-xs'
                      : 'bg-neutral-50 text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                      }`}
                  >
                    Reject Request
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetDecision('Waiting')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${targetDecision === 'Waiting'
                      ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                      : 'bg-neutral-50 text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                      }`}
                  >
                    Return to Pending
                  </button>
                </div>
              </div>

              {targetDecision === 'Rejected' && (
                <div>
                  <label className="block text-xs font-bold text-neutral-800 uppercase mb-1">
                    Rejection Reason (Mandatory) *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={modifyReasonInput}
                    onChange={(e) => setModifyReasonInput(e.target.value)}
                    placeholder="Specify reason for this rejection..."
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-3 text-xs font-medium focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModifyingIR(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  Save New Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADMIN EDIT INTERVENTION REQUEST                                    */}
      {/* ========================================================================= */}
      {editingIR && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-neutral-900 rounded-3xl p-6 sm:p-8 border border-neutral-300 shadow-2xl max-w-2xl w-full space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2 text-blue-600 font-bold">
                <Edit2 className="w-5 h-5" />
                <h3 className="text-base font-black text-neutral-900">
                  Modifier la Demande d'Intervention {editingIR.refIR}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingIR(null)}
                className="p-1 text-neutral-400 hover:text-neutral-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editingIR.relatedOTRef && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Cette demande est liée à l'Ordre de Travail <strong>{editingIR.relatedOTRef}</strong>.
                </span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Date de la demande
                  </label>
                  <input
                    type="date"
                    required
                    value={editFormData.date}
                    onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Équipement concerné
                  </label>
                  <input
                    type="text"
                    value={editFormData.equipmentName}
                    onChange={(e) => setEditFormData({ ...editFormData, equipmentName: e.target.value })}
                    placeholder="Ex: Presse 150T, Moule B-12, etc."
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Demandeur
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.requester}
                    onChange={(e) => setEditFormData({ ...editFormData, requester: e.target.value })}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Rôle du demandeur
                  </label>
                  <select
                    value={editFormData.requesterRole}
                    onChange={(e) => setEditFormData({ ...editFormData, requesterRole: e.target.value })}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="technician">Technicien</option>
                    <option value="responsable production">Responsable Production</option>
                    <option value="responsable maintenance">Responsable Maintenance</option>
                    <option value="methode maintenance">Méthode Maintenance</option>
                    <option value="qhse">QHSE</option>
                    <option value="responsable technique">Responsable Technique</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Statut de validation
                  </label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as RequestStatus })}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Waiting">Waiting (En attente Resp. Tech)</option>
                    <option value="Validated">Validated (Approuvé)</option>
                    <option value="Rejected">Rejected (Refusé)</option>
                    <option value="In Progress">In Progress (En cours)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Priorité
                  </label>
                  <select
                    value={editFormData.priority}
                    onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value as PriorityLevel })}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {editFormData.status === 'Rejected' && (
                <div>
                  <label className="block text-xs font-bold text-neutral-800 uppercase mb-1">
                    Motif du refus
                  </label>
                  <textarea
                    rows={2}
                    value={editFormData.rejectionReason}
                    onChange={(e) => setEditFormData({ ...editFormData, rejectionReason: e.target.value })}
                    placeholder="Expliquer le motif de rejet..."
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-neutral-800 uppercase mb-1">
                  Description du problème *
                </label>
                <textarea
                  required
                  rows={3}
                  value={editFormData.problemDescription}
                  onChange={(e) => setEditFormData({ ...editFormData, problemDescription: e.target.value })}
                  className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-3 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setEditingIR(null)}
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
      {/* MODAL: ADMIN DELETE INTERVENTION REQUEST CONFIRMATION                      */}
      {/* ========================================================================= */}
      {deletingIR && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-neutral-900 rounded-3xl p-6 sm:p-8 border border-neutral-300 shadow-2xl max-w-md w-full space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2 text-red-600 font-bold">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-base font-black text-neutral-900">
                  Supprimer la Demande {deletingIR.refIR}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingIR(null)}
                className="p-1 text-neutral-400 hover:text-neutral-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-neutral-600">
                Êtes-vous sûr de vouloir supprimer définitivement cette demande d'intervention ? Cette action est irréversible.
              </p>

              <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 text-xs space-y-1.5 text-neutral-700">
                <div>
                  <span className="font-bold text-neutral-900">Référence : </span>
                  <span className="font-mono text-blue-700">{deletingIR.refIR}</span>
                </div>
                <div>
                  <span className="font-bold text-neutral-900">Demandeur : </span>
                  {deletingIR.requester}
                </div>
                {deletingIR.equipmentName && (
                  <div>
                    <span className="font-bold text-neutral-900">Équipement : </span>
                    {deletingIR.equipmentName}
                  </div>
                )}
                <div>
                  <span className="font-bold text-neutral-900">Problème : </span>
                  {deletingIR.problemDescription}
                </div>
              </div>

              {deletingIR.relatedOTRef && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Attention :</strong> Cette demande est associée à l'Ordre de Travail <strong>{deletingIR.relatedOTRef}</strong>. Sa suppression dissociera cet OT.
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingIR(null)}
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

      {/* ========================================================================= */}
      {/* MODAL: ARCHIVE INTERVENTION REQUEST CONFIRMATION                           */}
      {/* ========================================================================= */}
      {archivingIR && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-neutral-900 rounded-3xl p-6 sm:p-8 border border-neutral-300 shadow-2xl max-w-md w-full space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2 text-neutral-900 font-bold">
                <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
                  <Archive className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-neutral-900">
                  Archiver la Demande {archivingIR.refIR}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setArchivingIR(null)}
                className="p-1 text-neutral-400 hover:text-neutral-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-neutral-600">
                Cette demande d'intervention ne sera plus affichée dans la liste active. Elle sera conservée et consultable dans l'interface <strong>Archives (DI)</strong>.
              </p>

              <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 text-xs space-y-1.5 text-neutral-700">
                <div>
                  <span className="font-bold text-neutral-900">Référence : </span>
                  <span className="font-mono text-blue-700">{archivingIR.refIR}</span>
                </div>
                <div>
                  <span className="font-bold text-neutral-900">Demandeur : </span>
                  {archivingIR.requester}
                </div>
                {archivingIR.equipmentName && (
                  <div>
                    <span className="font-bold text-neutral-900">Équipement : </span>
                    {archivingIR.equipmentName}
                  </div>
                )}
                <div>
                  <span className="font-bold text-neutral-900">Problème : </span>
                  {archivingIR.problemDescription}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Motif d'archivage (optionnel) :
                </label>
                <input
                  type="text"
                  value={archiveReasonInput}
                  onChange={(e) => setArchiveReasonInput(e.target.value)}
                  placeholder="Ex: Archivée manuellement, clôturée..."
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:border-neutral-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setArchivingIR(null)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmArchive}
                className="px-5 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Confirmer l'archivage</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
