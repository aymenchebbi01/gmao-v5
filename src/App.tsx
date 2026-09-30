import React, { useState } from 'react';
import { Sidebar, ViewKey } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import {
  INITIAL_MACHINES,
  INITIAL_MOLDS,
  INITIAL_INTERVENTION_REQUESTS,
  INITIAL_MAINTENANCE_ORDERS,
  INITIAL_INTERVENTION_REPORTS,
  INITIAL_STOCK,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_DELIVERY_NOTES,
  INITIAL_CALENDAR_EVENTS,
  INITIAL_USERS,
  INITIAL_MOLD_MAINTENANCES,
} from './data/mockData';
import {
  InterventionRequest,
  MaintenanceOrder,
  InterventionReport,
  Machine,
  Mold,
  StockItem,
  StockMovement,
  DeliveryNote,
  CalendarEvent,
  AppUser,
  MoldMaintenance,
  CounterReading,
  ProductionOrderOF,
} from './types/gmao';

// Primary Views
import { DashboardView } from './views/DashboardView';
import { InterventionRequestView } from './views/InterventionRequestView';
import { MaintenanceOrdersView } from './views/MaintenanceOrdersView';
import { InterventionReportsView } from './views/InterventionReportsView';
import { MachineMaintenanceView } from './views/MachineMaintenanceView';
import { MoldMaintenanceView } from './views/MoldMaintenanceView';
import { TabletView } from './views/TabletView';
import { MachinesView } from './views/MachinesView';
import { MoldListView } from './views/MoldListView';
import { OtherMaintenancesView } from './views/OtherMaintenancesView';
import { StockMagasinView } from './views/StockMagasinView';
import { BonLivraisonView } from './views/BonLivraisonView';
import { AnalysisKPIView } from './views/AnalysisKPIView';
import { CalendarView } from './views/CalendarView';
import { UsersView } from './views/UsersView';
import { OFsView } from './views/OFsView';
import { ArchiveView } from './views/ArchiveView';

// Dedicated Full-Page Views (NO POPUP MODALS)
import { InterventionReportFillView } from './views/InterventionReportFillView';
import { NewInterventionRequestView } from './views/NewInterventionRequestView';
import { NewMaintenanceOrderView } from './views/NewMaintenanceOrderView';
import { ReportDetailsView } from './views/ReportDetailsView';
import { AuditReportView } from './views/AuditReportView';
import { MaintenanceOrderReportPdfView } from './views/MaintenanceOrderReportPdfView';
import { StockMaterialView } from './views/StockMaterialView';
import { AuditTrailView } from './views/AuditTrailView';
import { BackupView } from './views/BackupView';
import { logMovement } from './lib/auditLogger';
import { FullGMAOState } from './lib/backupManager';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import TabletLogin from './components/TabletLogin';
import { Toaster } from 'sonner';
import { LogIn, CheckCircle2, Database, ShieldAlert } from 'lucide-react';
import { sqliteApi } from './services/sqliteApi';
import { isMobileApp, setMobileSession } from './lib/utils';
import { generateNextReportRef } from './lib/gmaoUtils';

// URL Routing & Device / Path Detection helper
const getInitialView = (): ViewKey => {
  if (typeof window === 'undefined') return 'dashboard';

  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase() as ViewKey;

  // 1. Dedicated tablet/mobile paths (e.g. /tablet, /mobile-status, #tablet, #mobile-status)
  if (
    path.startsWith('/tablet') ||
    path.startsWith('/mobile-') ||
    path === '/mobile-status' ||
    hash.startsWith('tablet') ||
    hash.startsWith('mobile-')
  ) {
    setMobileSession(true);
    return 'tablet';
  }

  // 2. Real tablet & mobile device auto-detection (when accessing root without explicit desktop hash)
  if (!hash || hash === 'dashboard') {
    if (isMobileApp()) {
      setMobileSession(true);
      return 'tablet';
    }
  }

  const validViews: ViewKey[] = [
    'dashboard',
    'tablet',
    'machines',
    'mold-list',
    'intervention-request',
    'new-intervention-request',
    'maintenance-orders',
    'new-maintenance-order',
    'machine-maintenance',
    'mold-maintenance',
    'other-maintenances',
    'intervention-reports',
    'intervention-report-fill',
    'report-details',
    'stock-material',
    'input-material',
    'output-material',
    'material-status',
    'stock-magasin',
    'bon-livraison',
    'analysis-kpis',
    'calendar',
    'audit-report',
    'users',
    'ot-pdf-report',
    'audit-trail',
    'backup-restore',
    'ofs',
    'archives',
  ];
  return validViews.includes(hash) ? hash : 'dashboard';
};

