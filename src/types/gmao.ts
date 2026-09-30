export type MaintenanceCategory = 'Machine' | 'Mold' | 'Other';

export type RequestStatus = 'Waiting' | 'Validated' | 'Rejected' | 'In Progress';
export type OrderStatus =
  | 'Waiting'
  | 'In Progress'
  | 'Waiting work validation'
  | 'Completed'
  | 'Rejected'
  | 'Validated';
export type ReportStatus = 'Waiting' | 'Validated' | 'Draft';
export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface InterventionRequest {
  id: string;
  refIR: string;
  date: string;
  problemDescription: string;
  requester: string;
  requesterRole?: string;
  status: RequestStatus;
  validatedBy: string; // Responsable Technique
  validatedAt: string;
  rejectionReason?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  relatedOTRef?: string;
  category?: MaintenanceCategory;
  equipmentId?: string;
  equipmentName?: string;
  priority?: PriorityLevel;
  // Archive fields
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  archiveReason?: string;
}

export interface ProductionOrderOF {
  id: string;
  ofNumber: string;
  title: string;
  machineId?: string;
  machineName?: string;
  moldId?: string;
  moldName?: string;
  targetQuantity?: number;
  producedQuantity?: number;
  date: string;
  dueDate?: string;
  priority?: 'Normal' | 'Urgent' | 'High';
  pdfUrl?: string;
  pdfFileName?: string;
  pdfFileSize?: number;
  importedBy?: string;
  importedAt?: string;
  notes?: string;
  status: 'Pending' | 'In Progress' | 'Done';
  completedAt?: string;
  completedBy?: string;
  completedNotes?: string;
}

export interface MaintenanceOrder {
  id: string;
  date: string;
  refOT: string;
  refIR: string;
  irDescription?: string;
  category: MaintenanceCategory; // Machine | Mold | Other
  
  // Machine category fields
  machineId?: string;
  machineNumber?: string;
  machineMaintenanceType?: 'Preventive' | 'Corrective';
  maintenanceType?: 'Preventive' | 'Corrective';

  // Mold category fields (maintenance or request to put in machine)
  moldId?: string;
  moldRef?: string;
  moldActionType?: 'Mold Maintenance' | 'Put in Machine';
  targetMachineId?: string;
  targetMachineNumber?: string;

  // Other category field
  otherDescription?: string;

  equipmentId?: string;
  equipmentName: string;
  priority: PriorityLevel;
  assignedTo: string;
  status: OrderStatus;
  description: string;
  estimatedHours: number;
  scheduledDate?: string;
  scheduledTime?: string;

  // Pre-execution 3-step validations (Point 10)
  validationRespMaint?: {
    validated: boolean;
    rejected?: boolean;
    rejectionReason?: string;
    rejectedBy?: string;
    rejectedAt?: string;
    validatedBy?: string;
    validatedAt?: string;
    estimatedHours?: number;
    scheduledDate?: string;
    scheduledTime?: string;
  };
  validationRespProd?: {
    validated: boolean;
    rejected?: boolean;
    rejectionReason?: string;
    rejectedBy?: string;
    rejectedAt?: string;
    validatedBy?: string;
    validatedAt?: string;
  };
  validationQHSE?: {
    validated: boolean;
    rejected?: boolean;
    rejectionReason?: string;
    rejectedBy?: string;
    rejectedAt?: string;
    validatedBy?: string;
    validatedAt?: string;
  };

  // Post-intervention 2-step validations (Point 13)
  validationReportProd?: {
    validated: boolean;
    rejected?: boolean;
    rejectionReason?: string;
    rejectedBy?: string;
    rejectedAt?: string;
    validatedBy?: string;
    validatedAt?: string;
  };
  validationReportTech?: {
    validated: boolean;
    rejected?: boolean;
    rejectionReason?: string;
    rejectedBy?: string;
    rejectedAt?: string;
    validatedBy?: string;
    validatedAt?: string;
  };

  validationProgress: number; // 0% to 100%
  reportRef?: string;
  createdAt?: string; // ISO date when the order was created
}

export interface StockTakeItem {
  id: string;
  itemId: string;
  itemName: string;
  partNumber: string;
  qty: number;
  unitPrice: number;
}

