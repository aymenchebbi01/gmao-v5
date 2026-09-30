import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import fs from 'fs';
import path from 'path';
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
} from '../data/mockData';
import { INITIAL_AUDIT_LOGS } from '../lib/auditLogger';
import {
  Machine,
  Mold,
  InterventionRequest,
  MaintenanceOrder,
  InterventionReport,
  StockItem,
  StockMovement,
  MaterialItem,
  MaterialMovement,
  DeliveryNote,
  CalendarEvent,
  AppUser,
  MoldMaintenance,
  AuditLogEntry,
  GMAOBackupSnapshotSummary,
} from '../types/gmao';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'gmao.sqlite');

const INITIAL_MATERIALS_LIST: MaterialItem[] = [];

const INITIAL_MATERIAL_MOVEMENTS_LIST: MaterialMovement[] = [];

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

/**
 * Persists the in-memory SQLite database state to the physical file on disk
 */
export function persistDatabase(): void {
  if (!db) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('[SQLite] Failed to persist database to disk:', err);
  }
}

/**
 * Initializes SQLite database, creates tables & indexes, and seeds factory data if empty
 */
export async function initializeDatabase(): Promise<Database> {
  if (db) return db;

  if (!SQL) {
    SQL = await initSqlJs();
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const fileExists = fs.existsSync(DB_FILE);

  if (fileExists) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(fileBuffer);
      console.log(`[SQLite] Loaded existing database from ${DB_FILE}`);
    } catch (err) {
      console.warn(`[SQLite] Could not read existing DB file (${err}). Creating new.`);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
    console.log(`[SQLite] Creating fresh SQLite database at ${DB_FILE}`);
  }

  // Create relational tables
  db.run(`
    CREATE TABLE IF NOT EXISTS db_metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS machines (
      id TEXT PRIMARY KEY,
      number TEXT,
      name TEXT,
      brand TEXT,
      model TEXT,
      status TEXT,
      location TEXT,
      line TEXT,
      active_mold_ref TEXT,
      data TEXT,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_machines_number ON machines(number);
    CREATE INDEX IF NOT EXISTS idx_machines_status ON machines(status);

    CREATE TABLE IF NOT EXISTS molds (
      id TEXT PRIMARY KEY,
      mold_number TEXT,
      ref TEXT,
      status TEXT,
      description TEXT,
      location TEXT,
      customer TEXT,
      data TEXT,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_molds_number ON molds(mold_number);
    CREATE INDEX IF NOT EXISTS idx_molds_status ON molds(status);

    CREATE TABLE IF NOT EXISTS intervention_requests (
      id TEXT PRIMARY KEY,
      ref_ir TEXT UNIQUE,
      date TEXT,
      problem_description TEXT,
      requester TEXT,
      status TEXT,
      validated_by TEXT,
      category TEXT,
      equipment_id TEXT,
      equipment_name TEXT,
      priority TEXT,
      data TEXT,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_ir_ref ON intervention_requests(ref_ir);
    CREATE INDEX IF NOT EXISTS idx_ir_status ON intervention_requests(status);

    CREATE TABLE IF NOT EXISTS maintenance_orders (
      id TEXT PRIMARY KEY,
      ref_ot TEXT UNIQUE,
      ref_ir TEXT,
      date TEXT,
      category TEXT,
      status TEXT,
      priority TEXT,
      assigned_to TEXT,
      equipment_name TEXT,
      scheduled_date TEXT,
      validation_progress INTEGER DEFAULT 0,
      data TEXT,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_ot_ref ON maintenance_orders(ref_ot);
    CREATE INDEX IF NOT EXISTS idx_ot_status ON maintenance_orders(status);

    CREATE TABLE IF NOT EXISTS intervention_reports (
      id TEXT PRIMARY KEY,
      ref_report TEXT UNIQUE,
      ref_ot TEXT,
      ref_ir TEXT,
      date TEXT,
      category TEXT,
      status TEXT,
      technician_name TEXT,
      duration_minutes INTEGER,
      data TEXT,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_reports_ref ON intervention_reports(ref_report);
    CREATE INDEX IF NOT EXISTS idx_reports_ot ON intervention_reports(ref_ot);

    CREATE TABLE IF NOT EXISTS stock_items (
      id TEXT PRIMARY KEY,
      part_number TEXT UNIQUE,
      name TEXT,
      category TEXT,
      current_qty REAL,
      min_qty REAL,
      unit TEXT,
      shelf_location TEXT,
      unit_price REAL,
      data TEXT,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_stock_part_number ON stock_items(part_number);
    CREATE INDEX IF NOT EXISTS idx_stock_category ON stock_items(category);

    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      date TEXT,
      item_id TEXT,
      part_number TEXT,
      item_name TEXT,
      type TEXT,
      qty REAL,
      operator TEXT,
      reason TEXT,
      data TEXT,
      created_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_stock_mov_date ON stock_movements(date);

    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      item TEXT UNIQUE,
      description TEXT,
      sub_family TEXT,
      unit TEXT,
      current_stock REAL,
      min_stock REAL,
      location TEXT,
      last_movement_date TEXT,
      unit_price REAL,
      data TEXT,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_materials_item ON materials(item);

    CREATE TABLE IF NOT EXISTS material_movements (
      id TEXT PRIMARY KEY,
      item_ref TEXT,
      description TEXT,
      sub_family TEXT,
      quantity REAL,
      unit TEXT,
      movement_type TEXT,
      location TEXT,
      date TEXT,
      performed_by TEXT,
      notes TEXT,
      created_at TEXT,
      data TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_mat_mov_ref ON material_movements(item_ref);
    CREATE INDEX IF NOT EXISTS idx_mat_mov_date ON material_movements(date);

    CREATE TABLE IF NOT EXISTS delivery_notes (
      id TEXT PRIMARY KEY,
      ref_bl TEXT UNIQUE,
      date TEXT,
      supplier TEXT,
      received_by TEXT,
      total_items INTEGER,
      total_amount REAL,
      status TEXT,
      data TEXT,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_dn_ref ON delivery_notes(ref_bl);

    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      title TEXT,
      date TEXT,
      type TEXT,
      equipment_ref TEXT,
      assigned_to TEXT,
      completed INTEGER,
      data TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      username TEXT UNIQUE,
      password TEXT,
      email TEXT,
      phone TEXT,
      role TEXT,
      department TEXT,
      shift TEXT,
      status TEXT,
      data TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS mold_maintenances (
      id TEXT PRIMARY KEY,
      mold_id TEXT,
      mold_number TEXT,
      date TEXT,
      repair_location TEXT,
      status TEXT,
      issue_description TEXT,
      data TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT,
      category TEXT,
      action TEXT,
      target_ref TEXT,
      user TEXT,
      details TEXT,
      severity TEXT,
      data TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_logs(category);

    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      created_at TEXT,
      created_by TEXT,
      notes TEXT,
      total_records INTEGER,
      size_bytes INTEGER,
      data TEXT
    );
    CREATE TABLE IF NOT EXISTS production_orders_of (
      id TEXT PRIMARY KEY,
      of_number TEXT,
      title TEXT,
      machine_name TEXT,
      mold_name TEXT,
      status TEXT,
      date TEXT,
      data TEXT,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_ofs_number ON production_orders_of(of_number);
    CREATE INDEX IF NOT EXISTS idx_ofs_status ON production_orders_of(status);
  `);

  try {
    db.run('ALTER TABLE users ADD COLUMN password TEXT;');
  } catch {}

  try {
    db.run('ALTER TABLE maintenance_orders ADD COLUMN validation_progress INTEGER DEFAULT 0;');
  } catch {}

  // Check if initialization is needed
  const initCheck = db.exec("SELECT value FROM db_metadata WHERE key = 'initialized';");
  const isInitialized = initCheck.length > 0 && initCheck[0].values.length > 0;

  if (!isInitialized) {
    console.log('[SQLite] Fresh database detected. Initializing GMAO production tables...');
    seedDatabase(db);
    db.run("INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('initialized', 'true');");
    persistDatabase();
  }

  // Record database metadata
  db.run("INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('engine', 'SQLite 3 (WASM / sql.js)');");
  db.run("INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('initialized_at', ?);", [new Date().toISOString()]);
  db.run("INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('app', 'Thermoplastics Tunisia GMAO');");

  persistDatabase();
  return db;
}

