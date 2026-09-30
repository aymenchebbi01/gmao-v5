import React, { useState, useMemo } from 'react';
import { GmaoToolbar } from '../components/GmaoToolbar';
import { PaginationBar } from '../components/PaginationBar';
import {
  MaintenanceOrder,
  MaintenanceCategory,
  AppUser,
  Machine,
  Mold,
  InterventionRequest,
  PriorityLevel,
  OrderStatus,
} from '../types/gmao';
import { downloadMiseADispositionPdf } from '../lib/miseADispositionPdf';
import {
  FileEdit,
  FileDown,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Calendar,
  Check,
  Eye,
  Wrench,
  AlertCircle,
  FileCheck2,
  FileText,
  Lock,
  RotateCcw,
  X,
  UserCheck,
  Edit2,
  Trash2,
} from 'lucide-react';

interface MaintenanceOrdersViewProps {
  orders: MaintenanceOrder[];
  machines?: Machine[];
  molds?: Mold[];
  requests?: InterventionRequest[];
  onOpenReportModalForOT: (order: MaintenanceOrder) => void;
  onOpenNewOTModal: () => void;
  onUpdateStatus: (orderId: string, status: MaintenanceOrder['status']) => void;
  onEditOrder?: (order: MaintenanceOrder) => void;
  onDeleteOrder?: (orderId: string) => void;
  onValidatePreStep1RespMaint: (
    orderId: string,
    estimatedHours: number,
    scheduledDate: string,
    scheduledTime: string
  ) => void;
  onRejectPreStep1RespMaint?: (orderId: string, reason: string) => void;
  onChangeDecisionPreStep1?: (
    orderId: string,
    decision: 'Validated' | 'Rejected',
    hours?: number,
    date?: string,
    time?: string,
    reason?: string
  ) => void;
  onValidatePreStep2RespProd: (orderId: string) => void;
  onRejectPreStep2RespProd?: (orderId: string, reason: string) => void;
  onChangeDecisionPreStep2?: (
    orderId: string,
    decision: 'Validated' | 'Rejected',
    reason?: string
  ) => void;
  onValidatePreStep3QHSE: (orderId: string) => void;
  onRejectPreStep3QHSE?: (orderId: string, reason: string) => void;
  onChangeDecisionPreStep3?: (
    orderId: string,
    decision: 'Validated' | 'Rejected',
    reason?: string
  ) => void;
  onValidatePostStep1RespProd: (orderId: string) => void;
  onRejectPostStep1RespProd?: (orderId: string, reason: string) => void;
  onChangeDecisionPostStep1?: (
    orderId: string,
    decision: 'Validated' | 'Rejected',
    reason?: string
  ) => void;
  onValidatePostStep2RespTech: (orderId: string) => void;
  onRejectPostStep2RespTech?: (orderId: string, reason: string) => void;
  onChangeDecisionPostStep2?: (
    orderId: string,
    decision: 'Validated' | 'Rejected',
    reason?: string
  ) => void;
  onOpenPdfReport: (order: MaintenanceOrder) => void;
  currentUser?: AppUser;
}

type StepKey = 'pre1' | 'pre2' | 'pre3' | 'post1' | 'post2';

interface RejectModalState {
  orderId: string;
  refOT: string;
  stepKey: StepKey;
  stepTitle: string;
}

interface ModifyModalState {
  orderId: string;
  refOT: string;
  stepKey: StepKey;
  stepTitle: string;
  currentDecision: 'Validated' | 'Rejected';
  targetDecision: 'Validated' | 'Rejected';
  currentReason?: string;
  currentHours?: number;
  currentDate?: string;
  currentTime?: string;
}