export interface InterventionReport {
  id: string;
  date: string;
  refReport: string;
  refOT: string;
  refIR: string;
  category: MaintenanceCategory;
  priority: PriorityLevel;
  requestedBy: string;
  assignedTo: string;
  filledBy: string;
  cause: string;
  subCause: string;
  startingTime: string;
  finishedTime: string;
  durationMinutes: number;
  actions: string[];
  difficulties: string[];
  stockTaken: StockTakeItem[];
  status: ReportStatus;
  orderId?: string;
  technicianName?: string;
  interventionType?: string;

  // Equipment info
  equipmentId?: string;
  equipmentName?: string;

  // Cost breakdown
  laborHours?: number;
  laborRatePerHour?: number;
  laborCost?: number;
  sparePartsCost?: number;
  externalCost?: number;
  totalCost?: number;

  // Mold-specific report fields
  moldId?: string;
  moldNumber?: string;
  moldRepairLocation?: 'local' | 'external';
  moldSupplierName?: string;
  moldStatusAfterRepair?: 'In Stock' | 'In Use' | 'Exported';
  affectedCavities?: string;
  moldToolingPhotoUrl?: string;
  moldMaintenanceId?: string;

  // Meter reading for machine
  meterReadingHours?: number;
  meterReadingConfirmedWarning?: boolean;

  // Other-specific report fields
  auxiliaryEquipmentType?: string;
  facilityLocation?: string;
  rootCauseNotes?: string;
  preventiveMeasures?: string;
  safetyObservations?: string;

  // Additional tooling & status fields
  imageUrl?: string;
  issueDescription?: string;
  equipmentStatusAfterRepair?: string;
}

export type RepairLocation = 'local' | 'external';
export type MoldMaintenanceStatus = 'in_progress' | 'completed';

export interface MoldMaintenance {
  id: string;
  moldId: string;
  moldNumber: string;
  date: string;
  repairLocation: RepairLocation;
  status: MoldMaintenanceStatus;
  issueDescription: string;
  supplierName?: string;
  devisUrl?: string;
  actionsPerformed: string[];
  imageUrl?: string;
  closedStatusChoice?: 'In Stock' | 'In Use';
  workOrderId?: string;
  completedAt?: string;
  costTnd?: number;
}

export type MachineStatus =
  | 'operational'
  | 'down'
  | 'maintenance'
  | 'idle'
  | 'Running'
  | 'Under Maintenance'
  | 'Stopped'
  | 'Setup';

export type CounterReadingSource = 'Work Order' | 'Manual' | 'Correction';

export interface CounterReading {
  id: string;
  machineId: string;
  date: string; // ISO string or YYYY-MM-DD HH:mm
  previousHours: number;
  newHours: number;
  deltaHours: number;
  operator: string;
  source: CounterReadingSource;
  note?: string;
  isCorrection?: boolean;
  correctionReason?: string;
  originalReadingId?: string;
  refReport?: string;
  refOT?: string;
}

export interface PreventiveTask {
  id: string;
  type: 'inspection' | 'lubrication' | 'replacement' | 'calibration';
  frequency: 'hours' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  frequencyHours?: number;
  description: string;
}

export interface Machine {
  id: string;
  name?: string;
  number: string;
  serialNumber?: string;
  injectingProduct?: string;
  type?: string; // 'Simple Injection' | 'Double Injection' | 'Triple Injection'
  manufacturingYear?: number;
  year?: number; // alias
  location?: string;
  locationNumber?: string;
  siteNumber?: string;
  brand?: string;
  model?: string;
  clampingForce?: number; // in tons
  clampingForceTons?: number; // alias
  condition?: string;
  status: MachineStatus;
  statusReason?: string;
  nextMaintenance?: string;
  installationDate?: string;
  currentHours?: number;
  lastMeterReadingDate?: string;
  lastMeterReadingBy?: string;
  counterReadings?: CounterReading[];
  nextMaintenanceHours?: number;
  totalOperatingTime?: number; // in minutes
  totalOperatingHours?: number; // in hours
  totalDownTime?: number; // in minutes
  failureCount?: number;
  mtbfHours?: number;
  mttrHours?: number;
  imageUrl?: string;
  line?: string;
  activeMoldRef?: string;
  preventivePlan?: PreventiveTask[];
  
  // Technical specs
  closingType?: string;
  moldThicknessMin?: number;
  moldThicknessMax?: number;
  centeringDiameter?: number;
  tieBarSpacingHorizontal?: number;
  tieBarSpacingVertical?: number;
  maxOpeningStroke?: number;
  maxEjectionStroke?: number;
  coreCount?: number;
  screwDiameter?: number;
  maxInjectableVolume?: number;
  coolingChannelCount?: number;
  thermalRegulation?: string;
  accessories?: string;
  hydraulicOilType?: string;
  lubricantType?: string;
  reservoirCapacity?: number;

