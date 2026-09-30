import {
  InterventionRequest,
  MaintenanceOrder,
  InterventionReport,
  Machine,
  Mold,
  StockItem,
  StockMovement,
  MaterialInputRecord,
  MaterialOutputRecord,
  DeliveryNote,
  CalendarEvent,
  AppUser,
  MoldMaintenance,
} from '../types/gmao';

export const INITIAL_MACHINES: Machine[] = [];

export const INITIAL_MOLDS: Mold[] = [];

export const INITIAL_MOLD_MAINTENANCES: MoldMaintenance[] = [];

export const INITIAL_INTERVENTION_REQUESTS: InterventionRequest[] = [];

export const INITIAL_MAINTENANCE_ORDERS: MaintenanceOrder[] = [];

export const INITIAL_INTERVENTION_REPORTS: InterventionReport[] = [];

export const INITIAL_STOCK: StockItem[] = [];

export const INITIAL_STOCK_MOVEMENTS: StockMovement[] = [];

export const INITIAL_DELIVERY_NOTES: DeliveryNote[] = [];

export const INITIAL_CALENDAR_EVENTS: CalendarEvent[] = [];

export const INITIAL_USERS: AppUser[] = [
  {
    id: 'usr-admin',
    name: 'Administrator',
    username: 'admin',
    password: 'admin2026',
    email: 'admin@thermoplastics.tn',
    phone: '',
    role: 'admin',
    department: 'Direction & Maintenance',
    shift: 'General (Day)',
    status: 'Active',
    lastLogin: new Date().toISOString().replace('T', ' ').slice(0, 16),
    avatarColor: '#2563eb',
    specialty: 'System Administrator & Maintenance Direction',
  },
];

export const INITIAL_MATERIAL_INPUTS: MaterialInputRecord[] = [];

export const INITIAL_MATERIAL_OUTPUTS: MaterialOutputRecord[] = [];