/**
 * Seeds initial mock data into SQLite tables
 */
function seedDatabase(database: Database): void {
  const now = new Date().toISOString();

  // Machines
  for (const m of INITIAL_MACHINES) {
    database.run(
      `INSERT OR REPLACE INTO machines (id, number, name, brand, model, status, location, line, active_mold_ref, data, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [m.id, m.number, m.name || '', m.brand || '', m.model || '', m.status, m.location || '', m.line || '', m.activeMoldRef || '', JSON.stringify(m), now]
    );
  }

  // Molds
  for (const mold of INITIAL_MOLDS) {
    const num = mold.moldNumber || mold.ref || mold.id;
    database.run(
      `INSERT OR REPLACE INTO molds (id, mold_number, ref, status, description, location, customer, data, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [mold.id, num, mold.ref || num, mold.status, mold.description || '', mold.location || '', mold.customer || '', JSON.stringify(mold), now]
    );
  }

  // Intervention Requests
  for (const ir of INITIAL_INTERVENTION_REQUESTS) {
    database.run(
      `INSERT OR REPLACE INTO intervention_requests (id, ref_ir, date, problem_description, requester, status, validated_by, category, equipment_id, equipment_name, priority, data, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ir.id, ir.refIR, ir.date, ir.problemDescription, ir.requester, ir.status, ir.validatedBy || '', ir.category || 'Machine', ir.equipmentId || '', ir.equipmentName || '', ir.priority || 'Medium', JSON.stringify(ir), now]
    );
  }

  // Maintenance Orders
  for (const ot of INITIAL_MAINTENANCE_ORDERS) {
    database.run(
      `INSERT OR REPLACE INTO maintenance_orders (id, ref_ot, ref_ir, date, category, status, priority, assigned_to, equipment_name, scheduled_date, data, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ot.id, ot.refOT, ot.refIR, ot.date, ot.category, ot.status, ot.priority, ot.assignedTo, ot.equipmentName, ot.scheduledDate || '', JSON.stringify(ot), now]
    );
  }

  // Intervention Reports
  for (const rep of INITIAL_INTERVENTION_REPORTS) {
    database.run(
      `INSERT OR REPLACE INTO intervention_reports (id, ref_report, ref_ot, ref_ir, date, category, status, technician_name, duration_minutes, data, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [rep.id, rep.refReport, rep.refOT, rep.refIR, rep.date, rep.category, rep.status, rep.technicianName || rep.assignedTo || '', rep.durationMinutes || 0, JSON.stringify(rep), now]
    );
  }

  // Stock Items
  for (const stk of INITIAL_STOCK) {
    database.run(
      `INSERT OR REPLACE INTO stock_items (id, part_number, name, category, current_qty, min_qty, unit, shelf_location, unit_price, data, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [stk.id, stk.partNumber, stk.name, stk.category, stk.currentQty, stk.minQty, stk.unit, stk.shelfLocation, stk.unitPrice, JSON.stringify(stk), now]
    );
  }

  // Stock Movements
  for (const sm of INITIAL_STOCK_MOVEMENTS) {
    database.run(
      `INSERT OR REPLACE INTO stock_movements (id, date, item_id, part_number, item_name, type, qty, operator, reason, data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sm.id, sm.date, sm.itemId, sm.partNumber, sm.itemName, sm.type, sm.qty, sm.operator, sm.reason, JSON.stringify(sm), now]
    );
  }

  // Raw Materials
  for (const mat of INITIAL_MATERIALS_LIST) {
    const matId = mat.id || `mat-${mat.item}`;
    database.run(
      `INSERT OR REPLACE INTO materials (id, item, description, sub_family, unit, current_stock, min_stock, location, last_movement_date, unit_price, data, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [matId, mat.item, mat.description || '', mat.subFamily || '', mat.unit, mat.currentStock, mat.minStock || 0, mat.location || '', mat.lastMovementDate || '', mat.unitPrice || 0, JSON.stringify(mat), now]
    );
  }

  // Raw Material Movements
  for (const mm of INITIAL_MATERIAL_MOVEMENTS_LIST) {
    database.run(
      `INSERT OR REPLACE INTO material_movements (id, item_ref, description, sub_family, quantity, unit, movement_type, location, date, performed_by, notes, created_at, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [mm.id, mm.itemRef, mm.description || '', mm.subFamily || '', mm.quantity, mm.unit, mm.movementType, mm.location || '', mm.date, mm.performedBy || '', mm.notes || '', mm.createdAt || now, JSON.stringify(mm)]
    );
  }

  // Delivery Notes
  for (const dn of INITIAL_DELIVERY_NOTES) {
    database.run(
      `INSERT OR REPLACE INTO delivery_notes (id, ref_bl, date, supplier, received_by, total_items, total_amount, status, data, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [dn.id, dn.refBL, dn.date, dn.supplier, dn.receivedBy, dn.totalItems, dn.totalAmount, dn.status, JSON.stringify(dn), now]
    );
  }

  // Calendar Events
  for (const cal of INITIAL_CALENDAR_EVENTS) {
    database.run(
      `INSERT OR REPLACE INTO calendar_events (id, title, date, type, equipment_ref, assigned_to, completed, data, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cal.id, cal.title, cal.date, cal.type, cal.equipmentRef, cal.assignedTo, cal.completed ? 1 : 0, JSON.stringify(cal), now]
    );
  }

  // Users
  for (const u of INITIAL_USERS) {
    database.run(
      `INSERT OR REPLACE INTO users (id, name, username, password, email, phone, role, department, shift, status, data, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.id, u.name, u.username, u.password || '', u.email, u.phone, u.role, u.department, u.shift, u.status, JSON.stringify(u), now]
    );
  }

  // Mold Maintenances
  for (const mm of INITIAL_MOLD_MAINTENANCES) {
    database.run(
      `INSERT OR REPLACE INTO mold_maintenances (id, mold_id, mold_number, date, repair_location, status, issue_description, data, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [mm.id, mm.moldId, mm.moldNumber, mm.date, mm.repairLocation, mm.status, mm.issueDescription, JSON.stringify(mm), now]
    );
  }

  // Audit Logs
  for (const aud of INITIAL_AUDIT_LOGS) {
    database.run(
      `INSERT OR REPLACE INTO audit_logs (id, timestamp, category, action, target_ref, user, details, severity, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [aud.id, aud.timestamp, aud.category, aud.action, aud.targetRef, aud.user, aud.details, aud.severity, JSON.stringify(aud)]
    );
  }

  console.log('[SQLite] All initial production data successfully seeded into SQLite.');
}

/**
 * Executes a custom SQL statement and returns formatted result rows
 */
export async function executeSql(sql: string, params: any[] = []): Promise<{
  columns: string[];
  values: any[][];
  rows: Record<string, any>[];
  rowsAffected?: number;
}> {
  const database = await initializeDatabase();
  const trimmed = sql.trim();
  const isSelect = /^SELECT/i.test(trimmed) || /^PRAGMA/i.test(trimmed) || /^EXPLAIN/i.test(trimmed);

  if (isSelect) {
    const res = database.exec(sql, params);
    if (res.length === 0) {
      return { columns: [], values: [], rows: [] };
    }
    const columns = res[0].columns;
    const values = res[0].values;
    const rows = values.map((row) => {
      const obj: Record<string, any> = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
    return { columns, values, rows };
  } else {
    database.run(sql, params);
    persistDatabase();
    return { columns: [], values: [], rows: [], rowsAffected: 1 };
  }
}

/**
 * Returns database information, table counts, file size
 */
export async function getDatabaseStats(): Promise<{
  engine: string;
  filePath: string;
  fileSizeBytes: number;
  tables: Record<string, number>;
  totalRows: number;
  lastPersisted: string;
}> {
  const database = await initializeDatabase();
  const tables = [
    'machines',
    'molds',
    'intervention_requests',
    'maintenance_orders',
    'intervention_reports',
    'stock_items',
    'stock_movements',
    'materials',
    'material_movements',
    'delivery_notes',
    'calendar_events',
    'users',
    'mold_maintenances',
    'audit_logs',
    'snapshots',
  ];

  const tableCounts: Record<string, number> = {};
  let totalRows = 0;

  for (const table of tables) {
    try {
      const res = database.exec(`SELECT COUNT(*) FROM ${table};`);
      const count = res.length > 0 && res[0].values[0] ? Number(res[0].values[0][0]) : 0;
      tableCounts[table] = count;
      totalRows += count;
    } catch {
      tableCounts[table] = 0;
    }
  }

  let sizeBytes = 0;
  let lastPersisted = new Date().toISOString();
  if (fs.existsSync(DB_FILE)) {
    const stat = fs.statSync(DB_FILE);
    sizeBytes = stat.size;
    lastPersisted = stat.mtime.toISOString();
  }

  return {
    engine: 'SQLite 3 (WASM / sql.js)',
    filePath: DB_FILE,
    fileSizeBytes: sizeBytes,
    tables: tableCounts,
    totalRows,
    lastPersisted,
  };
}

/**
 * Returns raw SQLite binary buffer for download
 */
export async function getDatabaseBinary(): Promise<Buffer> {
  const database = await initializeDatabase();
  persistDatabase();
  return fs.readFileSync(DB_FILE);
}

/**
 * Resets SQLite database back to original factory seeds
 */
export async function resetDatabaseToSeed(): Promise<void> {
  const database = await initializeDatabase();
  const tables = [
    'machines',
    'molds',
    'intervention_requests',
    'maintenance_orders',
    'intervention_reports',
    'stock_items',
    'stock_movements',
    'materials',
    'material_movements',
    'delivery_notes',
    'calendar_events',
    'users',
    'mold_maintenances',
    'audit_logs',
  ];

  for (const t of tables) {
    database.run(`DELETE FROM ${t};`);
  }

  seedDatabase(database);
  database.run("INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('initialized', 'true');");
  persistDatabase();
}

/**
 * REST API Data Helpers: Machines
 */
export async function getMachines(): Promise<Machine[]> {
  const database = await initializeDatabase();
  const res = database.exec('SELECT data FROM machines ORDER BY number ASC;');
  if (res.length === 0) return [];
  return res[0].values.map((v) => JSON.parse(v[0] as string));
}

export async function upsertMachine(m: Machine): Promise<Machine> {
  const database = await initializeDatabase();
  const now = new Date().toISOString();
  database.run(
    `INSERT OR REPLACE INTO machines (id, number, name, brand, model, status, location, line, active_mold_ref, data, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [m.id, m.number, m.name || '', m.brand || '', m.model || '', m.status, m.location || '', m.line || '', m.activeMoldRef || '', JSON.stringify(m), now]
  );
  persistDatabase();
  return m;
}

export async function deleteMachine(id: string): Promise<boolean> {
  const database = await initializeDatabase();
  database.run('DELETE FROM machines WHERE id = ?;', [id]);
  persistDatabase();
  return true;
}

/**
 * REST API Data Helpers: Molds
 */
export async function getMolds(): Promise<Mold[]> {
  const database = await initializeDatabase();
  const res = database.exec('SELECT data FROM molds ORDER BY mold_number ASC;');
  if (res.length === 0) return [];
  return res[0].values.map((v) => JSON.parse(v[0] as string));
}

export async function upsertMold(mold: Mold): Promise<Mold> {
  const database = await initializeDatabase();
  const now = new Date().toISOString();
  const num = mold.moldNumber || mold.ref || mold.id;
  database.run(
    `INSERT OR REPLACE INTO molds (id, mold_number, ref, status, description, location, customer, data, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [mold.id, num, mold.ref || num, mold.status, mold.description || '', mold.location || '', mold.customer || '', JSON.stringify(mold), now]
  );
  persistDatabase();
  return mold;
}

export async function deleteMold(id: string): Promise<boolean> {
  const database = await initializeDatabase();
  database.run('DELETE FROM molds WHERE id = ?;', [id]);
  persistDatabase();
  return true;
}

/**
 * REST API Data Helpers: Intervention Requests
 */
export async function getInterventionRequests(): Promise<InterventionRequest[]> {
  const database = await initializeDatabase();
  const res = database.exec('SELECT data FROM intervention_requests ORDER BY date DESC, ref_ir DESC;');
  if (res.length === 0) return [];
  return res[0].values.map((v) => JSON.parse(v[0] as string));
}

export async function upsertInterventionRequest(ir: InterventionRequest): Promise<InterventionRequest> {
  const database = await initializeDatabase();
  const now = new Date().toISOString();
  database.run(
    `INSERT OR REPLACE INTO intervention_requests (id, ref_ir, date, problem_description, requester, status, validated_by, category, equipment_id, equipment_name, priority, data, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [ir.id, ir.refIR, ir.date, ir.problemDescription, ir.requester, ir.status, ir.validatedBy || '', ir.category || 'Machine', ir.equipmentId || '', ir.equipmentName || '', ir.priority || 'Medium', JSON.stringify(ir), now]
  );
  persistDatabase();
  return ir;
}

export async function deleteInterventionRequest(id: string): Promise<boolean> {
  const database = await initializeDatabase();
  database.run('DELETE FROM intervention_requests WHERE id = ?;', [id]);
  persistDatabase();
  return true;
}

/**
 * REST API Data Helpers: Production Orders OF
 */
export async function getProductionOrdersOF(): Promise<any[]> {
  const database = await initializeDatabase();
  const res = database.exec('SELECT data FROM production_orders_of ORDER BY date DESC;');
  if (res.length === 0) return [];
  return res[0].values.map((v) => JSON.parse(v[0] as string));
}

export async function upsertProductionOrderOF(ofItem: any): Promise<any> {
  const database = await initializeDatabase();
  const now = new Date().toISOString();

  // If record exists, merge to prevent wiping out pdfUrl, pdfFileName or other fields on partial updates
  let fullItem = { ...ofItem };
  if (ofItem.id) {
    try {
      const existingRes = database.exec('SELECT data FROM production_orders_of WHERE id = ?;', [ofItem.id]);
      if (existingRes.length > 0 && existingRes[0].values.length > 0) {
        const existingData = JSON.parse(existingRes[0].values[0][0] as string);
        fullItem = { ...existingData, ...ofItem };
      }
    } catch {
      // fallback to ofItem
    }
  }

  database.run(
    `INSERT OR REPLACE INTO production_orders_of (id, of_number, title, machine_name, mold_name, status, date, data, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fullItem.id,
      fullItem.ofNumber || '',
      fullItem.title || '',
      fullItem.machineName || '',
      fullItem.moldName || '',
      fullItem.status || 'Pending',
      fullItem.date || now.split('T')[0],
      JSON.stringify(fullItem),
      now
    ]
  );
  persistDatabase();
  return fullItem;
}

export async function deleteProductionOrderOF(id: string): Promise<boolean> {
  const database = await initializeDatabase();
  database.run('DELETE FROM production_orders_of WHERE id = ?;', [id]);
  persistDatabase();
  return true;
}

/**
 * REST API Data Helpers: Maintenance Orders
 */
export async function getMaintenanceOrders(): Promise<MaintenanceOrder[]> {
  const database = await initializeDatabase();
  const res = database.exec('SELECT data FROM maintenance_orders ORDER BY date DESC, ref_ot DESC;');
  if (res.length === 0) return [];
  return res[0].values.map((v) => JSON.parse(v[0] as string));
}

export async function upsertMaintenanceOrder(ot: MaintenanceOrder): Promise<MaintenanceOrder> {
  const database = await initializeDatabase();
  const now = new Date().toISOString();
  database.run(
    `INSERT OR REPLACE INTO maintenance_orders (id, ref_ot, ref_ir, date, category, status, priority, assigned_to, equipment_name, scheduled_date, data, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [ot.id, ot.refOT, ot.refIR, ot.date, ot.category, ot.status, ot.priority, ot.assignedTo, ot.equipmentName, ot.scheduledDate || '', JSON.stringify(ot), now]
  );
  persistDatabase();
  return ot;
}

export async function deleteMaintenanceOrder(id: string): Promise<boolean> {
  const database = await initializeDatabase();
  database.run('DELETE FROM maintenance_orders WHERE id = ?;', [id]);
  persistDatabase();
  return true;
}

/**
 * REST API Data Helpers: Intervention Reports
 */
export async function getInterventionReports(): Promise<InterventionReport[]> {
  const database = await initializeDatabase();
  const res = database.exec('SELECT data FROM intervention_reports ORDER BY date DESC, updated_at DESC, ref_report DESC;');
  if (res.length === 0) return [];
  const all: InterventionReport[] = res[0].values.map((v) => JSON.parse(v[0] as string));

  // Enforce one row per work order (refOT)
  const seenOT = new Set<string>();
  const deduplicated: InterventionReport[] = [];
  for (const rep of all) {
    const key = (rep.refOT || rep.id).trim().toUpperCase();
    if (!seenOT.has(key)) {
      seenOT.add(key);
      deduplicated.push(rep);
    }
  }
  return deduplicated;
}

export async function upsertInterventionReport(rep: InterventionReport): Promise<InterventionReport> {
  const database = await initializeDatabase();
  const now = new Date().toISOString();

  let targetId = rep.id;
  let targetRefReport = rep.refReport;
  let existingData: Partial<InterventionReport> = {};

  if (rep.refOT) {
    // Check if a report with the same ref_ot already exists
    const existing = database.exec(
      'SELECT id, ref_report, data FROM intervention_reports WHERE ref_ot = ? LIMIT 1;',
      [rep.refOT]
    );
    if (existing.length > 0 && existing[0].values.length > 0) {
      targetId = (existing[0].values[0][0] as string) || targetId;
      targetRefReport = (existing[0].values[0][1] as string) || targetRefReport;
      try {
        existingData = JSON.parse(existing[0].values[0][2] as string);
      } catch {}
    }
  }

  // Ensure sequential reference format: REP-YYYY-XXXX (e.g. REP-2026-0001)
  if (!targetRefReport) {
    const year = new Date(rep.date || now).getFullYear();
    const prefix = `REP-${year}-`;
    const existingReports = database.exec(`SELECT ref_report FROM intervention_reports WHERE ref_report LIKE '${prefix}%';`);
    let maxSeq = 0;
    if (existingReports.length > 0 && existingReports[0].values) {
      for (const row of existingReports[0].values) {
        const ref = row[0] as string;
        if (ref && ref.startsWith(prefix)) {
          const parts = ref.split('-');
          const num = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      }
    }
    targetRefReport = `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
  }

  // Merge so existing fields are preserved and newer values take precedence
  const finalReport: InterventionReport = {
    ...existingData,
    ...rep,
    id: targetId,
    refReport: targetRefReport,
  };

  database.run(
    `INSERT OR REPLACE INTO intervention_reports (id, ref_report, ref_ot, ref_ir, date, category, status, technician_name, duration_minutes, data, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      finalReport.id,
      finalReport.refReport,
      finalReport.refOT,
      finalReport.refIR,
      finalReport.date,
      finalReport.category,
      finalReport.status,
      finalReport.technicianName || finalReport.assignedTo || '',
      finalReport.durationMinutes || 0,
      JSON.stringify(finalReport),
      now,
    ]
  );

  // Keep maintenance_orders in sync with reportRef
  if (finalReport.refOT) {
    try {
      const orderRes = database.exec(
        'SELECT id, data FROM maintenance_orders WHERE ref_ot = ? LIMIT 1;',
        [finalReport.refOT]
      );
      if (orderRes.length > 0 && orderRes[0].values.length > 0) {
        const orderId = orderRes[0].values[0][0] as string;
        const orderDataStr = orderRes[0].values[0][1] as string;
        const orderObj = JSON.parse(orderDataStr);
        orderObj.reportRef = finalReport.refReport;
        orderObj.status = 'Waiting work validation';
        orderObj.validationProgress = Math.max(orderObj.validationProgress || 0, 75);
        try {
          database.run(
            `UPDATE maintenance_orders SET status = ?, validation_progress = ?, data = ?, updated_at = ? WHERE id = ?`,
            [orderObj.status, orderObj.validationProgress, JSON.stringify(orderObj), now, orderId]
          );
        } catch {
          database.run(
            `UPDATE maintenance_orders SET status = ?, data = ?, updated_at = ? WHERE id = ?`,
            [orderObj.status, JSON.stringify(orderObj), now, orderId]
          );
        }
      }
    } catch (e) {
      console.warn('[SQLite] Could not sync maintenance order for report:', e);
    }
  }

  persistDatabase();
  return finalReport;
}

export async function deleteInterventionReport(id: string): Promise<boolean> {
  const database = await initializeDatabase();
  database.run('DELETE FROM intervention_reports WHERE id = ?;', [id]);
  persistDatabase();
  return true;
}

/**
 * REST API Data Helpers: Stock Items
 */
export async function getStockItems(): Promise<StockItem[]> {
  const database = await initializeDatabase();
  const res = database.exec('SELECT data FROM stock_items ORDER BY part_number ASC;');
  if (res.length === 0) return [];
  return res[0].values.map((v) => JSON.parse(v[0] as string));
}

export async function upsertStockItem(item: StockItem): Promise<StockItem> {
  const database = await initializeDatabase();
  const now = new Date().toISOString();
  database.run(
    `INSERT OR REPLACE INTO stock_items (id, part_number, name, category, current_qty, min_qty, unit, shelf_location, unit_price, data, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [item.id, item.partNumber, item.name, item.category, item.currentQty, item.minQty, item.unit, item.shelfLocation, item.unitPrice, JSON.stringify(item), now]
  );
  persistDatabase();
  return item;
}

export async function batchUpsertStockItems(items: StockItem[]): Promise<StockItem[]> {
  const database = await initializeDatabase();
  const now = new Date().toISOString();
  database.run('BEGIN TRANSACTION;');
  try {
    for (const item of items) {
      database.run(
        `INSERT OR REPLACE INTO stock_items (id, part_number, name, category, current_qty, min_qty, unit, shelf_location, unit_price, data, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [item.id, item.partNumber, item.name, item.category, item.currentQty, item.minQty, item.unit, item.shelfLocation, item.unitPrice, JSON.stringify(item), now]
      );
    }
    database.run('COMMIT;');
  } catch (e) {
    database.run('ROLLBACK;');
    throw e;
  }
  persistDatabase();
  return items;
}

export async function deleteStockItem(id: string): Promise<boolean> {
  const database = await initializeDatabase();
  database.run('DELETE FROM stock_items WHERE id = ?;', [id]);
  persistDatabase();
  return true;
}

/**
 * REST API Data Helpers: Stock Movements
 */
export async function getStockMovements(): Promise<StockMovement[]> {
  const database = await initializeDatabase();
  const res = database.exec('SELECT data FROM stock_movements ORDER BY date DESC, id DESC;');
  if (res.length === 0) return [];
  return res[0].values.map((v) => JSON.parse(v[0] as string));
}

export async function addStockMovement(sm: StockMovement): Promise<StockMovement> {
  const database = await initializeDatabase();
  const now = new Date().toISOString();
  database.run(
    `INSERT OR REPLACE INTO stock_movements (id, date, item_id, part_number, item_name, type, qty, operator, reason, data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [sm.id, sm.date, sm.itemId, sm.partNumber, sm.itemName, sm.type, sm.qty, sm.operator, sm.reason, JSON.stringify(sm), now]
  );
  persistDatabase();
  return sm;
}

export async function deleteStockMovement(id: string): Promise<boolean> {
  const database = await initializeDatabase();
  database.run('DELETE FROM stock_movements WHERE id = ?;', [id]);
  persistDatabase();
  return true;
}

/**
 * REST API Data Helpers: Raw Materials & Movements
 */
export async function getMaterials(): Promise<MaterialItem[]> {
  const database = await initializeDatabase();
  const res = database.exec('SELECT data FROM materials ORDER BY item ASC;');
  if (res.length === 0) return [];
  return res[0].values.map((v) => JSON.parse(v[0] as string));
}

export async function upsertMaterial(mat: MaterialItem): Promise<MaterialItem> {
  const database = await initializeDatabase();
  const now = new Date().toISOString();
  const matId = mat.id || `mat-${mat.item.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  database.run(
    `INSERT OR REPLACE INTO materials (id, item, description, sub_family, unit, current_stock, min_stock, location, last_movement_date, unit_price, data, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [matId, mat.item.trim().toUpperCase(), mat.description || '', mat.subFamily || '', mat.unit, mat.currentStock, mat.minStock || 0, mat.location || '', mat.lastMovementDate || '', mat.unitPrice || 0, JSON.stringify(mat), now]
  );
  persistDatabase();
  return mat;
}

export async function deleteMaterial(itemRef: string): Promise<boolean> {
  const database = await initializeDatabase();
  database.run('DELETE FROM materials WHERE UPPER(item) = UPPER(?);', [itemRef.trim()]);
  database.run('DELETE FROM material_movements WHERE UPPER(item_ref) = UPPER(?);', [itemRef.trim()]);
  persistDatabase();
  return true;
}

export async function getMaterialMovements(type?: 'in' | 'out'): Promise<MaterialMovement[]> {
  const database = await initializeDatabase();
  const query = type
    ? 'SELECT data FROM material_movements WHERE movement_type = ? ORDER BY date DESC, created_at DESC;'
    : 'SELECT data FROM material_movements ORDER BY date DESC, created_at DESC;';
  const params = type ? [type] : [];
  const res = database.exec(query, params);
  if (res.length === 0) return [];
  return res[0].values.map((v) => JSON.parse(v[0] as string));
}

export async function addMaterialMovement(mov: MaterialMovement): Promise<MaterialMovement> {
  const database = await initializeDatabase();
  const now = new Date().toISOString();

  const cleanRef = mov.itemRef.trim().toUpperCase();
  const qty = Number(mov.quantity);

  if (qty < 0) {
    throw new Error(`La quantité ne peut pas être négative pour "${cleanRef}".`);
  }

  if (mov.movementType === 'out' && qty === 0) {
    throw new Error(`La quantité doit être supérieure à 0 pour une sortie "${cleanRef}".`);
  }

  // Fetch existing material (if any)
  const matRes = database.exec('SELECT data FROM materials WHERE UPPER(item) = UPPER(?);', [cleanRef]);
  const materialExists = matRes.length > 0 && matRes[0].values.length > 0;

  if (mov.movementType === 'out') {
    // 'out' requires the material to already exist with sufficient stock
    if (!materialExists) {
      throw new Error(`L'article "${cleanRef}" n'existe pas en stock. Créez d'abord une entrée pour cet article.`);
    }
    const existing: MaterialItem = JSON.parse(matRes[0].values[0][0] as string);
    const currentStock = Number(existing.currentStock) || 0;
    if (qty > currentStock) {
      throw new Error(`Stock insuffisant pour "${cleanRef}". Disponible\u00a0: ${currentStock} ${existing.unit || mov.unit}, demand\u00e9\u00a0: ${qty} ${mov.unit}.`);
    }
  }

  // Insert movement row (only after validation passes)
  database.run(
    `INSERT OR REPLACE INTO material_movements (id, item_ref, description, sub_family, quantity, unit, movement_type, location, date, performed_by, notes, created_at, data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [mov.id, cleanRef, mov.description || '', mov.subFamily || '', qty, mov.unit, mov.movementType, mov.location || '', mov.date, mov.performedBy || '', mov.notes || '', mov.createdAt || now, JSON.stringify({ ...mov, itemRef: cleanRef, quantity: qty })]
  );

  // Adjust material balance
  const delta = mov.movementType === 'in' ? qty : -qty;

  if (materialExists) {
    const existing: MaterialItem = JSON.parse(matRes[0].values[0][0] as string);
    existing.currentStock = (Number(existing.currentStock) || 0) + delta;
    existing.lastMovementDate = mov.date;
    if (mov.location) existing.location = mov.location;
    if (mov.description) existing.description = mov.description;
    await upsertMaterial(existing);
  } else {
    // Only for 'in': create new material entry
    const newMat: MaterialItem = {
      id: `mat-${Date.now()}`,
      item: cleanRef,
      description: mov.description || '',
      subFamily: mov.subFamily || 'Matière Première',
      unit: mov.unit || 'kg',
      currentStock: delta,
      location: mov.location || 'Magasin MP',
      lastMovementDate: mov.date,
      minStock: 200,
      unitPrice: 10,
    };
    await upsertMaterial(newMat);
  }

  persistDatabase();
  return { ...mov, itemRef: cleanRef, quantity: qty };
}

export async function deleteMaterialMovement(id: string): Promise<boolean> {
  const database = await initializeDatabase();

  // Read the movement first so we can reverse its effect on stock
  const movRes = database.exec('SELECT data FROM material_movements WHERE id = ?;', [id]);
  if (movRes.length > 0 && movRes[0].values.length > 0) {
    const mov: MaterialMovement = JSON.parse(movRes[0].values[0][0] as string);
    const cleanRef = (mov.itemRef || '').trim().toUpperCase();
    const qty = Number(mov.quantity) || 0;
    // Reverse: 'in' was +qty so subtract; 'out' was -qty so add back
    const reverseDelta = mov.movementType === 'in' ? -qty : qty;

    const matRes = database.exec('SELECT data FROM materials WHERE UPPER(item) = UPPER(?);', [cleanRef]);
    if (matRes.length > 0 && matRes[0].values.length > 0) {
      const existing: MaterialItem = JSON.parse(matRes[0].values[0][0] as string);
      existing.currentStock = (Number(existing.currentStock) || 0) + reverseDelta;
      await upsertMaterial(existing);
    }
  }

  database.run('DELETE FROM material_movements WHERE id = ?;', [id]);
  persistDatabase();
  return true;
}

/**
 * Update a material movement atomically: reverses the old movement, validates,
 * then applies the new one. If the new addition fails the old is restored.
 */
export async function updateMaterialMovement(
  id: string,
  updates: Partial<MaterialMovement>
): Promise<MaterialMovement | null> {
  // Load the original
  const database = await initializeDatabase();
  const movRes = database.exec('SELECT data FROM material_movements WHERE id = ?;', [id]);
  if (movRes.length === 0 || movRes[0].values.length === 0) return null;

  const original: MaterialMovement = JSON.parse(movRes[0].values[0][0] as string);

  // Snapshot DB bytes for rollback
  const snapshot = database.export();

  try {
    // Step 1: reverse the old movement (adjusts stock)
    await deleteMaterialMovement(id);

    // Step 2: apply the updated movement
    const merged: MaterialMovement = {
      ...original,
      ...updates,
      id,
      itemRef: ((updates.itemRef || original.itemRef) || '').trim().toUpperCase(),
    };
    const result = await addMaterialMovement(merged);
    persistDatabase();
    return result;
  } catch (err) {
    // Rollback: restore the snapshot
    const buf = Buffer.from(snapshot);
    fs.writeFileSync(DB_FILE, buf);
    // Re-init from restored file
    const restoredBuf = fs.readFileSync(DB_FILE);
    if (SQL) {
      db = new SQL.Database(restoredBuf);
    }
    throw err;
  }
}

/**
 * All-or-nothing batch import of material movements.
 * For 'out' batches: validates ALL rows before touching the DB.
 * On any failure: restores the DB from a snapshot.
 */
export async function batchMaterialMovements(
  movements: Array<Omit<MaterialMovement, 'id' | 'createdAt'>>,
  movementType: 'in' | 'out',
  performedBy = 'Import Excel'
): Promise<{ count: number }> {
  const database = await initializeDatabase();

  // Snapshot for rollback
  const snapshot = database.export();

  try {
    // For 'out': pre-validate ALL rows using a running stock ledger (no DB writes yet)
    if (movementType === 'out') {
      // Build in-memory ledger of current stocks
      const ledger = new Map<string, number>();
      const allMats = await getMaterials();
      for (const m of allMats) {
        ledger.set(m.item.trim().toUpperCase(), Number(m.currentStock) || 0);
      }

      // Sum requested quantities per item and check sufficiency
      const requested = new Map<string, number>();
      for (const row of movements) {
        const ref = (row.itemRef || '').trim().toUpperCase();
        requested.set(ref, (requested.get(ref) || 0) + (Number(row.quantity) || 0));
      }

      for (const [ref, totalQty] of requested) {
        if (!ledger.has(ref)) {
          throw new Error(`L'article "${ref}" n'existe pas en stock. Importation annulée.`);
        }
        const available = ledger.get(ref)!;
        if (totalQty > available) {
          throw new Error(`Stock insuffisant pour "${ref}". Disponible\u00a0: ${available}, demand\u00e9\u00a0: ${totalQty}. Importation annulée.`);
        }
      }
    }

    // Process all rows
    let count = 0;
    for (const row of movements) {
      const now = new Date().toISOString();
      const mov: MaterialMovement = {
        id: `mov-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        itemRef: (row.itemRef || '').trim().toUpperCase(),
        description: row.description || '',
        subFamily: row.subFamily || '',
        unit: row.unit || 'kg',
        quantity: Number(row.quantity) || 0,
        movementType,
        location: row.location || '',
        date: row.date || now.split('T')[0],
        notes: row.notes || 'Import Excel',
        performedBy: row.performedBy || performedBy,
        createdAt: now,
      };
      await addMaterialMovement(mov);
      count++;
    }

    // Single persist at the end
    persistDatabase();
    return { count };
  } catch (err) {
    // Rollback: restore snapshot
    const buf = Buffer.from(snapshot);
    fs.writeFileSync(DB_FILE, buf);
    if (SQL) {
      db = new SQL.Database(fs.readFileSync(DB_FILE));
    }
    throw err;
  }
}

/**
 * REST API Data Helpers: Delivery Notes
 */
export async function getDeliveryNotes(): Promise<DeliveryNote[]> {
  const database = await initializeDatabase();
  const res = database.exec('SELECT data FROM delivery_notes ORDER BY date DESC, ref_bl DESC;');
  if (res.length === 0) return [];
  return res[0].values.map((v) => JSON.parse(v[0] as string));
}

export async function upsertDeliveryNote(dn: DeliveryNote): Promise<DeliveryNote> {
  const database = await initializeDatabase();
  const now = new Date().toISOString();
  database.run(
    `INSERT OR REPLACE INTO delivery_notes (id, ref_bl, date, supplier, received_by, total_items, total_amount, status, data, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [dn.id, dn.refBL, dn.date, dn.supplier, dn.receivedBy, dn.totalItems, dn.totalAmount, dn.status, JSON.stringify(dn), now]
  );
  persistDatabase();
  return dn;
}

export async function deleteDeliveryNote(id: string): Promise<boolean> {
  const database = await initializeDatabase();
  database.run('DELETE FROM delivery_notes WHERE id = ?;', [id]);
  persistDatabase();
  return true;
}

/**
 * REST API Data Helpers: Calendar Events
 */
export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const database = await initializeDatabase();
  const res = database.exec('SELECT data FROM calendar_events ORDER BY date ASC;');
  if (res.length === 0) return [];
  return res[0].values.map((v) => JSON.parse(v[0] as string));
}

export async function upsertCalendarEvent(ev: CalendarEvent): Promise<CalendarEvent> {
  const database = await initializeDatabase();
  const now = new Date().toISOString();
  database.run(
    `INSERT OR REPLACE INTO calendar_events (id, title, date, type, equipment_ref, assigned_to, completed, data, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [ev.id, ev.title, ev.date, ev.type, ev.equipmentRef, ev.assignedTo, ev.completed ? 1 : 0, JSON.stringify(ev), now]
  );
  persistDatabase();
  return ev;
}

export async function deleteCalendarEvent(id: string): Promise<boolean> {
  const database = await initializeDatabase();
  database.run('DELETE FROM calendar_events WHERE id = ?;', [id]);
  persistDatabase();
  return true;
}

/**
 * REST API Data Helpers: Users
 */
export async function getUsers(): Promise<AppUser[]> {
  const database = await initializeDatabase();
  const res = database.exec('SELECT data FROM users ORDER BY name ASC;');
  if (res.length === 0) return [];
  return res[0].values.map((v) => JSON.parse(v[0] as string));
}

export async function upsertUser(u: AppUser): Promise<AppUser> {
  const database = await initializeDatabase();
  const now = new Date().toISOString();
  database.run(
    `INSERT OR REPLACE INTO users (id, name, username, password, email, phone, role, department, shift, status, data, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [u.id, u.name, u.username, u.password || '', u.email, u.phone, u.role, u.department, u.shift, u.status, JSON.stringify(u), now]
  );
  persistDatabase();
  return u;
}

export async function authenticateUser(username: string, password: string): Promise<AppUser | null> {
  const database = await initializeDatabase();
  const cleanUsername = username.trim().toLowerCase();
  const res = database.exec('SELECT data, password FROM users;');
  if (res.length === 0 || !res[0].values) return null;
  for (const row of res[0].values) {
    try {
      const u = JSON.parse(row[0] as string) as AppUser;
      const storedPassword = (row[1] as string) || u.password || '';
      if (u.username && u.username.toLowerCase() === cleanUsername) {
        if (!storedPassword || storedPassword === password) {
          return u;
        }
      }
    } catch {}
  }
  return null;
}

export async function findUserByUsername(username: string): Promise<AppUser | null> {
  const database = await initializeDatabase();
  const cleanUsername = username.trim().toLowerCase();
  const res = database.exec('SELECT data FROM users;');
  if (res.length === 0 || !res[0].values) return null;
  for (const row of res[0].values) {
    try {
      const u = JSON.parse(row[0] as string) as AppUser;
      if (u.username && u.username.toLowerCase() === cleanUsername) {
        return u;
      }
    } catch {}
  }
  return null;
}

export async function deleteUser(id: string): Promise<boolean> {
  const database = await initializeDatabase();
  database.run('DELETE FROM users WHERE id = ?;', [id]);
  persistDatabase();
  return true;
}

/**
 * REST API Data Helpers: Mold Maintenances
 */
export async function getMoldMaintenances(): Promise<MoldMaintenance[]> {
  const database = await initializeDatabase();
  const res = database.exec('SELECT data FROM mold_maintenances ORDER BY date DESC;');
  if (res.length === 0) return [];
  return res[0].values.map((v) => JSON.parse(v[0] as string));
}

export async function upsertMoldMaintenance(mm: MoldMaintenance): Promise<MoldMaintenance> {
  const database = await initializeDatabase();
  const now = new Date().toISOString();
  database.run(
    `INSERT OR REPLACE INTO mold_maintenances (id, mold_id, mold_number, date, repair_location, status, issue_description, data, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [mm.id, mm.moldId, mm.moldNumber, mm.date, mm.repairLocation, mm.status, mm.issueDescription, JSON.stringify(mm), now]
  );
  persistDatabase();
  return mm;
}

export async function deleteMoldMaintenance(id: string): Promise<boolean> {
  const database = await initializeDatabase();
  database.run('DELETE FROM mold_maintenances WHERE id = ?;', [id]);
  persistDatabase();
  return true;
}

/**
 * REST API Data Helpers: Audit Logs
 */
export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  const database = await initializeDatabase();
  const res = database.exec('SELECT data FROM audit_logs ORDER BY timestamp DESC LIMIT 500;');
  if (res.length === 0) return [];
  return res[0].values.map((v) => JSON.parse(v[0] as string));
}

export async function addAuditLog(entry: AuditLogEntry): Promise<AuditLogEntry> {
  const database = await initializeDatabase();
  database.run(
    `INSERT OR REPLACE INTO audit_logs (id, timestamp, category, action, target_ref, user, details, severity, data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [entry.id, entry.timestamp, entry.category, entry.action, entry.targetRef, entry.user, entry.details, entry.severity, JSON.stringify(entry)]
  );
  persistDatabase();
  return entry;
}

export async function clearAuditLogs(): Promise<void> {
  const database = await initializeDatabase();
  database.run('DELETE FROM audit_logs;');
  persistDatabase();
}

/**
 * Full state export / restore for backup management
 */
export async function getFullState(): Promise<{
  machines: Machine[];
  molds: Mold[];
  requests: InterventionRequest[];
  orders: MaintenanceOrder[];
  reports: InterventionReport[];
  stock: StockItem[];
  stockMovements: StockMovement[];
  materials: MaterialItem[];
  materialMovements: MaterialMovement[];
  deliveryNotes: DeliveryNote[];
  calendarEvents: CalendarEvent[];
  users: AppUser[];
  moldMaintenances: MoldMaintenance[];
  auditLogs: AuditLogEntry[];
  productionOrders: any[];
}> {
  const [
    machines,
    molds,
    requests,
    orders,
    reports,
    stock,
    stockMovements,
    materials,
    materialMovements,
    deliveryNotes,
    calendarEvents,
    users,
    moldMaintenances,
    auditLogs,
    productionOrders,
  ] = await Promise.all([
    getMachines(),
    getMolds(),
    getInterventionRequests(),
    getMaintenanceOrders(),
    getInterventionReports(),
    getStockItems(),
    getStockMovements(),
    getMaterials(),
    getMaterialMovements(),
    getDeliveryNotes(),
    getCalendarEvents(),
    getUsers(),
    getMoldMaintenances(),
    getAuditLogs(),
    getProductionOrdersOF(),
  ]);

  return {
    machines,
    molds,
    requests,
    orders,
    reports,
    stock,
    stockMovements,
    materials,
    materialMovements,
    deliveryNotes,
    calendarEvents,
    users,
    moldMaintenances,
    auditLogs,
    productionOrders,
  };
}

export async function restoreFullState(state: any): Promise<void> {
  const database = await initializeDatabase();
  const now = new Date().toISOString();

  // SAFE: only clear a table when the payload actually contains that key as an array.
  // This prevents App.tsx auto-saves (which never include materials/materialMovements)
  // from wiping those tables.
  const keyToTable: Record<string, string> = {
    machines: 'machines',
    molds: 'molds',
    requests: 'intervention_requests',
    orders: 'maintenance_orders',
    reports: 'intervention_reports',
    stock: 'stock_items',
    stockMovements: 'stock_movements',
    materials: 'materials',
    materialMovements: 'material_movements',
    deliveryNotes: 'delivery_notes',
    calendarEvents: 'calendar_events',
    users: 'users',
    moldMaintenances: 'mold_maintenances',
  };
  for (const [key, table] of Object.entries(keyToTable)) {
    if (Array.isArray(state[key])) {
      database.run(`DELETE FROM ${table};`);
    }
  }

  // Handle productionOrders safely: only clear and replace if non-empty array is provided
  if (Array.isArray(state.productionOrders) && state.productionOrders.length > 0) {
    database.run('DELETE FROM production_orders_of;');
    for (const ofItem of state.productionOrders) {
      database.run(
        `INSERT OR REPLACE INTO production_orders_of (id, of_number, title, machine_name, mold_name, status, date, data, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ofItem.id, ofItem.ofNumber || '', ofItem.title || '', ofItem.machineName || '', ofItem.moldName || '', ofItem.status || 'Pending', ofItem.date || now.split('T')[0], JSON.stringify(ofItem), now]
      );
    }
  }

  // Restore machines
  if (Array.isArray(state.machines)) {
    for (const m of state.machines) {
      database.run(
        `INSERT OR REPLACE INTO machines (id, number, name, brand, model, status, location, line, active_mold_ref, data, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [m.id, m.number, m.name || '', m.brand || '', m.model || '', m.status, m.location || '', m.line || '', m.activeMoldRef || '', JSON.stringify(m), now]
      );
    }
  }

  // Restore molds
  if (Array.isArray(state.molds)) {
    for (const mold of state.molds) {
      const num = mold.moldNumber || mold.ref || mold.id;
      database.run(
        `INSERT OR REPLACE INTO molds (id, mold_number, ref, status, description, location, customer, data, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [mold.id, num, mold.ref || num, mold.status, mold.description || '', mold.location || '', mold.customer || '', JSON.stringify(mold), now]
      );
    }
  }

  // Restore requests
  if (Array.isArray(state.requests)) {
    for (const ir of state.requests) {
      database.run(
        `INSERT OR REPLACE INTO intervention_requests (id, ref_ir, date, problem_description, requester, status, validated_by, category, equipment_id, equipment_name, priority, data, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ir.id, ir.refIR, ir.date, ir.problemDescription, ir.requester, ir.status, ir.validatedBy || '', ir.category || 'Machine', ir.equipmentId || '', ir.equipmentName || '', ir.priority || 'Medium', JSON.stringify(ir), now]
      );
    }
  }

  // Restore orders
  if (Array.isArray(state.orders)) {
    for (const ot of state.orders) {
      database.run(
        `INSERT OR REPLACE INTO maintenance_orders (id, ref_ot, ref_ir, date, category, status, priority, assigned_to, equipment_name, scheduled_date, data, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ot.id, ot.refOT, ot.refIR, ot.date, ot.category, ot.status, ot.priority, ot.assignedTo, ot.equipmentName, ot.scheduledDate || '', JSON.stringify(ot), now]
      );
    }
  }

  // Restore reports
  if (Array.isArray(state.reports)) {
    for (const rep of state.reports) {
      database.run(
        `INSERT OR REPLACE INTO intervention_reports (id, ref_report, ref_ot, ref_ir, date, category, status, technician_name, duration_minutes, data, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [rep.id, rep.refReport, rep.refOT, rep.refIR, rep.date, rep.category, rep.status, rep.technicianName || rep.assignedTo || '', rep.durationMinutes || 0, JSON.stringify(rep), now]
      );
    }
  }

  // Restore stock
  if (Array.isArray(state.stock)) {
    for (const stk of state.stock) {
      database.run(
        `INSERT OR REPLACE INTO stock_items (id, part_number, name, category, current_qty, min_qty, unit, shelf_location, unit_price, data, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [stk.id, stk.partNumber, stk.name, stk.category, stk.currentQty, stk.minQty, stk.unit, stk.shelfLocation, stk.unitPrice, JSON.stringify(stk), now]
      );
    }
  }

  // Restore stockMovements
  if (Array.isArray(state.stockMovements)) {
    for (const sm of state.stockMovements) {
      database.run(
        `INSERT OR REPLACE INTO stock_movements (id, date, item_id, part_number, item_name, type, qty, operator, reason, data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [sm.id, sm.date, sm.itemId, sm.partNumber, sm.itemName, sm.type, sm.qty, sm.operator, sm.reason, JSON.stringify(sm), now]
      );
    }
  }

  // Restore materials
  if (Array.isArray(state.materials)) {
    for (const mat of state.materials) {
      const matId = mat.id || `mat-${mat.item}`;
      database.run(
        `INSERT OR REPLACE INTO materials (id, item, description, sub_family, unit, current_stock, min_stock, location, last_movement_date, unit_price, data, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [matId, mat.item, mat.description || '', mat.subFamily || '', mat.unit, mat.currentStock, mat.minStock || 0, mat.location || '', mat.lastMovementDate || '', mat.unitPrice || 0, JSON.stringify(mat), now]
      );
    }
  }

  // Restore materialMovements
  if (Array.isArray(state.materialMovements)) {
    for (const mm of state.materialMovements) {
      database.run(
        `INSERT OR REPLACE INTO material_movements (id, item_ref, description, sub_family, quantity, unit, movement_type, location, date, performed_by, notes, created_at, data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [mm.id, mm.itemRef, mm.description || '', mm.subFamily || '', mm.quantity, mm.unit, mm.movementType, mm.location || '', mm.date, mm.performedBy || '', mm.notes || '', mm.createdAt || now, JSON.stringify(mm)]
      );
    }
  }

  // Restore deliveryNotes
  if (Array.isArray(state.deliveryNotes)) {
    for (const dn of state.deliveryNotes) {
      database.run(
        `INSERT OR REPLACE INTO delivery_notes (id, ref_bl, date, supplier, received_by, total_items, total_amount, status, data, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [dn.id, dn.refBL, dn.date, dn.supplier, dn.receivedBy, dn.totalItems, dn.totalAmount, dn.status, JSON.stringify(dn), now]
      );
    }
  }

  // Restore calendarEvents
  if (Array.isArray(state.calendarEvents)) {
    for (const cal of state.calendarEvents) {
      database.run(
        `INSERT OR REPLACE INTO calendar_events (id, title, date, type, equipment_ref, assigned_to, completed, data, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cal.id, cal.title, cal.date, cal.type, cal.equipmentRef, cal.assignedTo, cal.completed ? 1 : 0, JSON.stringify(cal), now]
      );
    }
  }

  // Restore users
  if (Array.isArray(state.users)) {
    for (const u of state.users) {
      database.run(
        `INSERT OR REPLACE INTO users (id, name, username, password, email, phone, role, department, shift, status, data, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [u.id, u.name, u.username, u.password || '', u.email, u.phone, u.role, u.department, u.shift, u.status, JSON.stringify(u), now]
      );
    }
  }

  // Restore moldMaintenances
  if (Array.isArray(state.moldMaintenances)) {
    for (const mm of state.moldMaintenances) {
      database.run(
        `INSERT OR REPLACE INTO mold_maintenances (id, mold_id, mold_number, date, repair_location, status, issue_description, data, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [mm.id, mm.moldId, mm.moldNumber, mm.date, mm.repairLocation, mm.status, mm.issueDescription, JSON.stringify(mm), now]
      );
    }
  }

  // Restore auditLogs
  if (Array.isArray(state.auditLogs)) {
    database.run('DELETE FROM audit_logs;');
    for (const aud of state.auditLogs) {
      database.run(
        `INSERT OR REPLACE INTO audit_logs (id, timestamp, category, action, target_ref, user, details, severity, data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [aud.id, aud.timestamp, aud.category, aud.action, aud.targetRef, aud.user, aud.details, aud.severity, JSON.stringify(aud)]
      );
    }
  }

  persistDatabase();
}

/**
 * Snapshots in SQLite
 */
export async function getSnapshots(): Promise<GMAOBackupSnapshotSummary[]> {
  const database = await initializeDatabase();
  const res = database.exec('SELECT id, created_at, created_by, notes, total_records, size_bytes FROM snapshots ORDER BY created_at DESC;');
  if (res.length === 0) return [];
  return res[0].values.map((v) => ({
    id: v[0] as string,
    createdAt: v[1] as string,
    createdBy: v[2] as string,
    notes: (v[3] as string) || '',
    totalRecords: Number(v[4]) || 0,
    sizeBytes: Number(v[5]) || 0,
  }));
}

export async function saveSnapshot(snapshot: any): Promise<void> {
  const database = await initializeDatabase();
  const payloadStr = JSON.stringify(snapshot);
  const sizeBytes = Buffer.byteLength(payloadStr, 'utf8');
  const totalRecords =
    (snapshot.counts?.machines || 0) +
    (snapshot.counts?.molds || 0) +
    (snapshot.counts?.requests || 0) +
    (snapshot.counts?.orders || 0) +
    (snapshot.counts?.reports || 0) +
    (snapshot.counts?.stock || 0);

  database.run(
    `INSERT OR REPLACE INTO snapshots (id, created_at, created_by, notes, total_records, size_bytes, data)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [snapshot.backupId || `SNAP-${Date.now()}`, snapshot.createdAt || new Date().toISOString(), snapshot.createdBy || 'Admin', snapshot.notes || '', totalRecords, sizeBytes, payloadStr]
  );
  persistDatabase();
}

export async function getSnapshotById(id: string): Promise<any | null> {
  const database = await initializeDatabase();
  const res = database.exec('SELECT data FROM snapshots WHERE id = ?;', [id]);
  if (res.length === 0 || res[0].values.length === 0) return null;
  return JSON.parse(res[0].values[0][0] as string);
}

export async function deleteSnapshot(id: string): Promise<boolean> {
  const database = await initializeDatabase();
  database.run('DELETE FROM snapshots WHERE id = ?;', [id]);
  persistDatabase();
  return true;
}

/**
 * Direct file-based database backup and restore functions
 */
export async function exportDatabaseToFile(targetPath: string): Promise<void> {
  const database = await initializeDatabase();
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const data = database.export();
  fs.writeFileSync(targetPath, Buffer.from(data));
}

export async function restoreDatabaseFromFile(sourcePath: string): Promise<void> {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Backup file not found at ${sourcePath}`);
  }
  const fileBuffer = fs.readFileSync(sourcePath);
  const newDb = new SQL.Database(fileBuffer);
  // Verify basic integrity by running a check
  const res = newDb.exec("PRAGMA integrity_check;");
  if (!res || !res[0] || res[0].values[0][0] !== 'ok') {
    throw new Error('Database integrity check failed for backup file');
  }
  db = newDb;
  persistDatabase();
}

export async function restoreDatabaseFromBuffer(buffer: Buffer): Promise<void> {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  const newDb = new SQL.Database(buffer);
  const res = newDb.exec("PRAGMA integrity_check;");
  if (!res || !res[0] || res[0].values[0][0] !== 'ok') {
    throw new Error('Database integrity check failed for uploaded file');
  }
  db = newDb;
  persistDatabase();
}