  // Live OF & Production tracking
  currentMoule?: string;
  qtyProduced?: number | null;
  qtyGood?: number | null;
  qtyBad?: number | null;
  ofReference?: string | null;
  currentProduct?: string | null;
  productionStartDate?: string | null;
  productionEndDate?: string | null;
  operationalStartTime?: string | null;
  downStartTime?: string | null;
  activeOf?: OfPreparation | null;
  ofQueue?: OfPreparation[];
}

export interface OfPreparation {
  id: string;
  machineId: string;
  ofReference?: string;
  injectedItem: string;
  moldNumber?: string;
  color?: string;
  targetQuantity: number;
  currentQuantity?: number;
  quantityPerBox?: number;
  pdfUrl?: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
}

export type MoldStatus =
  | 'In Stock'
  | 'In Use'
  | 'In Maintenance'
  | 'Exported'
  | 'In Production'
  | 'In Toolroom'
  | 'Ready in Rack'
  | 'Requires Repair';

export interface Mold {
  id: string;
  moldNumber?: string;
  ref?: string; // alias
  description: string;
  status: MoldStatus;
  location?: string;
  rackLocation?: string; // alias
  clampingForceRange?: string; // e.g. "50t/60t/100t"
  plateType2?: boolean;
  plateType3?: boolean;
  ewocon?: boolean;
  dme?: boolean;
  flatNozzle?: boolean;
  comment?: string;
  othersWeight?: string;
  moldImageUrl?: string;
  moldImages?: string[];
  exportDate?: string;
  customer?: string;
  cavities?: number;
  resin?: string;
  cycleTimeSec?: number;
  currentShots?: number;
  maxShotsBeforeMaintenance?: number;
  assignedMachineNumber?: string;
  supplier?: string; // Mold supplier / toolmaker
}

export type StockCategory =
  | 'Raw Material / Resin'
  | 'Masterbatch / Colorant'
  | 'Purge & Chemical'
  | 'Mechanical'
  | 'Hydraulic'
  | 'Electrical'
  | 'Pneumatic'
  | 'Consumable'
  | 'Mold Part'
  | 'Tooling'
  | 'Hardware';

export interface StockMovement {
  id: string;
  date: string;
  itemId: string;
  partNumber: string;
  itemName: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  qty: number;
  previousQty: number;
  newQty: number;
  reason:
    | 'Reception BL'
    | 'Production Consumption'
    | 'Maintenance OT'
    | 'Scrap / Purge'
    | 'Inventory Count'
    | 'Manual Adjustment';
  referenceDoc?: string;
  operator: string;
  notes?: string;
}