export const MaintenanceOrdersView: React.FC<MaintenanceOrdersViewProps> = ({
  orders,
  machines = [],
  molds = [],
  requests = [],
  onOpenReportModalForOT,
  onOpenNewOTModal,
  onEditOrder,
  onDeleteOrder,
  onValidatePreStep1RespMaint,
  onRejectPreStep1RespMaint,
  onChangeDecisionPreStep1,
  onValidatePreStep2RespProd,
  onRejectPreStep2RespProd,
  onChangeDecisionPreStep2,
  onValidatePreStep3QHSE,
  onRejectPreStep3QHSE,
  onChangeDecisionPreStep3,
  onValidatePostStep1RespProd,
  onRejectPostStep1RespProd,
  onChangeDecisionPostStep1,
  onValidatePostStep2RespTech,
  onRejectPostStep2RespTech,
  onChangeDecisionPostStep2,
  onOpenPdfReport,
  currentUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MaintenanceCategory | 'All'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Admin Edit Order Modal State
  const [editingOrder, setEditingOrder] = useState<MaintenanceOrder | null>(null);
  const [editOrderFormData, setEditOrderFormData] = useState<{
    date: string;
    category: MaintenanceCategory;
    priority: PriorityLevel;
    assignedTo: string;
    equipmentName: string;
    description: string;
    status: OrderStatus;
    estimatedHours: number;
    scheduledDate: string;
    scheduledTime: string;
    maintenanceType: 'Preventive' | 'Corrective';
  }>({
    date: '',
    category: 'Machine',
    priority: 'High',
    assignedTo: '',
    equipmentName: '',
    description: '',
    status: 'Waiting',
    estimatedHours: 2.5,
    scheduledDate: '',
    scheduledTime: '',
    maintenanceType: 'Corrective',
  });

  // Admin Delete Order Modal State
  const [deletingOrder, setDeletingOrder] = useState<MaintenanceOrder | null>(null);

  // Inputs for Step 1 validation (estimated hours + scheduled date/time)
  const [step1Hours, setStep1Hours] = useState<number>(2.5);
  const [step1Date, setStep1Date] = useState<string>(() =>
    new Date().toISOString().split('T')[0]
  );
  const [step1Time, setStep1Time] = useState<string>('14:00');

  // Modal States for Rejection with Mandatory Reason
  const [rejectModal, setRejectModal] = useState<RejectModalState | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  // Modal States for Changing Decision Before Next Step
  const [modifyModal, setModifyModal] = useState<ModifyModalState | null>(null);
  const [modifyReasonInput, setModifyReasonInput] = useState('');
  const [modifyHours, setModifyHours] = useState<number>(2.5);
  const [modifyDate, setModifyDate] = useState<string>(() =>
    new Date().toISOString().split('T')[0]
  );
  const [modifyTime, setModifyTime] = useState<string>('14:00');

  const handleDownloadMAD = (order: MaintenanceOrder) => {
    const targetMachine = machines.find(
      (m) => m.id === order.machineId || m.number === order.machineNumber
    );
    const targetMold = molds.find(
      (m) => m.id === order.moldId || m.ref === order.moldRef || m.moldNumber === order.moldRef
    );
    const targetRequest = requests.find(
      (r) => r.refIR === order.refIR || r.id === order.refIR
    );
    downloadMiseADispositionPdf(order, {
      machine: targetMachine,
      mold: targetMold,
      request: targetRequest,
    });
  };

  const pageSize = 8;

  // Filter logic
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        o.refOT.toLowerCase().includes(q) ||
        o.refIR.toLowerCase().includes(q) ||
        o.equipmentName.toLowerCase().includes(q) ||
        o.assignedTo.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q) ||
        o.priority.toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q);

      const matchCategory =
        selectedCategory === 'All' || o.category === selectedCategory;

      let matchDate = true;
      if (startDate && o.date < startDate) matchDate = false;
      if (endDate && o.date > endDate) matchDate = false;

      return matchSearch && matchCategory && matchDate;
    });
  }, [orders, searchQuery, startDate, endDate, selectedCategory]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  // Stat boxes
  const totalCount = orders.length;
  const waitingCount = orders.filter((o) => o.status === 'Waiting').length;
  const inProgressCount = orders.filter((o) => o.status === 'In Progress').length;
  const waitingWorkValidationCount = orders.filter(
    (o) => o.status === 'Waiting work validation'
  ).length;
  const completedCount = orders.filter((o) => o.status === 'Completed').length;

  const statBoxes = [
    { label: 'Total Orders :', value: totalCount },
    { label: 'Waiting Validations :', value: waitingCount, color: 'text-amber-600' },
    { label: 'In Progress :', value: inProgressCount, color: 'text-blue-600' },
    { label: 'Waiting Work Signoff :', value: waitingWorkValidationCount, color: 'text-purple-600' },
    { label: 'Completed :', value: completedCount, color: 'text-emerald-700' },
  ];

  const toggleExpand = (orderId: string) => {
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

  // Role verification helpers based on current user
  const role = currentUser?.role;
  const isAdmin = (role || '').toLowerCase() === 'admin';
  const isRespMaintRole =
    role === 'responsable maintenance' || role === 'responsable technique' || role === 'admin';
  const isRespProdRole = role === 'responsable production' || role === 'admin';
  const isQHSERole = role === 'qhse' || role === 'admin';
  const isRespTechRole = role === 'responsable technique' || role === 'admin';

  // Admin Edit and Delete Handlers
  const handleOpenEditOrder = (ord: MaintenanceOrder) => {
    setEditingOrder(ord);
    setEditOrderFormData({
      date: ord.date || '',
      category: ord.category || 'Machine',
      priority: ord.priority || 'High',
      assignedTo: ord.assignedTo || '',
      equipmentName: ord.equipmentName || '',
      description: ord.description || '',
      status: ord.status,
      estimatedHours: ord.estimatedHours || 2.5,
      scheduledDate: ord.scheduledDate || '',
      scheduledTime: ord.scheduledTime || '14:00',
      maintenanceType: ord.machineMaintenanceType || ord.maintenanceType || 'Corrective',
    });
  };

  const handleSaveEditOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    const updated: MaintenanceOrder = {
      ...editingOrder,
      date: editOrderFormData.date,
      category: editOrderFormData.category,
      priority: editOrderFormData.priority,
      assignedTo: editOrderFormData.assignedTo.trim(),
      equipmentName: editOrderFormData.equipmentName.trim(),
      description: editOrderFormData.description.trim(),
      status: editOrderFormData.status,
      estimatedHours: Number(editOrderFormData.estimatedHours) || 2.5,
      scheduledDate: editOrderFormData.scheduledDate || undefined,
      scheduledTime: editOrderFormData.scheduledTime || undefined,
      machineMaintenanceType: editOrderFormData.category === 'Machine' ? editOrderFormData.maintenanceType : undefined,
      maintenanceType: editOrderFormData.maintenanceType,
    };
    onEditOrder?.(updated);
    setEditingOrder(null);
  };

  const handleConfirmDeleteOrder = () => {
    if (!deletingOrder) return;
    onDeleteOrder?.(deletingOrder.id);
    setDeletingOrder(null);
  };

  // Handle Opening Rejection Modal
  const openRejectModal = (
    orderId: string,
    refOT: string,
    stepKey: StepKey,
    stepTitle: string
  ) => {
    setRejectModal({ orderId, refOT, stepKey, stepTitle });
    setRejectionReasonInput('');
  };

  // Submit Rejection with Mandatory Reason
  const handleConfirmRejection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModal || !rejectionReasonInput.trim()) return;

    const { orderId, stepKey } = rejectModal;
    const reason = rejectionReasonInput.trim();

    if (stepKey === 'pre1' && onRejectPreStep1RespMaint) {
      onRejectPreStep1RespMaint(orderId, reason);
    } else if (stepKey === 'pre2' && onRejectPreStep2RespProd) {
      onRejectPreStep2RespProd(orderId, reason);
    } else if (stepKey === 'pre3' && onRejectPreStep3QHSE) {
      onRejectPreStep3QHSE(orderId, reason);
    } else if (stepKey === 'post1' && onRejectPostStep1RespProd) {
      onRejectPostStep1RespProd(orderId, reason);
    } else if (stepKey === 'post2' && onRejectPostStep2RespTech) {
      onRejectPostStep2RespTech(orderId, reason);
    }

    setRejectModal(null);
    setRejectionReasonInput('');
  };

  // Handle Opening Modify Decision Modal
  const openModifyModal = (
    order: MaintenanceOrder,
    stepKey: StepKey,
    stepTitle: string
  ) => {
    let currentDecision: 'Validated' | 'Rejected' = 'Validated';
    let currentReason = '';
    let currentHours = order.estimatedHours || 2.5;
    let currentDate = order.scheduledDate || new Date().toISOString().split('T')[0];
    let currentTime = order.scheduledTime || '14:00';

    if (stepKey === 'pre1') {
      currentDecision = order.validationRespMaint?.validated ? 'Validated' : 'Rejected';
      currentReason = order.validationRespMaint?.rejectionReason || '';
      currentHours = order.validationRespMaint?.estimatedHours || currentHours;
      currentDate = order.validationRespMaint?.scheduledDate || currentDate;
      currentTime = order.validationRespMaint?.scheduledTime || currentTime;
    } else if (stepKey === 'pre2') {
      currentDecision = order.validationRespProd?.validated ? 'Validated' : 'Rejected';
      currentReason = order.validationRespProd?.rejectionReason || '';
    } else if (stepKey === 'pre3') {
      currentDecision = order.validationQHSE?.validated ? 'Validated' : 'Rejected';
      currentReason = order.validationQHSE?.rejectionReason || '';
    } else if (stepKey === 'post1') {
      currentDecision = order.validationReportProd?.validated ? 'Validated' : 'Rejected';
      currentReason = order.validationReportProd?.rejectionReason || '';
    } else if (stepKey === 'post2') {
      currentDecision = order.validationReportTech?.validated ? 'Validated' : 'Rejected';
      currentReason = order.validationReportTech?.rejectionReason || '';
    }

    const targetDecision = currentDecision === 'Validated' ? 'Rejected' : 'Validated';

    setModifyModal({
      orderId: order.id,
      refOT: order.refOT,
      stepKey,
      stepTitle,
      currentDecision,
      targetDecision,
      currentReason,
      currentHours,
      currentDate,
      currentTime,
    });
    setModifyReasonInput(currentReason);
    setModifyHours(currentHours);
    setModifyDate(currentDate);
    setModifyTime(currentTime);
  };

  // Submit Changed Decision
  const handleConfirmModifyDecision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modifyModal) return;

    const { orderId, stepKey, targetDecision } = modifyModal;

    if (targetDecision === 'Rejected' && !modifyReasonInput.trim()) {
      return;
    }

    if (stepKey === 'pre1' && onChangeDecisionPreStep1) {
      onChangeDecisionPreStep1(
        orderId,
        targetDecision,
        modifyHours,
        modifyDate,
        modifyTime,
        targetDecision === 'Rejected' ? modifyReasonInput.trim() : undefined
      );
    } else if (stepKey === 'pre2' && onChangeDecisionPreStep2) {
      onChangeDecisionPreStep2(
        orderId,
        targetDecision,
        targetDecision === 'Rejected' ? modifyReasonInput.trim() : undefined
      );
    } else if (stepKey === 'pre3' && onChangeDecisionPreStep3) {
      onChangeDecisionPreStep3(
        orderId,
        targetDecision,
        targetDecision === 'Rejected' ? modifyReasonInput.trim() : undefined
      );
    } else if (stepKey === 'post1' && onChangeDecisionPostStep1) {
      onChangeDecisionPostStep1(
        orderId,
        targetDecision,
        targetDecision === 'Rejected' ? modifyReasonInput.trim() : undefined
      );
    } else if (stepKey === 'post2' && onChangeDecisionPostStep2) {
      onChangeDecisionPostStep2(
        orderId,
        targetDecision,
        targetDecision === 'Rejected' ? modifyReasonInput.trim() : undefined
      );
    }

    setModifyModal(null);
    setModifyReasonInput('');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Workflow 10-14 Guidance Strip */}
      <div className="bg-white rounded-2xl p-4 border border-neutral-300 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
        </div>

        <div className="flex items-center gap-3">


          <button
            onClick={onOpenNewOTModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-xs cursor-pointer shrink-0"
          >
            + New Maintenance Order (OT)
          </button>
        </div>
      </div>

      {/* Search, Date, Category Filter, Stat Boxes */}
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

      {/* Main Table Container */}
      <div className="bg-[#ebeeed] rounded-3xl border border-neutral-400/80 shadow-xs overflow-hidden flex flex-col justify-between min-h-[500px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-300 text-sm font-bold text-neutral-900 bg-black/5">
                <th className="py-4 px-4">Date</th>
                <th className="py-4 px-4">Ref OT</th>
                <th className="py-4 px-4">Ref IR</th>
                <th className="py-4 px-4">Category</th>
                <th className="py-4 px-4">Priority</th>
                <th className="py-4 px-5">Assigned To</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-5">Validations</th>
                <th className="py-4 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-300/70 text-sm font-medium text-neutral-800">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-500">
                    No maintenance orders found matching criteria.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((ord) => {
                  const isExpanded = expandedOrderId === ord.id;

                  // Pre-validations status (Point 10)
                  const v1 = ord.validationRespMaint?.validated;
                  const rej1 = ord.validationRespMaint?.rejected;
                  const v2 = ord.validationRespProd?.validated;
                  const rej2 = ord.validationRespProd?.rejected;
                  const v3 = ord.validationQHSE?.validated;
                  const rej3 = ord.validationQHSE?.rejected;
                  const allPreValidated = Boolean(v1 && v2 && v3);

                  // Post-validations status (Point 13)
                  const vp1 = ord.validationReportProd?.validated;
                  const rejP1 = ord.validationReportProd?.rejected;
                  const vp2 = ord.validationReportTech?.validated;
                  const rejP2 = ord.validationReportTech?.rejected;

                  // Lock conditions: "if the next validation is validated, the previous validated can't be modified"
                  const isPre1LockedByNext = Boolean(v2); // Step 2 is validated
                  const isPre2LockedByNext = Boolean(v3); // Step 3 is validated
                  const isPre3LockedByNext = Boolean(
                    ord.reportRef || ord.status === 'Waiting work validation' || ord.status === 'Completed'
                  ); // Intervention report executed
                  const isPost1LockedByNext = Boolean(vp2); // Final closeout validated

                  return (
                    <React.Fragment key={ord.id}>
                      <tr
                        className={`hover:bg-white/40 transition-colors cursor-pointer ${isExpanded ? 'bg-white/60' : ''
                          }`}
                        onClick={() => toggleExpand(ord.id)}
                      >
                        <td className="py-3.5 px-4 font-mono text-xs tabular-nums text-neutral-700 whitespace-nowrap">
                          {ord.date}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-700 whitespace-nowrap">
                          {ord.refOT}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-neutral-600 whitespace-nowrap">
                          {ord.refIR}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1 items-start">
                            <span className="font-bold text-xs text-neutral-900 bg-white/70 px-2 py-0.5 rounded border border-neutral-300">
                              {ord.category}
                            </span>
                            {ord.category === 'Machine' && ord.machineMaintenanceType && (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${ord.machineMaintenanceType === 'Preventive'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  : 'bg-red-100 text-red-800 border-red-200'
                                  }`}
                              >
                                {ord.machineMaintenanceType}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${ord.priority === 'Urgent'
                              ? 'bg-red-100 text-red-800 border border-red-300'
                              : ord.priority === 'High'
                                ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                : ord.priority === 'Medium'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                  : 'bg-neutral-100 text-neutral-800'
                              }`}
                          >
                            {ord.priority}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-neutral-900 whitespace-nowrap">
                          <div className="font-bold text-xs">{ord.assignedTo}</div>
                          <div className="text-[11px] text-neutral-600 truncate max-w-[180px]">
                            {ord.equipmentName}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${ord.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : ord.status === 'In Progress'
                                ? 'bg-blue-100 text-blue-900 border-blue-300'
                                : ord.status === 'Waiting work validation'
                                  ? 'bg-purple-100 text-purple-900 border-purple-300'
                                  : ord.status === 'Rejected'
                                    ? 'bg-red-100 text-red-900 border-red-300'
                                    : 'bg-amber-100 text-amber-900 border-amber-300'
                              }`}
                          >
                            {ord.status === 'Completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                            {ord.status === 'In Progress' && <Wrench className="w-3.5 h-3.5 text-blue-600" />}
                            {ord.status === 'Waiting work validation' && <Clock className="w-3.5 h-3.5 text-purple-600" />}
                            {ord.status === 'Rejected' && <X className="w-3.5 h-3.5 text-red-600" />}
                            {ord.status === 'Waiting' && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                            <span>{ord.status}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          {/* Validation Pipeline Pills */}
                          <div className="flex items-center gap-1 text-[11px] font-bold">
                            <span
                              className={`px-1.5 py-0.5 rounded border ${v1
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : rej1
                                  ? 'bg-red-100 text-red-800 border-red-300'
                                  : 'bg-neutral-100 text-neutral-400 border-neutral-200'
                                }`}
                              title={rej1 ? `Refusé: ${ord.validationRespMaint?.rejectionReason}` : 'Étape 1: Resp. Maint'}
                            >
                              Maint
                            </span>
                            <span>&rarr;</span>
                            <span
                              className={`px-1.5 py-0.5 rounded border ${v2
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : rej2
                                  ? 'bg-red-100 text-red-800 border-red-300'
                                  : 'bg-neutral-100 text-neutral-400 border-neutral-200'
                                }`}
                              title={rej2 ? `Refusé: ${ord.validationRespProd?.rejectionReason}` : 'Étape 2: Resp. Prod'}
                            >
                              Prod
                            </span>
                            <span>&rarr;</span>
                            <span
                              className={`px-1.5 py-0.5 rounded border ${v3
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : rej3
                                  ? 'bg-red-100 text-red-800 border-red-300'
                                  : 'bg-neutral-100 text-neutral-400 border-neutral-200'
                                }`}
                              title={rej3 ? `Refusé: ${ord.validationQHSE?.rejectionReason}` : 'Étape 3: QHSE'}
                            >
                              QHSE
                            </span>
                            <span>|</span>
                            <span
                              className={`px-1.5 py-0.5 rounded border ${vp1
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : rejP1
                                  ? 'bg-red-100 text-red-800 border-red-300'
                                  : 'bg-neutral-100 text-neutral-400 border-neutral-200'
                                }`}
                              title={rejP1 ? `Refusé: ${ord.validationReportProd?.rejectionReason}` : 'Post 1: Resp. Prod'}
                            >
                              P-Prod
                            </span>
                            <span>&rarr;</span>
                            <span
                              className={`px-1.5 py-0.5 rounded border ${vp2
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : rejP2
                                  ? 'bg-red-100 text-red-800 border-red-300'
                                  : 'bg-neutral-100 text-neutral-400 border-neutral-200'
                                }`}
                              title={rejP2 ? `Refusé: ${ord.validationReportTech?.rejectionReason}` : 'Post 2: Resp. Tech (Clôture)'}
                            >
                              P-Tech
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            {/* Point 11: After the 3 validations -> a button to fill an intervention report both in mobile and desktop */}
                            {allPreValidated && ord.status === 'In Progress' && (
                              <>
                                <button
                                  onClick={() => handleDownloadMAD(ord)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-98"
                                  title="Télécharger la Fiche de Mise à Disposition & Autorisation (PDF)"
                                >
                                  <FileDown className="w-3.5 h-3.5" />
                                  <span>Mise à Dispo (PDF)</span>
                                </button>

                                <button
                                  onClick={() => onOpenReportModalForOT(ord)}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                                  title="Fill Intervention Report (Step 11)"
                                >
                                  <FileEdit className="w-3.5 h-3.5" />
                                  <span>Fill Report</span>
                                </button>
                              </>
                            )}

                            {/* Completed Order: Generate Administrative Report PDF */}
                            {ord.status === 'Completed' && (
                              <button
                                onClick={() => onOpenPdfReport(ord)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                                title="Generate Official Administration Report (PDF)"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>PDF Report</span>
                              </button>
                            )}

                            <button
                              onClick={() => toggleExpand(ord.id)}
                              className="p-1.5 bg-white hover:bg-neutral-100 text-neutral-700 rounded-xl border border-neutral-300 transition-colors shadow-2xs"
                              title="Toggle Workflow Details & Validation Panel"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>

                            {/* Admin Edit & Delete Actions */}
                            {isAdmin && (
                              <div className="flex items-center gap-1 pl-1.5 border-l border-neutral-300 ml-1">
                                <button
                                  onClick={() => handleOpenEditOrder(ord)}
                                  className="p-1.5 bg-white hover:bg-blue-50 text-blue-700 rounded-xl border border-neutral-300 hover:border-blue-300 transition-colors shadow-2xs cursor-pointer"
                                  title="Modifier l'Ordre de Travail (Admin)"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeletingOrder(ord)}
                                  className="p-1.5 bg-white hover:bg-red-50 text-red-700 rounded-xl border border-neutral-300 hover:border-red-300 transition-colors shadow-2xs cursor-pointer"
                                  title="Supprimer l'Ordre de Travail (Admin)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* INLINE ZERO-POPUP WORKFLOW EXPANSION */}
                      {isExpanded && (
                        <tr className="bg-neutral-50/95 border-b-2 border-neutral-300">
                          <td colSpan={9} className="p-6">
                            <div className="max-w-5xl mx-auto space-y-6">
                              {/* Order Summary Header */}
                              <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono font-bold text-blue-700">
                                      {ord.refOT} · {ord.refIR}
                                    </span>
                                    {ord.category === 'Machine' && ord.machineMaintenanceType && (
                                      <span
                                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${ord.machineMaintenanceType === 'Preventive'
                                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                          : 'bg-red-100 text-red-800 border-red-300'
                                          }`}
                                      >
                                        Machine: {ord.machineMaintenanceType} Maintenance
                                      </span>
                                    )}
                                  </div>
                                  <h3 className="text-base font-black text-neutral-900 mt-0.5">
                                    {ord.equipmentName}
                                  </h3>
                                  <p className="text-xs text-neutral-600 mt-1 max-w-2xl">
                                    {ord.description}
                                  </p>
                                </div>

                                <div className="text-right text-xs">
                                  <span className="text-neutral-500 block">Assigned Technician</span>
                                  <span className="font-bold text-neutral-900">{ord.assignedTo}</span>
                                </div>
                              </div>

                              {/* SECTION 1: POINT 10 - PRE-EXECUTION 3 VALIDATIONS */}
                              <div className="bg-white rounded-2xl p-5 border border-neutral-300 space-y-4 shadow-2xs">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                                      1
                                    </span>
                                    <h4 className="font-black text-sm text-neutral-900">
                                      Pre-Execution 3-Step Validations (Point 10)
                                    </h4>
                                  </div>
                                  <span className="text-xs font-bold text-neutral-500">
                                    {allPreValidated ? '3/3 Approved' : 'Action Required to begin work'}
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {/* Step 1: Responsable Maintenance */}
                                  <div
                                    className={`p-4 rounded-xl border transition-all ${v1
                                      ? 'bg-emerald-50/70 border-emerald-300'
                                      : rej1
                                        ? 'bg-red-50/70 border-red-300'
                                        : 'bg-neutral-50 border-neutral-300'
                                      }`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-bold uppercase text-neutral-600">
                                        Step 1: Resp. Maint.
                                      </span>
                                      {v1 ? (
                                        <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                          <Check className="w-3.5 h-3.5" /> Approved
                                        </span>
                                      ) : rej1 ? (
                                        <span className="text-[11px] font-bold text-red-700 flex items-center gap-1">
                                          <X className="w-3.5 h-3.5" /> Refusé
                                        </span>
                                      ) : (
                                        <span className="text-[11px] font-bold text-amber-600">
                                          Pending
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-neutral-600 mb-3">
                                      Specify estimated time & scheduled date/time.
                                    </p>

                                    {/* Sub-case 1A: Step 1 is Validated */}
                                    {v1 ? (
                                      <div className="space-y-2">
                                        <div className="space-y-1 text-xs text-neutral-700 bg-white/70 p-2.5 rounded-lg border border-emerald-200">
                                          <div>
                                            <span className="text-neutral-500 font-semibold">Duration: </span>
                                            <span className="font-bold">
                                              {ord.validationRespMaint?.estimatedHours || ord.estimatedHours}h
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-neutral-500 font-semibold">Scheduled: </span>
                                            <span className="font-mono font-bold">
                                              {ord.validationRespMaint?.scheduledDate || ord.scheduledDate} at{' '}
                                              {ord.validationRespMaint?.scheduledTime || ord.scheduledTime}
                                            </span>
                                          </div>
                                          <div className="text-[10px] text-neutral-500">
                                            By: {ord.validationRespMaint?.validatedBy} on {ord.validationRespMaint?.validatedAt}
                                          </div>
                                        </div>

                                        {/* Ability to modify decision before next step */}
                                        {isPre1LockedByNext ? (
                                          <div
                                            className="text-[11px] text-neutral-600 bg-neutral-100 p-2 rounded-lg border border-neutral-200 flex items-center gap-1.5"
                                            title="L'Étape 2 (Production) a déjà été validée : la décision de l'étape 1 ne peut plus être modifiée."
                                          >
                                            <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                            <span>Verrouillé (Étape 2 Production validée)</span>
                                          </div>
                                        ) : (
                                          isRespMaintRole && (
                                            <button
                                              onClick={() =>
                                                openModifyModal(
                                                  ord,
                                                  'pre1',
                                                  'Étape 1: Responsable Maintenance'
                                                )
                                              }
                                              className="w-full py-1 px-2 bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-bold rounded-lg border border-neutral-300 transition-colors shadow-2xs flex items-center justify-center gap-1"
                                            >
                                              <RotateCcw className="w-3 h-3 text-blue-600" />
                                              <span>Modifier Décision</span>
                                            </button>
                                          )
                                        )}
                                      </div>
                                    ) : rej1 ? (
                                      /* Sub-case 1B: Step 1 was Rejected */
                                      <div className="space-y-2">
                                        <div className="text-xs text-red-700 bg-white/80 p-2.5 rounded-lg border border-red-200 space-y-1">
                                          <div className="flex items-start gap-1 font-semibold">
                                            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                                            <span>Motif du refus :</span>
                                          </div>
                                          <p className="text-neutral-800 pl-4">
                                            {ord.validationRespMaint?.rejectionReason || 'Non spécifié'}
                                          </p>
                                          <div className="text-[10px] text-neutral-500 pt-1">
                                            Par : {ord.validationRespMaint?.rejectedBy} on{' '}
                                            {ord.validationRespMaint?.rejectedAt}
                                          </div>
                                        </div>

                                        {isRespMaintRole && !isPre1LockedByNext && (
                                          <button
                                            onClick={() =>
                                              openModifyModal(
                                                ord,
                                                'pre1',
                                                'Étape 1: Responsable Maintenance'
                                              )
                                            }
                                            className="w-full py-1 px-2 bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-bold rounded-lg border border-neutral-300 transition-colors shadow-2xs flex items-center justify-center gap-1"
                                          >
                                            <RotateCcw className="w-3 h-3 text-blue-600" />
                                            <span>Modify Decision (Re-validate)</span>
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      /* Sub-case 1C: Step 1 is Pending */
                                      isRespMaintRole ? (
                                        <div className="space-y-2">
                                          <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                              <label className="text-[10px] font-bold text-neutral-600 block">
                                                Est. Hours:
                                              </label>
                                              <input
                                                type="number"
                                                step="0.5"
                                                min="0.5"
                                                value={step1Hours}
                                                onChange={(e) => setStep1Hours(parseFloat(e.target.value) || 1)}
                                                className="w-full bg-white border border-neutral-300 rounded px-2 py-1 text-xs font-bold"
                                              />
                                            </div>
                                            <div>
                                              <label className="text-[10px] font-bold text-neutral-600 block">
                                                Time:
                                              </label>
                                              <input
                                                type="time"
                                                value={step1Time}
                                                onChange={(e) => setStep1Time(e.target.value)}
                                                className="w-full bg-white border border-neutral-300 rounded px-2 py-1 text-xs"
                                              />
                                            </div>
                                          </div>
                                          <div>
                                            <label className="text-[10px] font-bold text-neutral-600 block">
                                              Date:
                                            </label>
                                            <input
                                              type="date"
                                              value={step1Date}
                                              onChange={(e) => setStep1Date(e.target.value)}
                                              className="w-full bg-white border border-neutral-300 rounded px-2 py-1 text-xs font-mono"
                                            />
                                          </div>

                                          <div className="grid grid-cols-2 gap-2 pt-1">
                                            <button
                                              onClick={() =>
                                                onValidatePreStep1RespMaint(
                                                  ord.id,
                                                  step1Hours,
                                                  step1Date,
                                                  step1Time
                                                )
                                              }
                                              className="py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1"
                                            >
                                              <Check className="w-3.5 h-3.5" />
                                              <span>Approve</span>
                                            </button>

                                            <button
                                              onClick={() =>
                                                openRejectModal(
                                                  ord.id,
                                                  ord.refOT,
                                                  'pre1',
                                                  'Étape 1: Responsable Maintenance'
                                                )
                                              }
                                              className="py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                              <span>Rejeter</span>
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        /* NOT THE REQUIRED ROLE -> SHOW WAITING STATE */
                                        <div
                                          className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1"
                                          title={`Pending validation by: Maintenance Manager (Votre rôle: ${currentUser?.role || 'Opérateur'})`}
                                        >
                                          <div className="flex items-center gap-1.5 font-bold text-amber-950">
                                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                                            <span>Pending validation by:</span>
                                          </div>
                                          <p className="text-[11px] text-amber-800 font-semibold pl-5">
                                            Responsable Maintenance
                                          </p>
                                        </div>
                                      )
                                    )}
                                  </div>

                                  {/* Step 2: Responsable Production */}
                                  <div
                                    className={`p-4 rounded-xl border transition-all ${v2
                                      ? 'bg-emerald-50/70 border-emerald-300'
                                      : rej2
                                        ? 'bg-red-50/70 border-red-300'
                                        : 'bg-neutral-50 border-neutral-300'
                                      }`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-bold uppercase text-neutral-600">
                                        Step 2: Resp. Prod.
                                      </span>
                                      {v2 ? (
                                        <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                          <Check className="w-3.5 h-3.5" /> Approved
                                        </span>
                                      ) : rej2 ? (
                                        <span className="text-[11px] font-bold text-red-700 flex items-center gap-1">
                                          <X className="w-3.5 h-3.5" /> Refusé
                                        </span>
                                      ) : (
                                        <span className="text-[11px] font-bold text-amber-600">
                                          Pending
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-neutral-600 mb-3">
                                      Approve line stoppage and changeover slot.
                                    </p>

                                    {/* Sub-case 2A: Step 2 is Validated */}
                                    {v2 ? (
                                      <div className="space-y-2">
                                        <div className="text-xs text-neutral-700 bg-white/70 p-2.5 rounded-lg border border-emerald-200">
                                          <div className="font-bold text-emerald-900">
                                            Production window confirmed
                                          </div>
                                          <div className="text-[10px] text-neutral-500 mt-1">
                                            By: {ord.validationRespProd?.validatedBy} on{' '}
                                            {ord.validationRespProd?.validatedAt}
                                          </div>
                                        </div>

                                        {/* Lock rule check: if Step 3 (QHSE) is validated, Step 2 is locked */}
                                        {isPre2LockedByNext ? (
                                          <div
                                            className="text-[11px] text-neutral-600 bg-neutral-100 p-2 rounded-lg border border-neutral-200 flex items-center gap-1.5"
                                            title="L'Étape 3 (QHSE) a déjà été validée : la décision de l'étape 2 ne peut plus être modifiée."
                                          >
                                            <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                            <span>Verrouillé (Étape 3 QHSE validée)</span>
                                          </div>
                                        ) : (
                                          isRespProdRole && (
                                            <button
                                              onClick={() =>
                                                openModifyModal(
                                                  ord,
                                                  'pre2',
                                                  'Étape 2: Responsable Production'
                                                )
                                              }
                                              className="w-full py-1 px-2 bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-bold rounded-lg border border-neutral-300 transition-colors shadow-2xs flex items-center justify-center gap-1"
                                            >
                                              <RotateCcw className="w-3 h-3 text-blue-600" />
                                              <span>Modifier Décision</span>
                                            </button>
                                          )
                                        )}
                                      </div>
                                    ) : rej2 ? (
                                      /* Sub-case 2B: Step 2 was Rejected */
                                      <div className="space-y-2">
                                        <div className="text-xs text-red-700 bg-white/80 p-2.5 rounded-lg border border-red-200 space-y-1">
                                          <div className="flex items-start gap-1 font-semibold">
                                            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                                            <span>Motif du refus :</span>
                                          </div>
                                          <p className="text-neutral-800 pl-4">
                                            {ord.validationRespProd?.rejectionReason || 'Non spécifié'}
                                          </p>
                                          <div className="text-[10px] text-neutral-500 pt-1">
                                            Par : {ord.validationRespProd?.rejectedBy} on{' '}
                                            {ord.validationRespProd?.rejectedAt}
                                          </div>
                                        </div>

                                        {isRespProdRole && !isPre2LockedByNext && (
                                          <button
                                            onClick={() =>
                                              openModifyModal(
                                                ord,
                                                'pre2',
                                                'Étape 2: Responsable Production'
                                              )
                                            }
                                            className="w-full py-1 px-2 bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-bold rounded-lg border border-neutral-300 transition-colors shadow-2xs flex items-center justify-center gap-1"
                                          >
                                            <RotateCcw className="w-3 h-3 text-blue-600" />
                                            <span>Modify Decision (Re-validate)</span>
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      /* Sub-case 2C: Step 2 is Pending */
                                      !v1 ? (
                                        <div className="p-3 bg-neutral-100 rounded-xl border border-neutral-200 text-xs text-neutral-500 space-y-1">
                                          <div className="flex items-center gap-1 font-bold text-neutral-700">
                                            <Clock className="w-3.5 h-3.5 text-neutral-400" />
                                            <span>Préalable requis :</span>
                                          </div>
                                          <p className="text-[11px] text-neutral-600 pl-4.5">
                                            Awaiting Step 1 approval (Maintenance Manager)
                                          </p>
                                        </div>
                                      ) : isRespProdRole ? (
                                        <div className="grid grid-cols-2 gap-2 mt-4">
                                          <button
                                            onClick={() => onValidatePreStep2RespProd(ord.id)}
                                            className="py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1"
                                          >
                                            <Check className="w-3.5 h-3.5" />
                                            <span>Approve</span>
                                          </button>

                                          <button
                                            onClick={() =>
                                              openRejectModal(
                                                ord.id,
                                                ord.refOT,
                                                'pre2',
                                                'Étape 2: Responsable Production'
                                              )
                                            }
                                            className="py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                            <span>Rejeter</span>
                                          </button>
                                        </div>
                                      ) : (
                                        <div
                                          className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1"
                                          title={`Pending validation by: Production Manager (Votre rôle: ${currentUser?.role || 'Opérateur'})`}
                                        >
                                          <div className="flex items-center gap-1.5 font-bold text-amber-950">
                                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                                            <span>Pending validation by:</span>
                                          </div>
                                          <p className="text-[11px] text-amber-800 font-semibold pl-5">
                                            Responsable Production
                                          </p>
                                        </div>
                                      )
                                    )}
                                  </div>

                                  {/* Step 3: Responsable QHSE */}
                                  <div
                                    className={`p-4 rounded-xl border transition-all ${v3
                                      ? 'bg-emerald-50/70 border-emerald-300'
                                      : rej3
                                        ? 'bg-red-50/70 border-red-300'
                                        : 'bg-neutral-50 border-neutral-300'
                                      }`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-bold uppercase text-neutral-600">
                                        Step 3: Resp. QHSE
                                      </span>
                                      {v3 ? (
                                        <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                          <Check className="w-3.5 h-3.5" /> Approved
                                        </span>
                                      ) : rej3 ? (
                                        <span className="text-[11px] font-bold text-red-700 flex items-center gap-1">
                                          <X className="w-3.5 h-3.5" /> Refusé
                                        </span>
                                      ) : (
                                        <span className="text-[11px] font-bold text-amber-600">
                                          Pending
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-neutral-600 mb-3">
                                      Lockout/Tagout (LOTO) & safety compliance.
                                    </p>

                                    {/* Sub-case 3A: Step 3 is Validated */}
                                    {v3 ? (
                                      <div className="space-y-2">
                                        <div className="text-xs text-neutral-700 bg-white/70 p-2.5 rounded-lg border border-emerald-200">
                                          <div className="font-bold text-emerald-900">
                                            LOTO Safety cleared
                                          </div>
                                          <div className="text-[10px] text-neutral-500 mt-1">
                                            By: {ord.validationQHSE?.validatedBy} on{' '}
                                            {ord.validationQHSE?.validatedAt}
                                          </div>
                                        </div>

                                        {/* Lock rule check: if report submitted, Step 3 is locked */}
                                        {isPre3LockedByNext ? (
                                          <div
                                            className="text-[11px] text-neutral-600 bg-neutral-100 p-2 rounded-lg border border-neutral-200 flex items-center gap-1.5"
                                            title="Intervention report already submitted: QHSE decision can no longer be modified."
                                          >
                                            <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                            <span>Locked (Intervention report in progress/submitted)</span>
                                          </div>
                                        ) : (
                                          isQHSERole && (
                                            <button
                                              onClick={() =>
                                                openModifyModal(
                                                  ord,
                                                  'pre3',
                                                  'Étape 3: Responsable QHSE'
                                                )
                                              }
                                              className="w-full py-1 px-2 bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-bold rounded-lg border border-neutral-300 transition-colors shadow-2xs flex items-center justify-center gap-1"
                                            >
                                              <RotateCcw className="w-3 h-3 text-blue-600" />
                                              <span>Modifier Décision</span>
                                            </button>
                                          )
                                        )}
                                      </div>
                                    ) : rej3 ? (
                                      /* Sub-case 3B: Step 3 was Rejected */
                                      <div className="space-y-2">
                                        <div className="text-xs text-red-700 bg-white/80 p-2.5 rounded-lg border border-red-200 space-y-1">
                                          <div className="flex items-start gap-1 font-semibold">
                                            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                                            <span>Motif du refus :</span>
                                          </div>
                                          <p className="text-neutral-800 pl-4">
                                            {ord.validationQHSE?.rejectionReason || 'Non spécifié'}
                                          </p>
                                          <div className="text-[10px] text-neutral-500 pt-1">
                                            Par : {ord.validationQHSE?.rejectedBy} on{' '}
                                            {ord.validationQHSE?.rejectedAt}
                                          </div>
                                        </div>

                                        {isQHSERole && !isPre3LockedByNext && (
                                          <button
                                            onClick={() =>
                                              openModifyModal(
                                                ord,
                                                'pre3',
                                                'Étape 3: Responsable QHSE'
                                              )
                                            }
                                            className="w-full py-1 px-2 bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-bold rounded-lg border border-neutral-300 transition-colors shadow-2xs flex items-center justify-center gap-1"
                                          >
                                            <RotateCcw className="w-3 h-3 text-blue-600" />
                                            <span>Modify Decision (Re-validate)</span>
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      /* Sub-case 3C: Step 3 is Pending */
                                      !v2 ? (
                                        <div className="p-3 bg-neutral-100 rounded-xl border border-neutral-200 text-xs text-neutral-500 space-y-1">
                                          <div className="flex items-center gap-1 font-bold text-neutral-700">
                                            <Clock className="w-3.5 h-3.5 text-neutral-400" />
                                            <span>Préalable requis :</span>
                                          </div>
                                          <p className="text-[11px] text-neutral-600 pl-4.5">
                                            Awaiting Step 2 approval (Production Manager)
                                          </p>
                                        </div>
                                      ) : isQHSERole ? (
                                        <div className="grid grid-cols-2 gap-2 mt-4">
                                          <button
                                            onClick={() => onValidatePreStep3QHSE(ord.id)}
                                            className="py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1"
                                          >
                                            <Check className="w-3.5 h-3.5" />
                                            <span>Approve</span>
                                          </button>

                                          <button
                                            onClick={() =>
                                              openRejectModal(
                                                ord.id,
                                                ord.refOT,
                                                'pre3',
                                                'Étape 3: Responsable QHSE'
                                              )
                                            }
                                            className="py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                            <span>Rejeter</span>
                                          </button>
                                        </div>
                                      ) : (
                                        <div
                                          className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1"
                                          title={`Pending validation by: QHSE Manager (Votre rôle: ${currentUser?.role || 'Opérateur'})`}
                                        >
                                          <div className="flex items-center gap-1.5 font-bold text-amber-950">
                                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                                            <span>Pending validation by:</span>
                                          </div>
                                          <p className="text-[11px] text-amber-800 font-semibold pl-5">
                                            Responsable QHSE
                                          </p>
                                        </div>
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* SECTION 2: POINT 11 & 12 - INTERVENTION REPORT FILL */}
                              <div className="bg-white rounded-2xl p-5 border border-neutral-300 space-y-3 shadow-2xs">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                                      2
                                    </span>
                                    <h4 className="font-black text-sm text-neutral-900">
                                      Intervention Report Execution (Point 11 & 12)
                                    </h4>
                                  </div>

                                  <span className="text-xs font-semibold text-neutral-500">
                                    {ord.reportRef ? (
                                      <span className="text-emerald-700 font-bold font-mono">
                                        Linked Report: {ord.reportRef}
                                      </span>
                                    ) : (
                                      'Awaiting technician execution'
                                    )}
                                  </span>
                                </div>

                                {allPreValidated ? (
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-blue-50/50 rounded-xl border border-blue-200">
                                    <div>
                                      <div className="font-bold text-neutral-900 text-sm">
                                        Work Unlocked (Point 11): Button to fill an intervention report both in mobile and desktop
                                      </div>
                                      <p className="text-xs text-neutral-600 mt-0.5">
                                        Once the technician completes the report and stock deduction, the order status changes to <span className="font-bold underline">&quot;Waiting work validation&quot;</span>.
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                                      <button
                                        onClick={() => handleDownloadMAD(ord)}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all shrink-0 cursor-pointer active:scale-98"
                                        title="Télécharger la fiche de mise à disposition de l'équipement (PDF)"
                                      >
                                        <FileDown className="w-4 h-4" />
                                        <span>Mise à Disposition (PDF)</span>
                                      </button>

                                      <button
                                        onClick={() => onOpenReportModalForOT(ord)}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
                                      >
                                        <FileEdit className="w-4 h-4" />
                                        <span>
                                          {ord.reportRef ? 'Re-open / Update Report' : 'Fill Intervention Report'}
                                        </span>
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span>
                                      Intervention report button will unlock as soon as all 3 pre-execution validations are signed off.
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* SECTION 3: POINT 13 & 14 - POST-INTERVENTION VALIDATION */}
                              <div className="bg-white rounded-2xl p-5 border border-neutral-300 space-y-4 shadow-2xs">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                                      3
                                    </span>
                                    <h4 className="font-black text-sm text-neutral-900">
                                      Post-Intervention Double Validation (Point 13 & 14)
                                    </h4>
                                  </div>
                                  <span className="text-xs font-bold text-neutral-500">
                                    {ord.status === 'Completed'
                                      ? 'Completed (Point 14)'
                                      : 'Requires Prod & Tech approval'}
                                  </span>
                                </div>

                                <p className="text-xs text-neutral-600">
                                  Validation of intervention report is by <span className="font-bold">Responsable Production</span> and then <span className="font-bold">Responsable Technique</span>. After validation, that maintenance order changes to <span className="font-bold text-emerald-700">Completed</span>.
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Post Step 1: Responsable Production */}
                                  <div
                                    className={`p-4 rounded-xl border transition-all ${vp1
                                      ? 'bg-emerald-50/70 border-emerald-300'
                                      : rejP1
                                        ? 'bg-red-50/70 border-red-300'
                                        : 'bg-neutral-50 border-neutral-300'
                                      }`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-bold uppercase text-neutral-600">
                                        Step 1: Resp. Production Signoff
                                      </span>
                                      {vp1 ? (
                                        <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                          <Check className="w-3.5 h-3.5" /> Validated
                                        </span>
                                      ) : rejP1 ? (
                                        <span className="text-[11px] font-bold text-red-700 flex items-center gap-1">
                                          <X className="w-3.5 h-3.5" /> Refusé
                                        </span>
                                      ) : (
                                        <span className="text-[11px] font-bold text-amber-600">
                                          Pending
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-neutral-600 mb-3">
                                      Confirm parts injected pass visual/dimensional quality and line restarts.
                                    </p>

                                    {/* Sub-case Post 1A: Validated */}
                                    {vp1 ? (
                                      <div className="space-y-2">
                                        <div className="text-xs text-neutral-700 bg-white/70 p-2.5 rounded-lg border border-emerald-200">
                                          <div className="font-bold text-emerald-900">
                                            Production accepted & confirmed
                                          </div>
                                          <div className="text-[10px] text-neutral-500 mt-1">
                                            By: {ord.validationReportProd?.validatedBy} on{' '}
                                            {ord.validationReportProd?.validatedAt}
                                          </div>
                                        </div>

                                        {/* Lock rule check: if Post Step 2 (Resp. Technique) is validated, Post Step 1 is locked */}
                                        {isPost1LockedByNext ? (
                                          <div
                                            className="text-[11px] text-neutral-600 bg-neutral-100 p-2 rounded-lg border border-neutral-200 flex items-center gap-1.5"
                                            title="Work order closed by Technical Manager: production signoff can no longer be modified."
                                          >
                                            <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                            <span>Verrouillé (Clôture finale validée)</span>
                                          </div>
                                        ) : (
                                          isRespProdRole && (
                                            <button
                                              onClick={() =>
                                                openModifyModal(
                                                  ord,
                                                  'post1',
                                                  'Post-Étape 1: Réception Production'
                                                )
                                              }
                                              className="w-full py-1 px-2 bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-bold rounded-lg border border-neutral-300 transition-colors shadow-2xs flex items-center justify-center gap-1"
                                            >
                                              <RotateCcw className="w-3 h-3 text-blue-600" />
                                              <span>Modifier Décision</span>
                                            </button>
                                          )
                                        )}
                                      </div>
                                    ) : rejP1 ? (
                                      /* Sub-case Post 1B: Rejected */
                                      <div className="space-y-2">
                                        <div className="text-xs text-red-700 bg-white/80 p-2.5 rounded-lg border border-red-200 space-y-1">
                                          <div className="flex items-start gap-1 font-semibold">
                                            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                                            <span>Motif du refus :</span>
                                          </div>
                                          <p className="text-neutral-800 pl-4">
                                            {ord.validationReportProd?.rejectionReason || 'Non spécifié'}
                                          </p>
                                          <div className="text-[10px] text-neutral-500 pt-1">
                                            Par : {ord.validationReportProd?.rejectedBy} on{' '}
                                            {ord.validationReportProd?.rejectedAt}
                                          </div>
                                        </div>

                                        {isRespProdRole && !isPost1LockedByNext && (
                                          <button
                                            onClick={() =>
                                              openModifyModal(
                                                ord,
                                                'post1',
                                                'Post-Étape 1: Réception Production'
                                              )
                                            }
                                            className="w-full py-1 px-2 bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-bold rounded-lg border border-neutral-300 transition-colors shadow-2xs flex items-center justify-center gap-1"
                                          >
                                            <RotateCcw className="w-3 h-3 text-blue-600" />
                                            <span>Modify Decision (Re-validate)</span>
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      /* Sub-case Post 1C: Pending */
                                      ord.status !== 'Waiting work validation' ? (
                                        <div className="p-3 bg-neutral-100 rounded-xl border border-neutral-200 text-xs text-neutral-500 space-y-1">
                                          <div className="flex items-center gap-1 font-bold text-neutral-700">
                                            <Clock className="w-3.5 h-3.5 text-neutral-400" />
                                            <span>Préalable requis :</span>
                                          </div>
                                          <p className="text-[11px] text-neutral-600 pl-4.5">
                                            Awaiting technician intervention report entry
                                          </p>
                                        </div>
                                      ) : isRespProdRole ? (
                                        <div className="grid grid-cols-2 gap-2 mt-4">
                                          <button
                                            onClick={() => onValidatePostStep1RespProd(ord.id)}
                                            className="py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1"
                                          >
                                            <Check className="w-3.5 h-3.5" />
                                            <span>Validate Acceptance</span>
                                          </button>

                                          <button
                                            onClick={() =>
                                              openRejectModal(
                                                ord.id,
                                                ord.refOT,
                                                'post1',
                                                'Post-Étape 1: Réception Production'
                                              )
                                            }
                                            className="py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                            <span>Rejeter</span>
                                          </button>
                                        </div>
                                      ) : (
                                        <div
                                          className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1"
                                          title={`Pending validation by: Production Manager (Votre rôle: ${currentUser?.role || 'Opérateur'})`}
                                        >
                                          <div className="flex items-center gap-1.5 font-bold text-amber-950">
                                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                                            <span>Pending validation by:</span>
                                          </div>
                                          <p className="text-[11px] text-amber-800 font-semibold pl-5">
                                            Responsable Production
                                          </p>
                                        </div>
                                      )
                                    )}
                                  </div>

                                  {/* Post Step 2: Responsable Technique */}
                                  <div
                                    className={`p-4 rounded-xl border transition-all ${vp2
                                      ? 'bg-emerald-50/70 border-emerald-300'
                                      : rejP2
                                        ? 'bg-red-50/70 border-red-300'
                                        : 'bg-neutral-50 border-neutral-300'
                                      }`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-bold uppercase text-neutral-600">
                                        Step 2: Resp. Technique Final Closeout
                                      </span>
                                      {vp2 ? (
                                        <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                          <Check className="w-3.5 h-3.5" /> Completed
                                        </span>
                                      ) : rejP2 ? (
                                        <span className="text-[11px] font-bold text-red-700 flex items-center gap-1">
                                          <X className="w-3.5 h-3.5" /> Refusé
                                        </span>
                                      ) : (
                                        <span className="text-[11px] font-bold text-amber-600">
                                          Pending
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-neutral-600 mb-3">
                                      Technical root cause validation & order completion.
                                    </p>

                                    {/* Sub-case Post 2A: Validated */}
                                    {vp2 ? (
                                      <div className="space-y-2">
                                        <div className="text-xs text-neutral-700 bg-white/70 p-2.5 rounded-lg border border-emerald-200">
                                          <div className="font-bold text-emerald-900">
                                            Technical closeout confirmed (OT Completed)
                                          </div>
                                          <div className="text-[10px] text-neutral-500 mt-1">
                                            By: {ord.validationReportTech?.validatedBy} on{' '}
                                            {ord.validationReportTech?.validatedAt}
                                          </div>
                                        </div>

                                        {isRespTechRole && (
                                          <button
                                            onClick={() =>
                                              openModifyModal(
                                                ord,
                                                'post2',
                                                'Post-Étape 2: Clôture Technique Finale'
                                              )
                                            }
                                            className="w-full py-1 px-2 bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-bold rounded-lg border border-neutral-300 transition-colors shadow-2xs flex items-center justify-center gap-1"
                                          >
                                            <RotateCcw className="w-3 h-3 text-blue-600" />
                                            <span>Modifier Décision</span>
                                          </button>
                                        )}
                                      </div>
                                    ) : rejP2 ? (
                                      /* Sub-case Post 2B: Rejected */
                                      <div className="space-y-2">
                                        <div className="text-xs text-red-700 bg-white/80 p-2.5 rounded-lg border border-red-200 space-y-1">
                                          <div className="flex items-start gap-1 font-semibold">
                                            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                                            <span>Motif du refus :</span>
                                          </div>
                                          <p className="text-neutral-800 pl-4">
                                            {ord.validationReportTech?.rejectionReason || 'Non spécifié'}
                                          </p>
                                          <div className="text-[10px] text-neutral-500 pt-1">
                                            Par : {ord.validationReportTech?.rejectedBy} on{' '}
                                            {ord.validationReportTech?.rejectedAt}
                                          </div>
                                        </div>

                                        {isRespTechRole && (
                                          <button
                                            onClick={() =>
                                              openModifyModal(
                                                ord,
                                                'post2',
                                                'Post-Étape 2: Clôture Technique Finale'
                                              )
                                            }
                                            className="w-full py-1 px-2 bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-bold rounded-lg border border-neutral-300 transition-colors shadow-2xs flex items-center justify-center gap-1"
                                          >
                                            <RotateCcw className="w-3 h-3 text-blue-600" />
                                            <span>Modify Decision (Re-validate)</span>
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      /* Sub-case Post 2C: Pending */
                                      !vp1 ? (
                                        <div className="p-3 bg-neutral-100 rounded-xl border border-neutral-200 text-xs text-neutral-500 space-y-1">
                                          <div className="flex items-center gap-1 font-bold text-neutral-700">
                                            <Clock className="w-3.5 h-3.5 text-neutral-400" />
                                            <span>Préalable requis :</span>
                                          </div>
                                          <p className="text-[11px] text-neutral-600 pl-4.5">
                                            Awaiting Post-Step 1 approval (Production Manager)
                                          </p>
                                        </div>
                                      ) : isRespTechRole ? (
                                        <div className="grid grid-cols-2 gap-2 mt-4">
                                          <button
                                            onClick={() => onValidatePostStep2RespTech(ord.id)}
                                            className="py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1"
                                          >
                                            <Check className="w-3.5 h-3.5" />
                                            <span>Clôturer OT</span>
                                          </button>

                                          <button
                                            onClick={() =>
                                              openRejectModal(
                                                ord.id,
                                                ord.refOT,
                                                'post2',
                                                'Post-Étape 2: Clôture Technique Finale'
                                              )
                                            }
                                            className="py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                            <span>Rejeter</span>
                                          </button>
                                        </div>
                                      ) : (
                                        <div
                                          className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1"
                                          title={`Pending validation by: Technical Manager (Votre rôle: ${currentUser?.role || 'Opérateur'})`}
                                        >
                                          <div className="flex items-center gap-1.5 font-bold text-amber-950">
                                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                                            <span>Pending validation by:</span>
                                          </div>
                                          <p className="text-[11px] text-amber-800 font-semibold pl-5">
                                            Responsable Technique
                                          </p>
                                        </div>
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* POINT 14 COMPLETED: ADMINISTRATIVE PDF REPORT DOWNLOAD BANNER */}
                              {ord.status === 'Completed' && (
                                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs shadow-2xs">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                      <span className="font-bold text-emerald-950 text-sm">
                                        Official Administrative Report (PV de Clôture) Ready
                                      </span>
                                    </div>
                                    <p className="text-emerald-800 mt-0.5">
                                      Contains complete 5-stakeholder workflow signatures, AMDEC root cause analysis, time metrics, and warehouse spare parts voucher.
                                    </p>
                                  </div>

                                  <button
                                    onClick={() => onOpenPdfReport(ord)}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
                                  >
                                    <FileText className="w-4 h-4" />
                                    <span>Download Official Report PDF</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination */}
        <PaginationBar
          totalItems={filteredOrders.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* ========================================================================= */}
      {/* REJECTION REASON MODAL                                                   */}
      {/* ========================================================================= */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-neutral-300 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="font-black text-base text-neutral-900">
                  Motif du Rejet Obligatoire
                </h3>
              </div>
              <button
                onClick={() => setRejectModal(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-neutral-600 space-y-1">
              <p>
                Vous êtes sur le point de rejeter :{' '}
                <strong className="text-neutral-900 font-mono font-bold">
                  {rejectModal.refOT}
                </strong>
              </p>
              <p className="font-semibold text-neutral-800">
                Étape : {rejectModal.stepTitle}
              </p>
              <p className="text-neutral-500">
                Veuillez expliquer le motif du refus (ex: créneau de production indisponible, absence de pièces critiques, non-conformité sécurité LOTO).
              </p>
            </div>

            <form onSubmit={handleConfirmRejection} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-neutral-800 block mb-1">
                  Motif du refus <span className="text-red-500">*</span> :
                </label>
                <textarea
                  required
                  rows={4}
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  placeholder="Expliquez clairement la raison du refus..."
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl p-3 text-xs text-neutral-900 focus:bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModal(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!rejectionReasonInput.trim()}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer"
                >
                  Confirmer le Rejet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODIFY DECISION MODAL (Before Next Step is Executed)                      */}
      {/* ========================================================================= */}
      {modifyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-neutral-300 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-blue-600">
                <RotateCcw className="w-5 h-5 shrink-0" />
                <h3 className="font-black text-base text-neutral-900">
                  Modifier la Décision
                </h3>
              </div>
              <button
                onClick={() => setModifyModal(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-neutral-600 space-y-1">
              <p>
                Work order:{' '}
                <strong className="text-neutral-900 font-mono font-bold">
                  {modifyModal.refOT}
                </strong>
              </p>
              <p className="font-semibold text-neutral-800">
                Étape : {modifyModal.stepTitle}
              </p>
              <div className="p-2.5 bg-neutral-100 rounded-xl text-neutral-700 flex items-center gap-2">
                <span>Décision actuelle :</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded text-xs ${modifyModal.currentDecision === 'Validated'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-red-100 text-red-800'
                    }`}
                >
                  {modifyModal.currentDecision}
                </span>
                <span>&rarr; Nouvelle décision :</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded text-xs ${modifyModal.targetDecision === 'Validated'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-red-100 text-red-800'
                    }`}
                >
                  {modifyModal.targetDecision}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmModifyDecision} className="space-y-4">
              {/* If switching to Validated for Step 1 -> input hours, date, time */}
              {modifyModal.stepKey === 'pre1' && modifyModal.targetDecision === 'Validated' && (
                <div className="space-y-3 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-neutral-700 block">
                        Estimated duration (hours):
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        value={modifyHours}
                        onChange={(e) => setModifyHours(parseFloat(e.target.value) || 1)}
                        className="w-full bg-white border border-neutral-300 rounded px-2 py-1 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-neutral-700 block">
                        Scheduled time:
                      </label>
                      <input
                        type="time"
                        value={modifyTime}
                        onChange={(e) => setModifyTime(e.target.value)}
                        className="w-full bg-white border border-neutral-300 rounded px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-700 block">
                      Date programmée :
                    </label>
                    <input
                      type="date"
                      value={modifyDate}
                      onChange={(e) => setModifyDate(e.target.value)}
                      className="w-full bg-white border border-neutral-300 rounded px-2 py-1 text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              {/* If switching to Rejected -> mandatory rejection reason */}
              {modifyModal.targetDecision === 'Rejected' && (
                <div>
                  <label className="text-xs font-bold text-neutral-800 block mb-1">
                    Motif du refus <span className="text-red-500">*</span> :
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={modifyReasonInput}
                    onChange={(e) => setModifyReasonInput(e.target.value)}
                    placeholder="Précisez le motif du refus..."
                    className="w-full bg-neutral-50 border border-neutral-300 rounded-xl p-3 text-xs text-neutral-900 focus:bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
                    autoFocus
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModifyModal(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={modifyModal.targetDecision === 'Rejected' && !modifyReasonInput.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer"
                >
                  Appliquer la Nouvelle Décision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADMIN EDIT MAINTENANCE ORDER                                      */}
      {/* ========================================================================= */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-neutral-900 rounded-3xl p-6 sm:p-8 border border-neutral-300 shadow-2xl max-w-2xl w-full space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2 text-blue-600 font-bold">
                <Edit2 className="w-5 h-5" />
                <h3 className="text-base font-black text-neutral-900">
                  Modifier l'Ordre de Travail {editingOrder.refOT}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="p-1 text-neutral-400 hover:text-neutral-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-neutral-600 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
              <span className="font-bold text-neutral-800">Réf OT :</span>
              <span className="font-mono text-blue-700 font-bold">{editingOrder.refOT}</span>
              <span className="text-neutral-400">|</span>
              <span className="font-bold text-neutral-800">Réf IR source :</span>
              <span className="font-mono text-neutral-700">{editingOrder.refIR || 'Direct'}</span>
            </div>

            <form onSubmit={handleSaveEditOrder} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Date de l'OT
                  </label>
                  <input
                    type="date"
                    required
                    value={editOrderFormData.date}
                    onChange={(e) => setEditOrderFormData({ ...editOrderFormData, date: e.target.value })}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Catégorie
                  </label>
                  <select
                    value={editOrderFormData.category}
                    onChange={(e) => setEditOrderFormData({ ...editOrderFormData, category: e.target.value as MaintenanceCategory })}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Machine">Machine</option>
                    <option value="Mold">Moule (Mold)</option>
                    <option value="Other">Autre (Other)</option>
                  </select>
                </div>

                {editOrderFormData.category === 'Machine' && (
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                      Type de Maintenance
                    </label>
                    <select
                      value={editOrderFormData.maintenanceType}
                      onChange={(e) => setEditOrderFormData({ ...editOrderFormData, maintenanceType: e.target.value as 'Preventive' | 'Corrective' })}
                      className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                    >
                      <option value="Corrective">Corrective</option>
                      <option value="Preventive">Preventive</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Équipement concerné
                  </label>
                  <input
                    type="text"
                    required
                    value={editOrderFormData.equipmentName}
                    onChange={(e) => setEditOrderFormData({ ...editOrderFormData, equipmentName: e.target.value })}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Technicien assigné
                  </label>
                  <input
                    type="text"
                    required
                    value={editOrderFormData.assignedTo}
                    onChange={(e) => setEditOrderFormData({ ...editOrderFormData, assignedTo: e.target.value })}
                    placeholder="Nom du technicien"
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Priorité
                  </label>
                  <select
                    value={editOrderFormData.priority}
                    onChange={(e) => setEditOrderFormData({ ...editOrderFormData, priority: e.target.value as PriorityLevel })}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Statut global de l'OT
                  </label>
                  <select
                    value={editOrderFormData.status}
                    onChange={(e) => setEditOrderFormData({ ...editOrderFormData, status: e.target.value as OrderStatus })}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Waiting">Waiting (En attente pré-validations)</option>
                    <option value="In Progress">In Progress (En cours d'exécution)</option>
                    <option value="Waiting work validation">Waiting work validation (En attente signoff)</option>
                    <option value="Completed">Completed (Clôturé)</option>
                    <option value="Rejected">Rejected (Refusé)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Heures estimées (h)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={editOrderFormData.estimatedHours}
                    onChange={(e) => setEditOrderFormData({ ...editOrderFormData, estimatedHours: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Date programmée
                  </label>
                  <input
                    type="date"
                    value={editOrderFormData.scheduledDate}
                    onChange={(e) => setEditOrderFormData({ ...editOrderFormData, scheduledDate: e.target.value })}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Heure programmée
                  </label>
                  <input
                    type="time"
                    value={editOrderFormData.scheduledTime}
                    onChange={(e) => setEditOrderFormData({ ...editOrderFormData, scheduledTime: e.target.value })}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-800 uppercase mb-1">
                  Description des travaux à effectuer *
                </label>
                <textarea
                  required
                  rows={3}
                  value={editOrderFormData.description}
                  onChange={(e) => setEditOrderFormData({ ...editOrderFormData, description: e.target.value })}
                  className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-3 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
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
      {/* MODAL: ADMIN DELETE MAINTENANCE ORDER CONFIRMATION                        */}
      {/* ========================================================================= */}
      {deletingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-neutral-900 rounded-3xl p-6 sm:p-8 border border-neutral-300 shadow-2xl max-w-md w-full space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2 text-red-600 font-bold">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-base font-black text-neutral-900">
                  Supprimer l'Ordre de Travail {deletingOrder.refOT}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingOrder(null)}
                className="p-1 text-neutral-400 hover:text-neutral-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-neutral-600">
                Êtes-vous sûr de vouloir supprimer définitivement cet Ordre de Travail ? Cette action est irréversible.
              </p>

              <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 text-xs space-y-1.5 text-neutral-700">
                <div>
                  <span className="font-bold text-neutral-900">Réf OT : </span>
                  <span className="font-mono text-blue-700">{deletingOrder.refOT}</span>
                </div>
                {deletingOrder.refIR && (
                  <div>
                    <span className="font-bold text-neutral-900">DI associée : </span>
                    <span className="font-mono text-neutral-700">{deletingOrder.refIR}</span>
                  </div>
                )}
                <div>
                  <span className="font-bold text-neutral-900">Équipement : </span>
                  {deletingOrder.equipmentName}
                </div>
                <div>
                  <span className="font-bold text-neutral-900">Technicien : </span>
                  {deletingOrder.assignedTo}
                </div>
                <div>
                  <span className="font-bold text-neutral-900">Description : </span>
                  {deletingOrder.description}
                </div>
              </div>

              {deletingOrder.refIR && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    La suppression de cet OT débloquera la demande d'intervention associée ({deletingOrder.refIR}).
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingOrder(null)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteOrder}
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