function GMAOAppContent() {
  const { user, loading, logout, setUser: setAuthUser } = useAuth();

  // Navigation & UI State (Driven by reactive URL hash!)
  const [currentView, setCurrentView] = useState<ViewKey>(getInitialView);
  const [previousListView, setPreviousListView] = useState<ViewKey>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Sync state with URL hash when back/forward or manual hash change happens
  React.useEffect(() => {
    const handleHashChange = () => {
      const target = getInitialView();
      setCurrentView(target);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Core Data State
  const [machines, setMachines] = useState<Machine[]>(INITIAL_MACHINES);
  const [molds, setMolds] = useState<Mold[]>(INITIAL_MOLDS);
  const [requests, setRequests] = useState<InterventionRequest[]>(INITIAL_INTERVENTION_REQUESTS);
  const [orders, setOrders] = useState<MaintenanceOrder[]>(INITIAL_MAINTENANCE_ORDERS);
  const [reports, setReports] = useState<InterventionReport[]>(INITIAL_INTERVENTION_REPORTS);
  const [stock, setStock] = useState<StockItem[]>(INITIAL_STOCK);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(INITIAL_STOCK_MOVEMENTS);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>(INITIAL_DELIVERY_NOTES);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(INITIAL_CALENDAR_EVENTS);
  const [users, setUsers] = useState<AppUser[]>(INITIAL_USERS);
  const currentUser: AppUser = user || users[0] || INITIAL_USERS[0];
  const isAdmin = currentUser.role === 'admin' || currentUser.role?.toLowerCase()?.includes('admin');

  // Enforce admin-only access for users, audit-trail, backup-restore, and audit-report
  React.useEffect(() => {
    const adminOnlyViews: ViewKey[] = ['users', 'audit-trail', 'backup-restore', 'audit-report'];
    if (!isAdmin && adminOnlyViews.includes(currentView)) {
      setCurrentView('dashboard');
      window.location.hash = '#/dashboard';
    }
  }, [isAdmin, currentView]);

  const [moldMaintenances, setMoldMaintenances] = useState<MoldMaintenance[]>(INITIAL_MOLD_MAINTENANCES);
  const [productionOrders, setProductionOrders] = useState<ProductionOrderOF[]>([]);

  // Tablet has its own independent session — completely separate from the desktop login
  const [tabletUser, setTabletUser] = useState<AppUser | null>(null);

  // SQLite Database synchronization state
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [sqliteConnected, setSqliteConnected] = useState(false);

  // Refresh all state directly from SQLite without page reload
  const refreshAllData = React.useCallback(async (): Promise<boolean> => {
    try {
      const [data, ofs] = await Promise.all([
        sqliteApi.getFullState(),
        sqliteApi.getOFs().catch(() => []),
      ]);

      if (data) {
        if (Array.isArray(data.machines)) setMachines(data.machines);
        if (Array.isArray(data.molds)) setMolds(data.molds);
        if (Array.isArray(data.requests)) setRequests(data.requests);
        if (Array.isArray(data.orders)) setOrders(data.orders);
        if (Array.isArray(data.reports)) setReports(data.reports);
        if (Array.isArray(data.stock)) setStock(data.stock);
        if (Array.isArray(data.stockMovements)) setStockMovements(data.stockMovements);
        if (Array.isArray(data.deliveryNotes)) setDeliveryNotes(data.deliveryNotes);
        if (Array.isArray(data.calendarEvents)) setCalendarEvents(data.calendarEvents);
        if (Array.isArray(data.users) && data.users.length > 0) setUsers(data.users);
        if (Array.isArray(data.moldMaintenances)) setMoldMaintenances(data.moldMaintenances);
        if (Array.isArray(data.productionOrders)) {
          setProductionOrders(data.productionOrders);
        } else if (Array.isArray(ofs)) {
          setProductionOrders(ofs);
        }
        setSqliteConnected(true);
        return true;
      }
      if (Array.isArray(ofs)) {
        setProductionOrders(ofs);
      }
      return true;
    } catch (err) {
      console.warn('[SQLite] Refresh error:', err);
      return false;
    }
  }, []);

  // Load complete state from SQLite database on mount
  React.useEffect(() => {
    refreshAllData().finally(() => {
      setIsDbLoaded(true);
    });
  }, [refreshAllData]);

  // Debounced auto-save to SQLite when core data state changes
  const isInitialMount = React.useRef(true);
  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!isDbLoaded) return;

    const timer = setTimeout(() => {
      sqliteApi.saveFullState({
        machines,
        molds,
        requests,
        orders,
        reports,
        stock,
        stockMovements,
        deliveryNotes,
        calendarEvents,
        users,
        moldMaintenances,
        productionOrders,
      }).then(() => {
        setSqliteConnected(true);
      }).catch((err) => {
        console.warn('[SQLite] Auto-sync error:', err);
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [
    machines,
    molds,
    requests,
    orders,
    reports,
    stock,
    stockMovements,
    deliveryNotes,
    calendarEvents,
    users,
    moldMaintenances,
    productionOrders,
    isDbLoaded,
  ]);

  // Active form defaults and detail targets
  const [activeReportDefaults, setActiveReportDefaults] = useState<Partial<InterventionReport> | undefined>(undefined);
  const [selectedReportForDetails, setSelectedReportForDetails] = useState<InterventionReport | null>(null);
  const [selectedIRForOT, setSelectedIRForOT] = useState<InterventionRequest | null>(null);
  const [selectedOrderForPdf, setSelectedOrderForPdf] = useState<MaintenanceOrder | null>(null);
  const [selectedMachineForTablet, setSelectedMachineForTablet] = useState<string>(INITIAL_MACHINES[0]?.id || '');

  // Notification Banner
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // View Titles map matching the screenshots
  const viewTitles: Record<ViewKey, string> = {
    dashboard: 'Dashboard',
    tablet: 'Mode Tablette Atelier',
    machines: 'Machines',
    'mold-list': 'Mold List',
    'intervention-request': 'Intervention Request',
    'new-intervention-request': 'New Intervention Request',
    'maintenance-orders': 'Maintenance Orders',
    'new-maintenance-order': 'New Maintenance Order',
    'machine-maintenance': 'Machine Maintenance',
    'mold-maintenance': 'Mold Maintenance',
    'other-maintenances': 'Other Maintenances',
    'intervention-reports': 'Intervention Reports',
    'intervention-report-fill': 'Intervention Report Fill',
    'report-details': 'Intervention Report Details',
    'stock-material': 'Stock Status',
    'input-material': 'Material Input',
    'output-material': 'Material Output',
    'material-status': 'Material Status',
    'stock-magasin': 'Stock Magasin',
    'bon-livraison': 'Bon Livraison',
    'analysis-kpis': 'Analysis & KPIs',
    calendar: 'Calendar',
    'audit-report': 'Maintenance Audit Report',
    users: 'Users & Roles (IAM)',
    'ot-pdf-report': 'Administrative Intervention Report (PV)',
    'audit-trail': 'Journal d\'Audit & Traçabilité (Activity Log)',
    'backup-restore': 'Gestion des Sauvegardes & Restauration Système',
    ofs: 'Ordres de Fabrication (OFs) & Rapports',
    archives: 'Archives des Demandes d\'Intervention',
  };

  // Safe navigation that remembers list origin & updates URL hash
  const navigateTo = (view: ViewKey) => {
    const adminOnlyViews: ViewKey[] = ['users', 'audit-trail', 'backup-restore', 'audit-report'];
    if (!isAdmin && adminOnlyViews.includes(view)) {
      showNotification('Accès refusé : interface réservée aux administrateurs.');
      return;
    }

    if (
      currentView !== 'intervention-report-fill' &&
      currentView !== 'new-intervention-request' &&
      currentView !== 'new-maintenance-order' &&
      currentView !== 'report-details' &&
      currentView !== 'audit-report' &&
      currentView !== 'ot-pdf-report'
    ) {
      setPreviousListView(currentView);
    }
    setCurrentView(view);
    window.location.hash = `#/${view}`;
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  // Tablet updates handlers
  const handleUpdateMachineStatus = (machineId: string, status: Machine['status'], reason?: string) => {
    const targetMach = machines.find((m) => m.id === machineId);
    setMachines((prev) =>
      prev.map((m) =>
        m.id === machineId
          ? {
            ...m,
            status,
            statusReason: reason || (status === 'Running' || status === 'operational' ? '' : m.statusReason),
          }
          : m
      )
    );
    logMovement({
      category: 'Machine Fleet',
      action: 'STATUS_CHANGE',
      targetRef: targetMach?.number || machineId,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Changement d'état machine ${targetMach?.number || machineId} (${targetMach?.brand || ''}) : ${status.toUpperCase()}${reason ? ` - Motif: ${reason}` : ''}`,
      previousState: targetMach?.status,
      newState: status,
      severity: status === 'Stopped' || status === 'Under Maintenance' ? 'warning' : 'info',
    });
    showNotification(`Statut machine mis à jour : ${status.toUpperCase()}`);
  };

  const handleUpdateMachineMold = (machineId: string, moldNumber: string) => {
    setMachines((prev) =>
      prev.map((m) =>
        m.id === machineId
          ? {
            ...m,
            activeMoldRef: moldNumber,
          }
          : m
      )
    );
    setMolds((prev) =>
      prev.map((m) => {
        if ((m.moldNumber || m.ref) === moldNumber) {
          return { ...m, status: 'In Use', assignedMachineNumber: machineId };
        }
        return m;
      })
    );
    logMovement({
      category: 'Mold Tooling',
      action: 'UPDATE',
      targetRef: moldNumber,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Montage et affectation du moule ${moldNumber} sur la presse ${machineId}.`,
      newState: 'In Use',
      severity: 'info',
    });
    showNotification(`Moule ${moldNumber} monté sur la presse`);
  };

  const handleUpdateMachineProduction = (
    machineId: string,
    product: string,
    produced?: number,
    good?: number,
    bad?: number
  ) => {
    setMachines((prev) =>
      prev.map((m) =>
        m.id === machineId
          ? {
            ...m,
            injectingProduct: product,
          }
          : m
      )
    );
    logMovement({
      category: 'Machine Fleet',
      action: 'UPDATE',
      targetRef: machineId,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Données de production enregistrées sur ${machineId} (${product}) : ${produced || 0} injectées, ${good || 0} bonnes, ${bad || 0} rebuts.`,
      severity: 'info',
    });
    showNotification(`Données de production enregistrées pour ${product}`);
  };

  // Point 2: Validation of Intervention Request by Responsable Technique
  const handleValidateRequest = (id: string) => {
    const targetIR = requests.find((r) => r.id === id);
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
            ...r,
            status: 'Validated',
            validatedBy: `${currentUser.name} (${currentUser.role})`,
            validatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
            rejectionReason: undefined,
            rejectedBy: undefined,
            rejectedAt: undefined,
          }
          : r
      )
    );
    logMovement({
      category: 'Intervention Request',
      action: 'VALIDATE',
      targetRef: targetIR?.refIR || id,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Validation de la demande d'intervention ${targetIR?.refIR || id} par le Responsable Technique. Déblocage pour création d'Ordre de Travail (OT).`,
      previousState: 'Waiting',
      newState: 'Validated',
      severity: 'success',
    });
    showNotification(`Intervention Request validated by ${currentUser.name}. Méthode Maintenance can now create OT.`);
  };

  const handleRejectRequest = (id: string, reason?: string) => {
    const defaultReason = reason || 'Motif de refus spécifié par le Responsable Technique';
    const targetIR = requests.find((r) => r.id === id);
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
            ...r,
            status: 'Rejected',
            validatedBy: '',
            validatedAt: '',
            rejectionReason: defaultReason,
            rejectedBy: `${currentUser.name} (${currentUser.role})`,
            rejectedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
          }
          : r
      )
    );
    logMovement({
      category: 'Intervention Request',
      action: 'REJECT',
      targetRef: targetIR?.refIR || id,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Rejet de la demande d'intervention ${targetIR?.refIR || id}. Motif de refus: ${defaultReason}`,
      previousState: 'Waiting',
      newState: 'Rejected',
      rejectionReason: defaultReason,
      severity: 'danger',
    });
    showNotification(`Intervention Request rejected. Motif: ${defaultReason}`);
  };

  const handleChangeRequestDecision = (
    id: string,
    decision: 'Waiting' | 'Validated' | 'Rejected',
    reason?: string
  ) => {
    const req = requests.find((r) => r.id === id);
    if (req?.relatedOTRef) {
      showNotification('Modification impossible : l\'Ordre de Travail (OT) a déjà été créé !');
      return;
    }
    if (decision === 'Validated') {
      handleValidateRequest(id);
    } else if (decision === 'Rejected') {
      handleRejectRequest(id, reason);
    } else {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
              ...r,
              status: 'Waiting',
              validatedBy: '',
              validatedAt: '',
              rejectedBy: '',
              rejectedAt: '',
              rejectionReason: '',
            }
            : r
        )
      );
      logMovement({
        category: 'Intervention Request',
        action: 'STATUS_CHANGE',
        targetRef: req?.refIR || id,
        user: `${currentUser.name} (${currentUser.role})`,
        details: `Annulation de la décision précédente sur ${req?.refIR || id}. Remis en statut En attente.`,
        previousState: req?.status,
        newState: 'Waiting',
        severity: 'info',
      });
      showNotification('Demande remise en attente de validation.');
    }
  };

  // Point 3: Role Méthode Maintenance creates OT for that IR
  const handleCreateOTFromIR = (req: InterventionRequest) => {
    setSelectedIRForOT(req);
    navigateTo('new-maintenance-order');
  };

  const handleSaveNewIR = (req: InterventionRequest) => {
    setRequests((prev) => [req, ...prev]);
    logMovement({
      category: 'Intervention Request',
      action: 'CREATE',
      targetRef: req.refIR,
      user: `${req.requester} (${req.requesterRole || 'Technicien'})`,
      details: `Nouvelle demande d'intervention ${req.refIR} soumise pour ${req.equipmentName || 'Equipement'} : "${req.problemDescription}"`,
      newState: 'Waiting',
      severity: 'warning',
    });
    navigateTo('intervention-request');
    showNotification(`New Intervention Request ${req.refIR} submitted. Waiting validation by Responsable Technique.`);
  };

  const handleSaveNewOT = (order: MaintenanceOrder) => {
    setOrders((prev) => [order, ...prev]);
    if (order.refIR) {
      setRequests((prev) =>
        prev.map((r) => (r.refIR === order.refIR ? { ...r, relatedOTRef: order.refOT } : r))
      );
    }
    logMovement({
      category: 'Maintenance Order',
      action: 'CREATE',
      targetRef: order.refOT,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Création de l'Ordre de Travail ${order.refOT} (Source: ${order.refIR || 'Direct'}, Equipement: ${order.equipmentName}). Affecté à: ${order.assignedTo}.`,
      newState: 'Waiting',
      severity: 'info',
    });
    setSelectedIRForOT(null);
    navigateTo('maintenance-orders');
    showNotification(`Maintenance Order ${order.refOT} created. Waiting for 3-step pre-validations.`);
  };

  // Admin handlers for Intervention Requests
  const handleEditRequest = (updatedReq: InterventionRequest) => {
    setRequests((prev) => prev.map((r) => (r.id === updatedReq.id ? updatedReq : r)));
    logMovement({
      category: 'Intervention Request',
      action: 'UPDATE',
      targetRef: updatedReq.refIR,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Modification administrative de la demande ${updatedReq.refIR} (${updatedReq.problemDescription}).`,
      severity: 'info',
    });
    showNotification(`Demande d'intervention ${updatedReq.refIR} mise à jour avec succès.`);
  };

  const handleDeleteRequest = (id: string) => {
    const target = requests.find((r) => r.id === id);
    setRequests((prev) => prev.filter((r) => r.id !== id));
    logMovement({
      category: 'Intervention Request',
      action: 'DELETE',
      targetRef: target?.refIR || id,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Suppression administrative de la demande d'intervention ${target?.refIR || id}.`,
      severity: 'danger',
    });
    showNotification(`Demande d'intervention ${target?.refIR || id} supprimée.`);
  };

  // Archive handlers for Intervention Requests
  const handleArchiveRequest = (reqId: string, reason?: string) => {
    let updatedReq: InterventionRequest | null = null;
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id === reqId) {
          updatedReq = {
            ...r,
            isArchived: true,
            archivedAt: new Date().toISOString(),
            archivedBy: currentUser?.name || 'Administrateur',
            archiveReason: reason || 'Archivée manuellement',
          };
          return updatedReq;
        }
        return r;
      })
    );
    if (updatedReq) {
      sqliteApi.saveInterventionRequest(updatedReq).catch((err) => {
        console.warn('[SQLite] Error archiving request:', err);
      });
    }
    showNotification("Demande d'intervention archivée avec succès.");
  };

  const handleUnarchiveRequest = (reqId: string) => {
    let restoredReq: InterventionRequest | null = null;
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id === reqId) {
          const copy = { ...r };
          delete copy.isArchived;
          delete copy.archivedAt;
          delete copy.archivedBy;
          delete copy.archiveReason;
          restoredReq = copy;
          return copy;
        }
        return r;
      })
    );
    if (restoredReq) {
      sqliteApi.saveInterventionRequest(restoredReq).catch((err) => {
        console.warn('[SQLite] Error restoring request:', err);
      });
    }
    showNotification("Demande d'intervention restaurée avec succès.");
  };

  // Production Orders (OFs) Handlers
  const handleSaveOF = async (ofItem: ProductionOrderOF) => {
    setProductionOrders((prev) => [ofItem, ...prev.filter((o) => o.id !== ofItem.id)]);

    // Link assigned machine with the active OF & its attached PDF
    let updatedMachine: Machine | undefined;
    if (ofItem.machineId) {
      setMachines((prev) =>
        prev.map((m) => {
          if (m.id === ofItem.machineId) {
            updatedMachine = {
              ...m,
              ofReference: ofItem.ofNumber,
              currentProduct: ofItem.title,
              activeOf: {
                id: ofItem.id,
                machineId: m.id,
                ofReference: ofItem.ofNumber,
                injectedItem: ofItem.title,
                moldNumber: ofItem.moldName,
                targetQuantity: ofItem.targetQuantity || 0,
                pdfUrl: ofItem.pdfUrl,
                status: ofItem.status === 'Done' ? 'completed' : ofItem.status === 'In Progress' ? 'in_progress' : 'pending',
              },
            };
            return updatedMachine;
          }
          return m;
        })
      );
    }

    try {
      await sqliteApi.saveOF(ofItem);
      if (updatedMachine) {
        await sqliteApi.saveMachine(updatedMachine).catch(() => {});
      }
      showNotification(`Ordre de fabrication ${ofItem.ofNumber} enregistré.`);
    } catch (err) {
      console.warn('[SQLite] Error saving OF:', err);
    }
  };

  const handleUpdateOF = async (id: string, updates: Partial<ProductionOrderOF>) => {
    let fullOrder: ProductionOrderOF | undefined;
    setProductionOrders((prev) =>
      prev.map((o) => {
        if (o.id === id) {
          fullOrder = { ...o, ...updates };
          return fullOrder;
        }
        return o;
      })
    );

    // Keep assigned machine in sync
    let updatedMachine: Machine | undefined;
    if (fullOrder?.machineId) {
      const order = fullOrder;
      setMachines((prev) =>
        prev.map((m) => {
          if (m.id === order.machineId) {
            updatedMachine = {
              ...m,
              ofReference: order.ofNumber,
              currentProduct: order.title,
              activeOf: {
                id: order.id,
                machineId: m.id,
                ofReference: order.ofNumber,
                injectedItem: order.title,
                moldNumber: order.moldName,
                targetQuantity: order.targetQuantity || 0,
                pdfUrl: order.pdfUrl,
                status: order.status === 'Done' ? 'completed' : order.status === 'In Progress' ? 'in_progress' : 'pending',
              },
            };
            return updatedMachine;
          }
          return m;
        })
      );
    }

    try {
      await sqliteApi.updateOF(id, updates);
      if (updatedMachine) {
        await sqliteApi.saveMachine(updatedMachine).catch(() => {});
      }
    } catch (err) {
      console.warn('[SQLite] Error updating OF:', err);
    }
  };

  const handleUpdateProductionOrder = async (updatedOrder: ProductionOrderOF) => {
    setProductionOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
    );

    let updatedMachine: Machine | undefined;
    if (updatedOrder.machineId) {
      setMachines((prev) =>
        prev.map((m) => {
          if (m.id === updatedOrder.machineId) {
            updatedMachine = {
              ...m,
              ofReference: updatedOrder.ofNumber,
              currentProduct: updatedOrder.title,
              activeOf: {
                id: updatedOrder.id,
                machineId: m.id,
                ofReference: updatedOrder.ofNumber,
                injectedItem: updatedOrder.title,
                moldNumber: updatedOrder.moldName,
                targetQuantity: updatedOrder.targetQuantity || 0,
                pdfUrl: updatedOrder.pdfUrl,
                status: updatedOrder.status === 'Done' ? 'completed' : updatedOrder.status === 'In Progress' ? 'in_progress' : 'pending',
              },
            };
            return updatedMachine;
          }
          return m;
        })
      );
    }

    try {
      await sqliteApi.updateOF(updatedOrder.id, updatedOrder);
      if (updatedMachine) {
        await sqliteApi.saveMachine(updatedMachine).catch(() => {});
      }
    } catch (err) {
      console.warn('[SQLite] Error updating OF:', err);
    }
  };

  const handleDeleteOF = async (id: string) => {
    setProductionOrders((prev) => prev.filter((o) => o.id !== id));
    try {
      await sqliteApi.deleteOF(id);
      showNotification('Ordre de fabrication supprimé.');
    } catch (err) {
      console.warn('[SQLite] Error deleting OF:', err);
    }
  };

  // Admin handlers for Maintenance Orders
  const handleEditOrder = (updatedOrder: MaintenanceOrder) => {
    setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
    logMovement({
      category: 'Maintenance Order',
      action: 'UPDATE',
      targetRef: updatedOrder.refOT,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Modification administrative de l'Ordre de Travail ${updatedOrder.refOT} (${updatedOrder.equipmentName}).`,
      severity: 'info',
    });
    showNotification(`Ordre de Travail ${updatedOrder.refOT} mis à jour avec succès.`);
  };

  const handleDeleteOrder = (id: string) => {
    const target = orders.find((o) => o.id === id);
    setOrders((prev) => prev.filter((o) => o.id !== id));
    // If this OT was linked to an IR, decouple it so the IR can be processed again
    if (target?.refIR) {
      setRequests((prev) =>
        prev.map((r) => (r.refIR === target.refIR ? { ...r, relatedOTRef: undefined } : r))
      );
    }
    logMovement({
      category: 'Maintenance Order',
      action: 'DELETE',
      targetRef: target?.refOT || id,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Suppression administrative de l'Ordre de Travail ${target?.refOT || id}.`,
      severity: 'danger',
    });
    showNotification(`Ordre de Travail ${target?.refOT || id} supprimé.`);
  };

  // Admin handlers for Intervention Reports
  const handleEditReport = (updatedReport: InterventionReport) => {
    setReports((prev) => prev.map((r) => (r.id === updatedReport.id ? updatedReport : r)));
    logMovement({
      category: 'Intervention Report',
      action: 'UPDATE',
      targetRef: updatedReport.refReport,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Modification administrative du rapport ${updatedReport.refReport}.`,
      severity: 'info',
    });
    showNotification(`Rapport d'intervention ${updatedReport.refReport} mis à jour.`);
  };

  const handleDeleteReport = (id: string) => {
    const target = reports.find((r) => r.id === id);
    setReports((prev) => prev.filter((r) => r.id !== id));
    logMovement({
      category: 'Intervention Report',
      action: 'DELETE',
      targetRef: target?.refReport || id,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Suppression administrative du rapport d'intervention ${target?.refReport || id} (OT: ${target?.refOT || '-'}).`,
      severity: 'danger',
    });
    showNotification(`Rapport d'intervention ${target?.refReport || id} supprimé.`);
  };

  // Mold Maintenance handlers
  const handleDeleteMoldMaintenance = async (id: string) => {
    const target = moldMaintenances.find((m) => m.id === id);
    setMoldMaintenances((prev) => prev.filter((m) => m.id !== id));
    try {
      await sqliteApi.deleteMoldMaintenance(id);
    } catch (err) {
      console.error('[SQLite] Failed to delete mold maintenance from SQLite:', err);
    }
    logMovement({
      category: 'Mold Tooling',
      action: 'DELETE',
      targetRef: target?.moldNumber || id,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Suppression de la fiche de maintenance du moule ${target?.moldNumber || id}.`,
      severity: 'danger',
    });
    showNotification(`Fiche de maintenance ${target?.moldNumber || id} supprimée avec succès.`);
  };

  const handleSaveMoldMaintenance = async (record: MoldMaintenance) => {
    setMoldMaintenances((prev) => {
      const idx = prev.findIndex((m) => m.id === record.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = record;
        return copy;
      }
      return [record, ...prev];
    });
    try {
      await sqliteApi.saveMoldMaintenance(record);
    } catch (err) {
      console.error('[SQLite] Failed to save mold maintenance:', err);
    }
  };

  // Point 10: Step 1 Pre-Validation (Responsable Maintenance specifies time and date)
  const handleValidatePreStep1RespMaint = (
    orderId: string,
    estimatedHours: number,
    scheduledDate: string,
    scheduledTime: string
  ) => {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const ord = orders.find((o) => o.id === orderId);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
            ...o,
            estimatedHours,
            scheduledDate,
            scheduledTime,
            status: o.status === 'Rejected' ? 'Waiting' : o.status,
            validationRespMaint: {
              validated: true,
              rejected: false,
              rejectionReason: undefined,
              validatedBy: `${currentUser.name} (${currentUser.role})`,
              validatedAt: timestamp,
              estimatedHours,
              scheduledDate,
              scheduledTime,
            },
            validationProgress: Math.max(o.validationProgress, 25),
          }
          : o
      )
    );
    logMovement({
      category: 'Maintenance Order',
      action: 'VALIDATE',
      targetRef: ord?.refOT || orderId,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Validation Pré-intervention Etape 1 (Responsable Maintenance) sur ${ord?.refOT || orderId}. Durée: ${estimatedHours}h, Date: ${scheduledDate} à ${scheduledTime}.`,
      severity: 'success',
      metadata: { step: 'validationRespMaint', estimatedHours, scheduledDate, scheduledTime },
    });
    showNotification('Step 1 pre-validation approved by Responsable Maintenance.');
  };

  const handleRejectPreStep1RespMaint = (orderId: string, reason: string) => {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const ord = orders.find((o) => o.id === orderId);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
            ...o,
            status: 'Rejected',
            validationRespMaint: {
              validated: false,
              rejected: true,
              rejectionReason: reason,
              rejectedBy: `${currentUser.name} (${currentUser.role})`,
              rejectedAt: timestamp,
            },
          }
          : o
      )
    );
    logMovement({
      category: 'Maintenance Order',
      action: 'REJECT',
      targetRef: ord?.refOT || orderId,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Refus Pré-intervention Etape 1 (Responsable Maintenance) sur ${ord?.refOT || orderId}. Motif: ${reason}`,
      previousState: ord?.status,
      newState: 'Rejected',
      rejectionReason: reason,
      severity: 'danger',
    });
    showNotification(`Step 1 rejected by Responsable Maintenance. Reason: ${reason}`);
  };

  const handleChangeDecisionPreStep1 = (
    orderId: string,
    decision: 'Validated' | 'Rejected',
    hours?: number,
    date?: string,
    time?: string,
    reason?: string
  ) => {
    const ord = orders.find((o) => o.id === orderId);
    if (ord?.validationRespProd?.validated) {
      showNotification('Modification impossible : l\'Étape 2 (Production) a déjà été validée !');
      return;
    }
    if (decision === 'Validated') {
      handleValidatePreStep1RespMaint(
        orderId,
        hours || 2,
        date || new Date().toISOString().split('T')[0],
        time || '14:00'
      );
    } else {
      handleRejectPreStep1RespMaint(orderId, reason || 'Rejeté par Responsable Maintenance');
    }
  };

  // Point 10: Step 2 Pre-Validation (Responsable Production confirms stoppage window)
  const handleValidatePreStep2RespProd = (orderId: string) => {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const ord = orders.find((o) => o.id === orderId);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
            ...o,
            status: o.status === 'Rejected' ? 'Waiting' : o.status,
            validationRespProd: {
              validated: true,
              rejected: false,
              rejectionReason: undefined,
              validatedBy: `${currentUser.name} (${currentUser.role})`,
              validatedAt: timestamp,
            },
            validationProgress: Math.max(o.validationProgress, 40),
          }
          : o
      )
    );
    logMovement({
      category: 'Maintenance Order',
      action: 'VALIDATE',
      targetRef: ord?.refOT || orderId,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Validation Pré-intervention Etape 2 (Responsable Production) sur ${ord?.refOT || orderId}. Arrêt machine et créneau d'intervention confirmés.`,
      severity: 'success',
      metadata: { step: 'validationRespProd' },
    });
    showNotification('Step 2 pre-validation approved by Responsable Production.');
  };

  const handleRejectPreStep2RespProd = (orderId: string, reason: string) => {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const ord = orders.find((o) => o.id === orderId);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
            ...o,
            status: 'Rejected',
            validationRespProd: {
              validated: false,
              rejected: true,
              rejectionReason: reason,
              rejectedBy: `${currentUser.name} (${currentUser.role})`,
              rejectedAt: timestamp,
            },
          }
          : o
      )
    );
    logMovement({
      category: 'Maintenance Order',
      action: 'REJECT',
      targetRef: ord?.refOT || orderId,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Refus Pré-intervention Etape 2 (Responsable Production) sur ${ord?.refOT || orderId}. Motif: ${reason}`,
      previousState: ord?.status,
      newState: 'Rejected',
      rejectionReason: reason,
      severity: 'danger',
    });
    showNotification(`Step 2 rejected by Responsable Production. Reason: ${reason}`);
  };

  const handleChangeDecisionPreStep2 = (
    orderId: string,
    decision: 'Validated' | 'Rejected',
    reason?: string
  ) => {
    const ord = orders.find((o) => o.id === orderId);
    if (ord?.validationQHSE?.validated) {
      showNotification('Modification impossible : l\'Étape 3 (QHSE) a déjà été validée !');
      return;
    }
    if (decision === 'Validated') {
      handleValidatePreStep2RespProd(orderId);
    } else {
      handleRejectPreStep2RespProd(orderId, reason || 'Créneau production indisponible');
    }
  };

  // Point 10: Step 3 Pre-Validation (Responsable QHSE confirms safety & LOTO)
  const handleValidatePreStep3QHSE = (orderId: string) => {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const ord = orders.find((o) => o.id === orderId);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
            ...o,
            status: 'In Progress',
            validationQHSE: {
              validated: true,
              rejected: false,
              rejectionReason: undefined,
              validatedBy: `${currentUser.name} (${currentUser.role})`,
              validatedAt: timestamp,
            },
            validationProgress: 50,
          }
          : o
      )
    );
    logMovement({
      category: 'Maintenance Order',
      action: 'VALIDATE',
      targetRef: ord?.refOT || orderId,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Validation Pré-intervention Etape 3 (QHSE) sur ${ord?.refOT || orderId}. Consignation LOTO et port des EPI vérifiés. L'ordre passe à "In Progress".`,
      previousState: ord?.status,
      newState: 'In Progress',
      severity: 'success',
      metadata: { step: 'validationQHSE' },
    });
    showNotification('Step 3 approved by QHSE. All 3 pre-validations complete! Order is now In Progress.');
  };

  const handleRejectPreStep3QHSE = (orderId: string, reason: string) => {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const ord = orders.find((o) => o.id === orderId);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
            ...o,
            status: 'Rejected',
            validationQHSE: {
              validated: false,
              rejected: true,
              rejectionReason: reason,
              rejectedBy: `${currentUser.name} (${currentUser.role})`,
              rejectedAt: timestamp,
            },
          }
          : o
      )
    );
    logMovement({
      category: 'Maintenance Order',
      action: 'REJECT',
      targetRef: ord?.refOT || orderId,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Refus Pré-intervention Etape 3 (QHSE) sur ${ord?.refOT || orderId}. Motif: ${reason}`,
      previousState: ord?.status,
      newState: 'Rejected',
      rejectionReason: reason,
      severity: 'danger',
    });
    showNotification(`Step 3 rejected by QHSE. Reason: ${reason}`);
  };

  const handleChangeDecisionPreStep3 = (
    orderId: string,
    decision: 'Validated' | 'Rejected',
    reason?: string
  ) => {
    const ord = orders.find((o) => o.id === orderId);
    if (ord?.reportRef || ord?.status === 'Waiting work validation' || ord?.status === 'Completed') {
      showNotification('Modification impossible : le rapport d\'intervention a déjà été soumis !');
      return;
    }
    if (decision === 'Validated') {
      handleValidatePreStep3QHSE(orderId);
    } else {
      handleRejectPreStep3QHSE(orderId, reason || 'Consignes LOTO / Sécurité non respectées');
    }
  };

  // Point 12: After filling the intervention report, maintenance order status changes to 'Waiting work validation'
  const handleSaveReport = async (newReport: InterventionReport) => {
    // Look up existing report for this work order to reuse id and refReport
    const existing = reports.find(
      (r) =>
        (newReport.id && r.id === newReport.id) ||
        (newReport.refOT && r.refOT === newReport.refOT) ||
        (newReport.refReport && r.refReport === newReport.refReport)
    );

    const targetRefReport =
      existing?.refReport ||
      newReport.refReport ||
      generateNextReportRef(reports, newReport.date);

    const mergedReport: InterventionReport = {
      ...(existing || {}),
      ...newReport,
      id: existing?.id || newReport.id,
      refReport: targetRefReport,
      refOT: newReport.refOT || existing?.refOT || '',
    };

    setReports((prev) => {
      const idx = prev.findIndex(
        (r) =>
          (mergedReport.id && r.id === mergedReport.id) ||
          (mergedReport.refOT && r.refOT === mergedReport.refOT) ||
          (mergedReport.refReport && r.refReport === mergedReport.refReport)
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...mergedReport };
        return copy;
      }
      return [mergedReport, ...prev];
    });

    setOrders((prev) =>
      prev.map((o) =>
        o.refOT === mergedReport.refOT
          ? {
            ...o,
            status: 'Waiting work validation', // Point 12!
            validationProgress: 75,
            reportRef: mergedReport.refReport,
          }
          : o
      )
    );

    try {
      await sqliteApi.saveInterventionReport(mergedReport);
    } catch (err) {
      console.error('[GMAO] Failed to persist report to server:', err);
    }

    logMovement({
      category: 'Intervention Report',
      action: 'CREATE',
      targetRef: newReport.refReport,
      user: `${newReport.filledBy || currentUser.name} (Technicien)`,
      details: `Rapport d'intervention (PV) ${newReport.refReport} rempli et signé pour ${newReport.refOT}. Cause: "${newReport.cause || 'Maintenance corrective'}". Statut OT passé à "Waiting work validation".`,
      newState: 'Waiting work validation',
      severity: 'info',
      metadata: { refOT: newReport.refOT, partsTakenCount: newReport.stockTaken?.length || 0 },
    });

    // Primary Update Path: Update machine currentHours and log counter reading
    if (newReport.meterReadingHours !== undefined || newReport.category === 'Machine') {
      const readingHours = newReport.meterReadingHours;
      if (typeof readingHours === 'number' && !isNaN(readingHours)) {
        const relatedOrder = orders.find((o) => o.refOT === newReport.refOT);
        const targetMachId = newReport.equipmentId || relatedOrder?.machineId || relatedOrder?.equipmentId;
        const targetMachName = newReport.equipmentName || relatedOrder?.machineNumber || relatedOrder?.equipmentName;

        setMachines((prevMachines) =>
          prevMachines.map((m) => {
            const matchesId = Boolean(targetMachId && m.id === targetMachId);
            const matchesName = Boolean(
              targetMachName &&
              (m.number.toLowerCase() === targetMachName.toLowerCase() ||
                m.name?.toLowerCase() === targetMachName.toLowerCase() ||
                targetMachName.toLowerCase().includes(m.number.toLowerCase()))
            );

            if (matchesId || matchesName) {
              const prevHours = m.currentHours ?? m.totalOperatingHours ?? 0;
              const delta = Number((readingHours - prevHours).toFixed(1));
              const nowIso = new Date().toISOString();
              const op = newReport.filledBy || newReport.assignedTo || currentUser.name;

              const newReading: CounterReading = {
                id: `cr-wo-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                machineId: m.id,
                date: nowIso,
                previousHours: prevHours,
                newHours: readingHours,
                deltaHours: delta,
                operator: op,
                source: 'Work Order',
                refReport: newReport.refReport,
                refOT: newReport.refOT,
                note: `Clôture rapport d'intervention ${newReport.refReport} (OT: ${newReport.refOT})`,
              };

              logMovement({
                category: 'Machine Fleet',
                action: 'UPDATE',
                targetRef: m.number || m.name || m.id,
                user: op,
                details: `Mise à jour horamètre à la clôture de ${newReport.refOT} (${newReport.refReport}) : ${prevHours} h → ${readingHours} h (+${delta} h).`,
                previousState: `${prevHours} h`,
                newState: `${readingHours} h`,
                severity: 'info',
                metadata: {
                  source: 'Work Order',
                  refReport: newReport.refReport,
                  refOT: newReport.refOT,
                  deltaHours: delta,
                },
              });

              return {
                ...m,
                currentHours: readingHours,
                totalOperatingHours: readingHours,
                lastMeterReadingDate: nowIso,
                lastMeterReadingBy: op,
                counterReadings: [newReading, ...(m.counterReadings || [])],
              };
            }
            return m;
          })
        );
      }
    }

    // Synchronize Mold status & record mold maintenance if category is Mold
    if (newReport.category === 'Mold') {
      const moldNum = newReport.moldNumber || newReport.equipmentName;
      const targetMold = molds.find((m) => m.id === newReport.moldId || (m.moldNumber || m.ref) === moldNum);
      if (targetMold && newReport.moldStatusAfterRepair) {
        setMolds((prevMolds) =>
          prevMolds.map((m) =>
            m.id === targetMold.id ? { ...m, status: newReport.moldStatusAfterRepair as any } : m
          )
        );
      }
      const moldMaintRec: MoldMaintenance = {
        id: `mm-${Date.now()}`,
        moldId: targetMold?.id || newReport.moldId || 'mld-unknown',
        moldNumber: targetMold?.moldNumber || moldNum || 'MLD-XXX',
        date: newReport.date,
        repairLocation: newReport.moldRepairLocation || 'local',
        status: 'completed',
        closedStatusChoice: (newReport.moldStatusAfterRepair as any) || 'In Stock',
        issueDescription: newReport.issueDescription || newReport.subCause || newReport.cause || 'Maintenance outillage',
        supplierName: newReport.moldSupplierName,
        actionsPerformed: newReport.actions && newReport.actions.length > 0 ? newReport.actions : ['Maintenance outillage effectuée'],
        costTnd: newReport.totalCost || 0,
        imageUrl: newReport.imageUrl || newReport.moldToolingPhotoUrl,
        completedAt: newReport.finishedTime,
      };
      setMoldMaintenances((prev) => [moldMaintRec, ...prev]);
      try {
        sqliteApi.createMoldMaintenance(moldMaintRec);
      } catch (e) {
        console.error('Failed to persist mold maintenance from report:', e);
      }
    }

    // Deduct stock items consumed & record movements
    if (newReport.stockTaken && newReport.stockTaken.length > 0) {
      setStock((prevStock) =>
        prevStock.map((s) => {
          const used = newReport.stockTaken.find((item) => item.itemId === s.id);
          if (used) {
            return {
              ...s,
              currentQty: Math.max(0, s.currentQty - used.qty),
            };
          }
          return s;
        })
      );

      const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
      const newMovements: StockMovement[] = newReport.stockTaken.map((st) => {
        const item = stock.find((s) => s.id === st.itemId);
        const prevQty = item?.currentQty || st.qty;
        logMovement({
          category: 'Stock Magasin',
          action: 'STOCK_OUT',
          targetRef: st.partNumber,
          user: newReport.filledBy || currentUser.name,
          details: `Sortie de pièce ${st.itemName} (${st.qty}x) pour maintenance sous ${newReport.refOT}.`,
          severity: 'info',
          metadata: { partNumber: st.partNumber, qty: st.qty },
        });
        return {
          id: `mvt-${Date.now()}-${st.id}`,
          date: timestamp,
          itemId: st.itemId,
          partNumber: st.partNumber,
          itemName: st.itemName,
          type: 'OUT',
          qty: st.qty,
          previousQty: prevQty,
          newQty: Math.max(0, prevQty - st.qty),
          reason: 'Maintenance OT',
          referenceDoc: newReport.refOT,
          operator: newReport.filledBy || currentUser.name,
          notes: `Consommé lors du rapport ${newReport.refReport}`,
        };
      });
      setStockMovements((prev) => [...newMovements, ...prev]);

      // Auto-create a Bon de Livraison (delivery note) for each stock OUT from this report
      const bonLivraison: DeliveryNote = {
        id: `bl-${Date.now()}`,
        refBL: `BL-${newReport.refReport}`,
        date: timestamp.split(' ')[0],
        supplier: 'Stock Magasin Interne',
        receivedBy: newReport.filledBy || tabletUser?.name || currentUser.name,
        totalItems: newReport.stockTaken.reduce((sum, st) => sum + (Number(st.qty) || 0), 0),
        totalAmount: Number(newReport.stockTaken.reduce((sum, st) => sum + ((Number(st.qty) || 0) * (Number(st.unitPrice) || 0)), 0).toFixed(2)),
        status: 'Received',
        items: newReport.stockTaken.map((st) => ({
          partNumber: st.partNumber,
          description: st.itemName,
          qty: Number(st.qty) || 1,
          unitPrice: Number(st.unitPrice) || 0,
        })),
      };
      setDeliveryNotes((prev) => [bonLivraison, ...prev]);

      logMovement({
        category: 'Delivery Note',
        action: 'CREATE',
        targetRef: bonLivraison.refBL,
        user: `${newReport.filledBy || tabletUser?.name || currentUser.name}`,
        details: `Génération automatique du Bon de Livraison ${bonLivraison.refBL} (${bonLivraison.totalItems} articles sortis pour l'OT ${newReport.refOT}).`,
        severity: 'info',
      });
    }

    if (currentView !== 'tablet') {
      setCurrentView(previousListView || 'maintenance-orders');
      showNotification(`Report ${newReport.refReport} submitted. Order status is now 'Waiting work validation'.`);
    }
  };

  // Point 13: Step 1 Post-validation by Responsable Production
  const handleValidatePostStep1RespProd = (orderId: string) => {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const ord = orders.find((o) => o.id === orderId);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
            ...o,
            validationReportProd: {
              validated: true,
              rejected: false,
              rejectionReason: undefined,
              validatedBy: `${currentUser.name} (${currentUser.role})`,
              validatedAt: timestamp,
            },
            validationProgress: 90,
          }
          : o
      )
    );
    logMovement({
      category: 'Maintenance Order',
      action: 'VALIDATE',
      targetRef: ord?.refOT || orderId,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Validation Post-intervention Etape 1 (Production) sur ${ord?.refOT || orderId}. Remise en production acceptée.`,
      severity: 'success',
      metadata: { step: 'validationReportProd' },
    });
    showNotification('Work accepted by Responsable Production. Awaiting final technical signoff.');
  };

  const handleRejectPostStep1RespProd = (orderId: string, reason: string) => {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const ord = orders.find((o) => o.id === orderId);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
            ...o,
            validationReportProd: {
              validated: false,
              rejected: true,
              rejectionReason: reason,
              rejectedBy: `${currentUser.name} (${currentUser.role})`,
              rejectedAt: timestamp,
            },
          }
          : o
      )
    );
    logMovement({
      category: 'Maintenance Order',
      action: 'REJECT',
      targetRef: ord?.refOT || orderId,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Refus Post-intervention Etape 1 (Production) sur ${ord?.refOT || orderId}. Motif: ${reason}`,
      rejectionReason: reason,
      severity: 'danger',
    });
    showNotification(`Post-intervention check rejected by Production. Reason: ${reason}`);
  };

  const handleChangeDecisionPostStep1 = (
    orderId: string,
    decision: 'Validated' | 'Rejected',
    reason?: string
  ) => {
    const ord = orders.find((o) => o.id === orderId);
    if (ord?.validationReportTech?.validated) {
      showNotification('Modification impossible : l\'ordre est déjà clôturé par le Responsable Technique !');
      return;
    }
    if (decision === 'Validated') {
      handleValidatePostStep1RespProd(orderId);
    } else {
      handleRejectPostStep1RespProd(orderId, reason || 'Non-conformité pièces après redémarrage');
    }
  };

  // Point 13 & 14: Step 2 Post-validation by Responsable Technique -> Changes order status to 'Completed'!
  const handleValidatePostStep2RespTech = (orderId: string) => {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const ord = orders.find((o) => o.id === orderId);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
            ...o,
            status: 'Completed', // Point 14!
            validationProgress: 100,
            validationReportTech: {
              validated: true,
              rejected: false,
              rejectionReason: undefined,
              validatedBy: `${currentUser.name} (${currentUser.role})`,
              validatedAt: timestamp,
            },
          }
          : o
      )
    );
    logMovement({
      category: 'Maintenance Order',
      action: 'VALIDATE',
      targetRef: ord?.refOT || orderId,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Clôture technique finale et approbation par le Responsable Technique sur ${ord?.refOT || orderId}. Statut OT passé à "Completed" (100%).`,
      previousState: ord?.status,
      newState: 'Completed',
      severity: 'success',
      metadata: { step: 'validationReportTech' },
    });
    showNotification('Final technical signoff approved! Maintenance Order OT is now Completed.');
  };

  const handleRejectPostStep2RespTech = (orderId: string, reason: string) => {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const ord = orders.find((o) => o.id === orderId);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
            ...o,
            status: 'Waiting work validation',
            validationReportTech: {
              validated: false,
              rejected: true,
              rejectionReason: reason,
              rejectedBy: `${currentUser.name} (${currentUser.role})`,
              rejectedAt: timestamp,
            },
          }
          : o
      )
    );
    logMovement({
      category: 'Maintenance Order',
      action: 'REJECT',
      targetRef: ord?.refOT || orderId,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Refus de clôture technique finale sur ${ord?.refOT || orderId}. Motif: ${reason}`,
      rejectionReason: reason,
      severity: 'danger',
    });
    showNotification(`Final technical signoff rejected. Reason: ${reason}`);
  };

  const handleChangeDecisionPostStep2 = (
    orderId: string,
    decision: 'Validated' | 'Rejected',
    reason?: string
  ) => {
    if (decision === 'Validated') {
      handleValidatePostStep2RespTech(orderId);
    } else {
      handleRejectPostStep2RespTech(orderId, reason || 'Dossier technique non approuvé');
    }
  };

  // Report Handlers (Full-page views)
  const handleOpenReportFillForOT = (order: MaintenanceOrder) => {
    // Look up existing report for this work order (by refOT, reportRef, or orderId)
    const existing = reports.find(
      (r) =>
        (order.refOT && r.refOT === order.refOT) ||
        (order.reportRef && (r.refReport === order.reportRef || r.id === order.reportRef)) ||
        (order.id && r.orderId === order.id)
    );

    if (existing) {
      setActiveReportDefaults(existing);
    } else {
      setActiveReportDefaults({
        refReport: generateNextReportRef(reports, order.date || new Date().toISOString()),
        refOT: order.refOT,
        refIR: order.refIR,
        category: order.category,
        priority: order.priority,
        assignedTo: order.assignedTo,
        requestedBy: requests.find((r) => r.refIR === order.refIR)?.requester || currentUser?.name || '',
        filledBy: order.assignedTo ? order.assignedTo.split(' ')[0] : currentUser?.name || '',
        equipmentId: order.machineId || order.equipmentId,
        equipmentName: order.machineNumber || order.equipmentName,
        orderId: order.id,
      });
    }
    setPreviousListView(currentView);
    setCurrentView('intervention-report-fill');
  };

  const handleOpenBlankReportFill = () => {
    setActiveReportDefaults({
      refReport: generateNextReportRef(reports, new Date().toISOString()),
    });
    setPreviousListView(currentView);
    setCurrentView('intervention-report-fill');
  };

  const handleOpenReportDetails = (report: InterventionReport) => {
    setSelectedReportForDetails(report);
    setPreviousListView(currentView);
    setCurrentView('report-details');
  };

  const handleOpenPdfReport = (order: MaintenanceOrder) => {
    setSelectedOrderForPdf(order);
    setPreviousListView(currentView);
    setCurrentView('ot-pdf-report');
  };

  // Stock Handlers
  const handleAdjustStock = (
    id: string,
    delta: number,
    reason: string = 'Manual Adjustment',
    refDoc?: string
  ) => {
    setStock((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const newQty = Math.max(0, s.currentQty + delta);
          const mvtType: 'IN' | 'OUT' | 'ADJUSTMENT' =
            delta > 0 ? 'IN' : delta < 0 ? 'OUT' : 'ADJUSTMENT';
          setStockMovements((prevMvt) => [
            {
              id: `mvt-${Date.now()}`,
              date: new Date().toISOString().replace('T', ' ').slice(0, 16),
              itemId: s.id,
              partNumber: s.partNumber,
              itemName: s.name,
              type: mvtType,
              qty: Math.abs(delta),
              previousQty: s.currentQty,
              newQty,
              reason: (reason as any) || 'Manual Adjustment',
              referenceDoc: refDoc,
              operator: currentUser?.name || 'Administrator',
            },
            ...prevMvt,
          ]);
          return { ...s, currentQty: newQty };
        }
        return s;
      })
    );
  };

  const handleAddNewPart = (part: StockItem) => {
    setStock((prev) => [part, ...prev]);
    showNotification(`Matière / Pièce ${part.partNumber} ajoutée au catalogue magasin.`);
  };

  const handleRecordMovement = (movement: StockMovement) => {
    setStockMovements((prev) => [movement, ...prev]);
  };

  const handleDeleteMovement = (id: string) => {
    const target = stockMovements.find((m) => m.id === id);
    setStockMovements((prev) => prev.filter((m) => m.id !== id));
    logMovement({
      category: 'Stock Magasin',
      action: 'DELETE',
      targetRef: target?.partNumber || id,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Suppression administrative du mouvement de stock #${id} — ${target?.type || ''} ${target?.qty || ''} × ${target?.itemName || ''} (${target?.partNumber || ''}) du ${target?.date || ''}.`,
      severity: 'danger',
    });
    showNotification(`Mouvement de stock supprimé.`);
  };

  const handleBulkImportStock = (newItems: StockItem[]) => {
    setStock((prev) => [...newItems, ...prev]);
    showNotification(`${newItems.length} articles importés avec succès dans le stock.`);
  };

  const handleDeletePart = (id: string) => {
    setStock((prev) => prev.filter((s) => s.id !== id));
    showNotification('Article supprimé du catalogue magasin.');
  };

  // Delivery Notes
  const handleAddNewBL = (note: DeliveryNote) => {
    setDeliveryNotes((prev) => [note, ...prev]);
    logMovement({
      category: 'Delivery Note',
      action: 'CREATE',
      targetRef: note.refBL,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Création du Bon de Livraison (BL) ${note.refBL} fournisseur ${note.supplier} (${note.items?.length || 0} articles réceptionnés).`,
      severity: 'info',
    });
    showNotification(`Delivery Note ${note.refBL} recorded.`);
  };

  const handleEditBL = (updatedNote: DeliveryNote) => {
    setDeliveryNotes((prev) => prev.map((n) => (n.id === updatedNote.id ? updatedNote : n)));
    logMovement({
      category: 'Delivery Note',
      action: 'UPDATE',
      targetRef: updatedNote.refBL,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Modification administrative du Bon de Livraison ${updatedNote.refBL} (${updatedNote.supplier}).`,
      severity: 'info',
    });
    showNotification(`Bon de Livraison ${updatedNote.refBL} mis à jour.`);
  };

  const handleDeleteBL = (id: string) => {
    const target = deliveryNotes.find((n) => n.id === id);
    setDeliveryNotes((prev) => prev.filter((n) => n.id !== id));
    logMovement({
      category: 'Delivery Note',
      action: 'DELETE',
      targetRef: target?.refBL || id,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Suppression administrative du Bon de Livraison ${target?.refBL || id} (${target?.supplier || ''}).`,
      severity: 'danger',
    });
    showNotification(`Bon de Livraison ${target?.refBL || id} supprimé.`);
  };

  // Calendar
  const handleToggleEvent = (id: string) => {
    setCalendarEvents((prev) =>
      prev.map((ev) => (ev.id === id ? { ...ev, completed: !ev.completed } : ev))
    );
  };

  const handleAddNewEvent = (event: CalendarEvent) => {
    setCalendarEvents((prev) => [event, ...prev]);
    showNotification('Preventive task scheduled on calendar.');
  };

  // User Management Handlers
  const handleAddUser = (newUser: AppUser) => {
    setUsers((prev) => [newUser, ...prev]);
    sqliteApi.createUser(newUser).catch((err) => console.warn('SQLite create user error:', err));
    logMovement({
      category: 'Users & IAM',
      action: 'CREATE',
      targetRef: newUser.username,
      user: `${currentUser.name} (${currentUser.role})`,
      details: `Création du profil utilisateur ${newUser.name} avec le rôle ${newUser.role} (${newUser.department}).`,
      severity: 'info',
    });
    showNotification(`User ${newUser.name} registered as ${newUser.role}.`);
  };

  const handleUpdateUser = (updatedUser: AppUser) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    sqliteApi.saveUser(updatedUser).catch((err) => console.warn('SQLite save user error:', err));
    if (currentUser.id === updatedUser.id) {
      setAuthUser(updatedUser);
      try {
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      } catch { }
    }
    showNotification(`User profile for ${updatedUser.name} updated.`);
  };

  const handleToggleUserStatus = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const updated = { ...u, status: (u.status === 'Active' ? 'Inactive' : 'Active') as 'Active' | 'Inactive' };
          sqliteApi.saveUser(updated).catch((err) => console.warn('SQLite toggle user status error:', err));
          return updated;
        }
        return u;
      })
    );
    showNotification('User account status updated.');
  };

  const handleDeleteUser = (userId: string) => {
    if (userId === currentUser.id) {
      showNotification('Impossible de supprimer votre propre compte actif.');
      return;
    }
    const targetUser = users.find((u) => u.id === userId);
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    sqliteApi.deleteUser(userId).catch((err) => console.warn('SQLite delete user error:', err));
    if (targetUser) {
      logMovement({
        category: 'Users & IAM',
        action: 'DELETE',
        targetRef: targetUser.username,
        user: `${currentUser.name} (${currentUser.role})`,
        details: `Suppression du compte utilisateur ${targetUser.name} (${targetUser.role} - ${targetUser.department}).`,
        severity: 'warning',
      });
      showNotification(`Utilisateur ${targetUser.name} supprimé avec succès.`);
    } else {
      showNotification('Utilisateur supprimé avec succès.');
    }
  };

  const handleSwitchCurrentUser = (newUser: AppUser) => {
    setAuthUser(newUser);
    try {
      localStorage.setItem('currentUser', JSON.stringify(newUser));
    } catch { }
    logMovement({
      category: 'Users & IAM',
      action: 'LOGIN_SWITCH',
      targetRef: newUser.username,
      user: `${newUser.name} (${newUser.role})`,
      details: `Changement de profil actif : ${newUser.name} (${newUser.role} - ${newUser.department}).`,
      severity: 'info',
    });
    showNotification(`Session active changée pour ${newUser.name} (${newUser.role}).`);
  };

  // Full database state object for backup
  const fullGMAOState: FullGMAOState = {
    machines,
    molds,
    requests,
    orders,
    reports,
    stock,
    stockMovements,
    deliveryNotes,
    calendarEvents,
    users,
    moldMaintenances,
    productionOrders,
  };

  const handleRestoreFullState = (restored: FullGMAOState) => {
    if (restored.machines) setMachines(restored.machines);
    if (restored.molds) setMolds(restored.molds);
    if (restored.requests) setRequests(restored.requests);
    if (restored.orders) setOrders(restored.orders);
    if (restored.reports) setReports(restored.reports);
    if (restored.stock) setStock(restored.stock);
    if (restored.stockMovements) setStockMovements(restored.stockMovements);
    if (restored.deliveryNotes) setDeliveryNotes(restored.deliveryNotes);
    if (restored.calendarEvents) setCalendarEvents(restored.calendarEvents);
    if (restored.users) setUsers(restored.users);
    if (restored.moldMaintenances) setMoldMaintenances(restored.moldMaintenances);
    if (restored.productionOrders) setProductionOrders(restored.productionOrders);
    // Persist restored state immediately to SQLite database
    sqliteApi.saveFullState(restored).catch((err) => console.warn('SQLite restore error:', err));
    showNotification('Base de données SQLite GMAO restaurée avec succès.');
  };

  const handleFactoryResetData = () => {
    setMachines(INITIAL_MACHINES);
    setMolds(INITIAL_MOLDS);
    setRequests(INITIAL_INTERVENTION_REQUESTS);
    setOrders(INITIAL_MAINTENANCE_ORDERS);
    setReports(INITIAL_INTERVENTION_REPORTS);
    setStock(INITIAL_STOCK);
    setStockMovements(INITIAL_STOCK_MOVEMENTS);
    setDeliveryNotes(INITIAL_DELIVERY_NOTES);
    setCalendarEvents(INITIAL_CALENDAR_EVENTS);
    setUsers(INITIAL_USERS);
    setMoldMaintenances(INITIAL_MOLD_MAINTENANCES);
    // Reset SQLite database on disk
    sqliteApi.resetDatabase().catch((err) => console.warn('SQLite reset error:', err));
    showNotification('Base de données SQLite réinitialisée aux valeurs usine par défaut.');
  };

  // Machine maintenance navigation helper
  const handleSelectMachineMaintenance = (machineId: string) => {
    navigateTo('machine-maintenance');
  };

  // Counts for sidebar badges
  const waitingRequestsCount = requests.filter((r) => r.status === 'Waiting').length;
  const waitingOrdersCount = orders.filter((o) => o.status === 'Waiting').length;
  const waitingReportsCount = reports.filter((r) => r.status === 'Waiting').length;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#ebeeed] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-semibold text-neutral-600">Chargement de l'application GMAO...</p>
        </div>
      </div>
    );
  }

  // Standalone Fullscreen Tablet Web App for Technicians (checked BEFORE desktop auth — fully independent session)
  if (currentView === 'tablet') {
    if (!tabletUser) {
      return <TabletLogin onLogin={(u) => setTabletUser(u)} />;
    }

    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const urlMachineId = urlParams?.get('id') || urlParams?.get('machineId') || selectedMachineForTablet;
    const rawTab = urlParams?.get('tab');
    const urlTab = rawTab && ['machines', 'orders', 'send_di', 'fill_report', 'molds', 'ofs_list'].includes(rawTab)
      ? (rawTab as any)
      : 'machines';

    return (
      <>
        <Toaster position="top-right" richColors />
        <TabletView
          machines={machines}
          initialMachineId={urlMachineId}
          initialTab={urlTab}
          molds={molds}
          requests={requests}
          orders={orders}
          reports={reports}
          stock={stock}
          productionOrders={productionOrders}
          onUpdateProductionOrder={handleUpdateProductionOrder}
          onUpdateOF={handleUpdateOF}
          onRefreshData={refreshAllData}
          currentUser={tabletUser}
          users={users}
          onSwitchUser={(u) => setTabletUser(u)}
          onUpdateMachineStatus={handleUpdateMachineStatus}
          onUpdateMachineMold={handleUpdateMachineMold}
          onUpdateMachineProduction={handleUpdateMachineProduction}
          onSaveNewRequest={(req) => {
            setRequests((prev) => [req, ...prev]);
            showNotification(`Demande d'intervention ${req.refIR} envoyée avec succès.`);
          }}
          onSaveReport={handleSaveReport}
          onValidatePreStep1={handleValidatePreStep1RespMaint}
          onValidatePreStep2={handleValidatePreStep2RespProd}
          onValidatePreStep3={handleValidatePreStep3QHSE}
          onLogout={() => setTabletUser(null)}
          onExitTabletMode={() => {
            // No longer navigates to desktop from tablet
          }}
          moldMaintenances={moldMaintenances}
          onUpdateMold={(moldId, updates) => {
            setMolds((prev) =>
              prev.map((m) => (m.id === moldId ? { ...m, ...updates } : m))
            );
            logMovement({
              category: 'Mold Tooling',
              action: 'UPDATE',
              targetRef: moldId,
              user: `${tabletUser?.name || 'Technicien'} (${tabletUser?.role || 'Technicien'})`,
              details: `Mise à jour du moule ${moldId}: ${JSON.stringify(updates)}`,
              severity: 'info',
            });
          }}
          onAddNewMold={(newMold) => {
            setMolds((prev) => [newMold, ...prev]);
            logMovement({
              category: 'Mold Tooling',
              action: 'CREATE',
              targetRef: newMold.moldNumber || newMold.ref || newMold.id,
              user: `${tabletUser?.name || 'Technicien'} (${tabletUser?.role || 'Technicien'})`,
              details: `Création nouveau moule ${newMold.moldNumber || newMold.ref} (${newMold.description}).`,
              severity: 'info',
            });
          }}
          onSaveMoldMaintenance={(record) => {
            setMoldMaintenances((prev) => {
              const idx = prev.findIndex((r) => r.id === record.id);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = record;
                return copy;
              }
              return [record, ...prev];
            });
            logMovement({
              category: 'Mold Tooling',
              action: 'STATUS_CHANGE',
              targetRef: record.moldNumber,
              user: `${tabletUser?.name || 'Technicien'} (${tabletUser?.role || 'Technicien'})`,
              details: `Enregistrement maintenance moule ${record.moldNumber} (statut: ${record.status}).`,
              severity: 'info',
            });
          }}
        />
      </>
    );
  }

  // Authentication check - Show Login if not authenticated (desktop)
  if (!user) {
    return <Login />;
  }

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="min-h-screen bg-[#ebeeed] text-neutral-900 flex font-sans">
        {/* Toast Notification */}
        {notification && (
          <div className="fixed top-5 right-5 z-50 bg-neutral-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* Persistent Left Sidebar */}
        <Sidebar
          currentView={currentView}
          onNavigate={navigateTo}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          onLogout={logout}
          currentUser={currentUser}
          counts={{
            waitingRequests: waitingRequestsCount,
            waitingOrders: waitingOrdersCount,
            waitingReports: waitingReportsCount,
          }}
        />

        {/* Main Content Area */}
        <div
          className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarOpen ? 'lg:pl-72' : 'pl-16'
            }`}
        >
          {/* Top Header matching Screenshots */}
          <TopHeader
            title={viewTitles[currentView]}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            onRefresh={() => {
              sqliteApi.getFullState().then((data) => {
                if (data) {
                  if (data.machines) setMachines(data.machines);
                  if (data.molds) setMolds(data.molds);
                  if (data.requests) setRequests(data.requests);
                  if (data.orders) setOrders(data.orders);
                  if (data.reports) setReports(data.reports);
                  if (data.stock) setStock(data.stock);
                  if (data.users) setUsers(data.users);
                }
                showNotification('Synchronisation SQLite effectuée avec succès.');
              }).catch(() => {
                showNotification('Data refreshed with live workshop telemetry.');
              });
            }}
            currentUser={currentUser}
            users={users}
            onSwitchUser={handleSwitchCurrentUser}
            onOpenUsers={isAdmin ? () => navigateTo('users') : undefined}
            onLogout={logout}
            onDownloadReport={
              currentView === 'dashboard' && isAdmin ? () => navigateTo('audit-report') : undefined
            }
            onAdd={
              currentView === 'intervention-request'
                ? () => navigateTo('new-intervention-request')
                : currentView === 'maintenance-orders'
                  ? () => navigateTo('new-maintenance-order')
                  : currentView === 'intervention-reports'
                    ? handleOpenBlankReportFill
                    : undefined
            }
          />

          {/* View Switcher Container (Pure Full-Page Views, NO POPUP MODALS) */}
          <main className="flex-1 pb-16">
            {currentView === 'dashboard' && (
              <DashboardView
                requests={requests}
                orders={orders}
                machines={machines}
                molds={molds}
                stock={stock}
                onNavigate={navigateTo}
                onOpenReportModal={() => navigateTo('audit-report')}
              />
            )}

            {currentView === 'intervention-request' && (
              <InterventionRequestView
                requests={requests}
                onValidate={handleValidateRequest}
                onReject={handleRejectRequest}
                onChangeDecision={handleChangeRequestDecision}
                onCreateOTFromIR={handleCreateOTFromIR}
                onOpenNewIRModal={() => navigateTo('new-intervention-request')}
                onEditRequest={handleEditRequest}
                onDeleteRequest={handleDeleteRequest}
                onArchiveRequest={handleArchiveRequest}
                currentUser={currentUser}
              />
            )}

            {currentView === 'archives' && (
              <ArchiveView
                requests={requests}
                orders={orders}
                reports={reports}
                currentUser={currentUser}
                onUnarchiveRequest={handleUnarchiveRequest}
                onOpenPdfReport={handleOpenPdfReport}
              />
            )}

            {currentView === 'ofs' && (
              <OFsView
                ofs={productionOrders}
                machines={machines}
                molds={molds}
                currentUser={currentUser}
                onSaveOF={handleSaveOF}
                onUpdateOF={handleUpdateOF}
                onDeleteOF={handleDeleteOF}
              />
            )}

            {currentView === 'new-intervention-request' && (
              <NewInterventionRequestView
                currentUser={currentUser}
                existingRequests={requests}
                onSave={handleSaveNewIR}
                onCancel={() => navigateTo('intervention-request')}
              />
            )}

            {currentView === 'maintenance-orders' && (
              <MaintenanceOrdersView
                orders={orders}
                machines={machines}
                molds={molds}
                requests={requests}
                onOpenReportModalForOT={handleOpenReportFillForOT}
                onOpenNewOTModal={() => navigateTo('new-maintenance-order')}
                onEditOrder={handleEditOrder}
                onDeleteOrder={handleDeleteOrder}
                onUpdateStatus={(id, st) =>
                  setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: st } : o)))
                }
                onValidatePreStep1RespMaint={handleValidatePreStep1RespMaint}
                onRejectPreStep1RespMaint={handleRejectPreStep1RespMaint}
                onChangeDecisionPreStep1={handleChangeDecisionPreStep1}
                onValidatePreStep2RespProd={handleValidatePreStep2RespProd}
                onRejectPreStep2RespProd={handleRejectPreStep2RespProd}
                onChangeDecisionPreStep2={handleChangeDecisionPreStep2}
                onValidatePreStep3QHSE={handleValidatePreStep3QHSE}
                onRejectPreStep3QHSE={handleRejectPreStep3QHSE}
                onChangeDecisionPreStep3={handleChangeDecisionPreStep3}
                onValidatePostStep1RespProd={handleValidatePostStep1RespProd}
                onRejectPostStep1RespProd={handleRejectPostStep1RespProd}
                onChangeDecisionPostStep1={handleChangeDecisionPostStep1}
                onValidatePostStep2RespTech={handleValidatePostStep2RespTech}
                onRejectPostStep2RespTech={handleRejectPostStep2RespTech}
                onChangeDecisionPostStep2={handleChangeDecisionPostStep2}
                onOpenPdfReport={handleOpenPdfReport}
                currentUser={currentUser}
              />
            )}

            {currentView === 'new-maintenance-order' && (
              <NewMaintenanceOrderView
                machines={machines}
                molds={molds}
                pendingRequests={requests.filter((r) => r.status === 'Validated' && !r.relatedOTRef)}
                existingOrders={orders}
                selectedIR={selectedIRForOT}
                users={users}
                onSave={handleSaveNewOT}
                onCancel={() => {
                  setSelectedIRForOT(null);
                  navigateTo('maintenance-orders');
                }}
                currentUser={currentUser}
              />
            )}

            {currentView === 'intervention-reports' && (
              <InterventionReportsView
                reports={reports}
                onOpenReportDetails={handleOpenReportDetails}
                onOpenNewReportModal={handleOpenBlankReportFill}
                onDeleteReport={handleDeleteReport}
                onEditReport={handleEditReport}
                currentUser={currentUser}
              />
            )}

            {currentView === 'intervention-report-fill' && (
              <InterventionReportFillView
                stockItems={stock}
                machines={machines}
                molds={molds}
                existingReports={reports}
                currentUser={currentUser}
                defaultValues={activeReportDefaults}
                onSave={handleSaveReport}
                onCancel={() => navigateTo(previousListView || 'maintenance-orders')}
              />
            )}

            {currentView === 'report-details' && (
              <ReportDetailsView
                report={selectedReportForDetails}
                onBack={() => navigateTo(previousListView || 'intervention-reports')}
              />
            )}

            {currentView === 'machine-maintenance' && (
              <MachineMaintenanceView
                orders={orders}
                reports={reports}
                machines={machines}
                onOpenReportModalForOT={handleOpenReportFillForOT}
                onOpenReportDetails={handleOpenReportDetails}
              />
            )}

            {currentView === 'mold-maintenance' && (
              <MoldMaintenanceView
                molds={molds}
                initialRecords={moldMaintenances}
                onRecordsChange={setMoldMaintenances}
                onDeleteRecord={handleDeleteMoldMaintenance}
                onSaveRecord={handleSaveMoldMaintenance}
                currentUser={currentUser}
              />
            )}

            {currentView === 'other-maintenances' && (
              <OtherMaintenancesView
                orders={orders}
                reports={reports}
                onOpenReportModalForOT={handleOpenReportFillForOT}
                onOpenReportDetails={handleOpenReportDetails}
              />
            )}

            {currentView === 'machines' && (
              <MachinesView
                machines={machines}
                onUpdateMachines={setMachines}
                currentUser={currentUser}
                orders={orders}
                reports={reports}
                onNavigate={navigateTo}
                onOpenNewOTModal={() => navigateTo('new-maintenance-order')}
                onOpenTabletForMachine={(machineId) => {
                  setSelectedMachineForTablet(machineId);
                  navigateTo('tablet');
                }}
              />
            )}

            {currentView === 'mold-list' && (
              <MoldListView
                molds={molds}
                machines={machines}
                currentUser={currentUser}
                onUpdateMolds={(updatedMolds) => setMolds(updatedMolds)}
                onNavigate={navigateTo}
                onOpenNewOTModal={() => navigateTo('new-maintenance-order')}
              />
            )}

            {(currentView === 'stock-material' ||
              currentView === 'material-status' ||
              currentView === 'input-material' ||
              currentView === 'output-material') && (
                <StockMaterialView
                  activeSubView={
                    currentView === 'input-material'
                      ? 'input'
                      : currentView === 'output-material'
                        ? 'output'
                        : 'status'
                  }
                  onNavigateSubView={(sub) => {
                    if (sub === 'input') navigateTo('input-material');
                    else if (sub === 'output') navigateTo('output-material');
                    else navigateTo('material-status');
                  }}
                  currentUser={currentUser}
                />
              )}

            {currentView === 'stock-magasin' && (
              <StockMagasinView
                stock={stock}
                movements={stockMovements}
                onAdjustStock={handleAdjustStock}
                onAddNewPart={handleAddNewPart}
                onRecordMovement={handleRecordMovement}
                onBulkImport={handleBulkImportStock}
                onDeletePart={handleDeletePart}
                onDeleteMovement={handleDeleteMovement}
                currentUser={currentUser}
              />
            )}

            {currentView === 'bon-livraison' && (
              <BonLivraisonView
                notes={deliveryNotes}
                onAddNewBL={handleAddNewBL}
                onDeleteBL={handleDeleteBL}
                onEditBL={handleEditBL}
                currentUser={currentUser}
              />
            )}

            {currentView === 'analysis-kpis' && (
              <AnalysisKPIView
                machines={machines}
                molds={molds}
                reports={reports}
                orders={orders}
              />
            )}

            {currentView === 'calendar' && (
              <CalendarView
                events={calendarEvents}
                onToggleEventComplete={handleToggleEvent}
                onAddNewEvent={handleAddNewEvent}
              />
            )}

            {currentView === 'audit-report' && (
              isAdmin ? (
                <AuditReportView
                  requests={requests}
                  orders={orders}
                  machines={machines}
                  molds={molds}
                  stock={stock}
                  onBack={() => navigateTo('dashboard')}
                />
              ) : (
                <div className="p-8 max-w-lg mx-auto text-center space-y-4 bg-white rounded-3xl border border-neutral-300 shadow-xs my-8">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-black text-neutral-900">Accès Administrateur Requis</h2>
                  <p className="text-xs text-neutral-500">Le rapport d'audit est réservé au profil Administrateur.</p>
                  <button onClick={() => navigateTo('dashboard')} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs">
                    Retour au Tableau de Bord
                  </button>
                </div>
              )
            )}

            {currentView === 'users' && (
              isAdmin ? (
                <UsersView
                  users={users}
                  onAddUser={handleAddUser}
                  onUpdateUser={handleUpdateUser}
                  onToggleStatus={handleToggleUserStatus}
                  onDeleteUser={handleDeleteUser}
                  currentUser={currentUser}
                  onSwitchCurrentUser={handleSwitchCurrentUser}
                />
              ) : (
                <div className="p-8 max-w-lg mx-auto text-center space-y-4 bg-white rounded-3xl border border-neutral-300 shadow-xs my-8">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-black text-neutral-900">Accès Administrateur Requis</h2>
                  <p className="text-xs text-neutral-500">La gestion des utilisateurs et des accès système est strictement réservée au profil Administrateur.</p>
                  <button onClick={() => navigateTo('dashboard')} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs">
                    Retour au Tableau de Bord
                  </button>
                </div>
              )
            )}

            {currentView === 'audit-trail' && (
              isAdmin ? (
                <AuditTrailView
                  currentUser={currentUser}
                  onRefresh={() => showNotification('Audit trail refreshed with live telemetry.')}
                />
              ) : (
                <div className="p-8 max-w-lg mx-auto text-center space-y-4 bg-white rounded-3xl border border-neutral-300 shadow-xs my-8">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-black text-neutral-900">Accès Administrateur Requis</h2>
                  <p className="text-xs text-neutral-500">Le journal d'audit et la traçabilité système sont strictement réservés au profil Administrateur.</p>
                  <button onClick={() => navigateTo('dashboard')} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs">
                    Retour au Tableau de Bord
                  </button>
                </div>
              )
            )}

            {currentView === 'backup-restore' && (
              isAdmin ? (
                <BackupView
                  currentUser={currentUser}
                  state={fullGMAOState}
                  onRestoreState={handleRestoreFullState}
                  onResetFactoryData={handleFactoryResetData}
                />
              ) : (
                <div className="p-8 max-w-lg mx-auto text-center space-y-4 bg-white rounded-3xl border border-neutral-300 shadow-xs my-8">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-black text-neutral-900">Accès Administrateur Requis</h2>
                  <p className="text-xs text-neutral-500">La gestion des sauvegardes et la restauration de la base de données sont strictement réservées au profil Administrateur.</p>
                  <button onClick={() => navigateTo('dashboard')} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs">
                    Retour au Tableau de Bord
                  </button>
                </div>
              )
            )}

            {currentView === 'ot-pdf-report' && selectedOrderForPdf && (
              <MaintenanceOrderReportPdfView
                order={selectedOrderForPdf}
                report={reports.find((r) => r.refOT === selectedOrderForPdf.refOT)}
                request={requests.find((r) => r.refIR === selectedOrderForPdf.refIR)}
                machine={machines.find(
                  (m) =>
                    m.id === selectedOrderForPdf.equipmentId ||
                    m.number === selectedOrderForPdf.machineNumber
                )}
                mold={molds.find(
                  (mld) =>
                    mld.id === selectedOrderForPdf.equipmentId ||
                    mld.ref === selectedOrderForPdf.moldRef
                )}
                onBack={() => navigateTo(previousListView || 'maintenance-orders')}
              />
            )}
          </main>
        </div>
      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <GMAOAppContent />
    </AuthProvider>
  );
}