export interface StockItem {
  id: string;
  partNumber: string;
  sku?: string; // alias for partNumber
  name: string;
  category: StockCategory | string;
  currentQty: number;
  stock?: number; // alias for currentQty
  minQty: number;
  minStock?: number; // alias for minQty
  unit: string;
  unitPrice: number;
  shelfLocation: string;
  location?: string; // alias for shelfLocation
  compatibleMachines: string[];
  grade?: string;
  lotNumber?: string;
  supplier?: string;
  supplierRef?: string;
  lastRestocked?: string;
  barcode?: string;
  technicalNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type SparePart = StockItem;

export interface MaterialInputRecord {
  id: string;
  date: string;
  refBL: string;
  supplier: string;
  materialId: string;
  partNumber: string;
  materialName: string;
  grade: string;
  lotNumber: string;
  quantityKg: number;
  bagCount?: number;
  destinationSilo: string;
  moisturePercent?: number;
  status: 'Approved' | 'Quarantined' | 'Pending Test';
  receivedBy: string;
  notes?: string;
}

export interface MaterialOutputRecord {
  id: string;
  date: string;
  materialId: string;
  partNumber: string;
  materialName: string;
  grade: string;
  lotNumber: string;
  quantityKg: number;
  targetMachine: string;
  activeMoldRef?: string;
  productionOrderRef?: string;
  reason: 'Production Run' | 'Color Change Purge' | 'Sampling / Trial' | 'Scrap';
  operator: string;
  notes?: string;
}

export interface DeliveryNote {
  id: string;
  refBL: string;
  date: string;
  supplier: string;
  receivedBy: string;
  totalItems: number;
  totalAmount: number;
  status: 'Received' | 'Partially Received' | 'Inspected';
  items: {
    partNumber: string;
    description: string;
    qty: number;
    unitPrice: number;
  }[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'Preventive' | 'Mold Overhaul' | 'Oil Change' | 'Calibration' | 'Shutdown';
  equipmentRef: string;
  assignedTo: string;
  completed: boolean;
}

export type UserRole =
  | 'admin'
  | 'responsable technique'
  | 'responsable maintenance'
  | 'responsable production'
  | 'technician'
  | 'methode maintenance'
  | 'qhse'
  | 'manager'
  | 'accounting'
  | 'production'
  | string;

export interface AppUser {
  id: string;
  name: string;
  username: string;
  password?: string;
  email: string;
  phone: string;
  role: UserRole;
  department: string;
  shift: 'Shift 1 (Morning)' | 'Shift 2 (Evening)' | 'Shift 3 (Night)' | 'General (Day)';
  status: 'Active' | 'Inactive';
  lastLogin: string;
  avatarColor: string;
  specialty?: string;
  signatureUrl?: string;
}

export interface MaterialItem {
  id?: string;
  item: string;
  description?: string;
  subFamily?: string;
  unit: string;
  currentStock: number;
  location?: string;
  lastMovementDate?: string;
  minStock?: number;
  unitPrice?: number;
}

export interface MaterialMovement {
  id: string;
  itemRef: string;
  description?: string;
  subFamily?: string;
  quantity: number;
  unit: string;
  movementType: 'in' | 'out';
  location?: string;
  date: string;
  performedBy?: string;
  notes?: string;
  createdAt?: string;
}

// =========================================================================
// AUDIT TRAIL & APP MOVEMENT LOGGING
// =========================================================================
export type AuditCategory =
  | 'Intervention Request'
  | 'Maintenance Order'
  | 'Intervention Report'
  | 'Machine Fleet'
  | 'Mold Tooling'
  | 'Stock Material'
  | 'Stock Magasin'
  | 'Delivery Note'
  | 'Users & IAM'
  | 'System Backup';

export type AuditAction =
  | 'CREATE'
  | 'VALIDATE'
  | 'REJECT'
  | 'STATUS_CHANGE'
  | 'UPDATE'
  | 'STOCK_IN'
  | 'STOCK_OUT'
  | 'IMPORT'
  | 'DELETE'
  | 'LOGIN_SWITCH'
  | 'BACKUP_CREATE'
  | 'BACKUP_RESTORE'
  | 'SYSTEM_RESET';

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO string
  category: AuditCategory;
  action: AuditAction;
  targetRef: string; // e.g. "IR-2026-0042", "OT-2026-0083", "INJ-03", "MLD-204"
  user: string; // e.g. "Aymen Chebbi (Maintenance Mgr)"
  details: string; // Plaintext summary of the action/movement
  previousState?: string;
  newState?: string;
  rejectionReason?: string;
  severity: 'info' | 'success' | 'warning' | 'danger';
  metadata?: Record<string, any>;
}

// =========================================================================
// SYSTEM BACKUP & RESTORE PAYLOAD
// =========================================================================
export interface GMAOBackupPayload {
  version: string;
  backupId: string;
  createdAt: string;
  createdBy: string;
  notes?: string;
  counts: {
    machines: number;
    molds: number;
    requests: number;
    orders: number;
    reports: number;
    stock: number;
    stockMovements: number;
    deliveryNotes: number;
    calendarEvents: number;
    users: number;
    moldMaintenances: number;
    auditLogs: number;
    productionOrders?: number;
  };
  data: {
    machines: Machine[];
    molds: Mold[];
    requests: InterventionRequest[];
    orders: MaintenanceOrder[];
    reports: InterventionReport[];
    stock: StockItem[];
    stockMovements: StockMovement[];
    deliveryNotes: DeliveryNote[];
    calendarEvents: CalendarEvent[];
    users: AppUser[];
    moldMaintenances: MoldMaintenance[];
    auditLogs?: AuditLogEntry[];
    productionOrders?: ProductionOrderOF[];
  };
}

export interface GMAOBackupSnapshotSummary {
  id: string;
  createdAt: string;
  createdBy: string;
  notes?: string;
  sizeBytes: number;
  totalRecords: number;
}
