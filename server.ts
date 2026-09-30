import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  initializeDatabase,
  getDatabaseStats,
  executeSql,
  resetDatabaseToSeed,
  getMachines,
  upsertMachine,
  deleteMachine,
  getMolds,
  upsertMold,
  deleteMold,
  getInterventionRequests,
  upsertInterventionRequest,
  deleteInterventionRequest,
  getProductionOrdersOF,
  upsertProductionOrderOF,
  deleteProductionOrderOF,
  getMaintenanceOrders,
  upsertMaintenanceOrder,
  deleteMaintenanceOrder,
  getInterventionReports,
  upsertInterventionReport,
  deleteInterventionReport,
  getStockItems,
  upsertStockItem,
  deleteStockItem,
  getStockMovements,
  addStockMovement,
  getMaterials,
  upsertMaterial,
  deleteMaterial,
  getMaterialMovements,
  addMaterialMovement,
  deleteMaterialMovement,
  getDeliveryNotes,
  upsertDeliveryNote,
  deleteDeliveryNote,
  getCalendarEvents,
  upsertCalendarEvent,
  deleteCalendarEvent,
  getUsers,
  upsertUser,
  deleteUser,
  authenticateUser,
  findUserByUsername,
  getMoldMaintenances,
  upsertMoldMaintenance,
  deleteMoldMaintenance,
  getAuditLogs,
  addAuditLog,
  clearAuditLogs,
  getFullState,
  restoreFullState,
  getSnapshots,
  saveSnapshot,
  getSnapshotById,
  deleteSnapshot,
  exportDatabaseToFile,
  restoreDatabaseFromFile,
  restoreDatabaseFromBuffer,
  updateMaterialMovement,
  batchMaterialMovements,
} from './src/server/db';
import { AppUser } from './src/types/gmao';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(express.raw({ type: ['application/octet-stream', 'application/x-sqlite3', 'application/vnd.sqlite3'], limit: '150mb' }));
  app.use((req, _res, next) => {
    if (req.method !== 'GET') console.log(new Date().toISOString(), req.method, req.originalUrl);
    next();
  });
  // Initialize SQLite database
  await initializeDatabase();
  console.log('[SQLite] Database initialized and ready.');

  // ==========================================
  // AUTHENTICATION ROUTES
  // ==========================================
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username) {
        return res.status(400).json({ error: 'Username is required' });
      }
      const user = await authenticateUser(username, password || '');
      if (!user) {
        return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
      }

      user.lastLogin = new Date().toISOString().replace('T', ' ').slice(0, 16);
      await upsertUser(user);

      const token = `token_${user.id}_${Date.now()}`;
      res.json({ user, token });
    } catch (err: any) {
      console.error('[Auth Login Error]', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/signup', async (req: Request, res: Response) => {
    try {
      const { username, password, displayName, role } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
      }

      const existing = await findUserByUsername(username);
      if (existing) {
        return res.status(400).json({ error: 'Cet identifiant existe déjà' });
      }

      const newUser: AppUser = {
        id: `usr-${Date.now()}`,
        name: displayName || username,
        username: username.trim(),
        password: password,
        email: `${username.toLowerCase()}@thermoplastics.tn`,
        phone: '',
        role: role || 'technician',
        department: role === 'manager' ? 'Management' : 'Maintenance',
        shift: 'General (Day)',
        status: 'Active',
        lastLogin: new Date().toISOString().replace('T', ' ').slice(0, 16),
        avatarColor: '#2563eb',
        specialty: role === 'manager' ? 'Responsable Maintenance' : 'Technicien de Maintenance',
      };

      await upsertUser(newUser);
      const token = `token_${newUser.id}_${Date.now()}`;
      res.json({ user: newUser, token });
    } catch (err: any) {
      console.error('[Auth Signup Error]', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/auth/me', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Non authentifié' });
      }
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      let userId: string | undefined;

      if (token.startsWith('token_')) {
        const parts = token.split('_');
        userId = parts[1];
      } else if (token.includes('.')) {
        // JWT format support (header.payload.signature)
        try {
          const parts = token.split('.');
          if (parts.length >= 2) {
            const rawPayload = Buffer.from(parts[1], 'base64').toString('utf-8');
            const payload = JSON.parse(rawPayload);
            userId = payload.uid || payload.userId || payload.id || payload.sub;
            if (!userId && payload.username) {
              const u = await findUserByUsername(payload.username);
              if (u) userId = u.id;
            }
          }
        } catch {
          // ignore parsing error
        }
      }

      if (!userId) {
        return res.status(401).json({ error: 'Session invalide' });
      }
      const users = await getUsers();
      let found = users.find((u) => u.id === userId);
      // Fallback: check if userId happens to be username or admin
      if (!found && userId.includes('admin')) {
        found = users.find((u) => u.username === 'admin');
      }
      if (!found) {
        return res.status(401).json({ error: 'Utilisateur non trouvé' });
      }
      res.json({ user: found, token });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.json({ message: 'Déconnexion réussie' });
  });

  // ==========================================
  // SQLITE SYSTEM & ADMIN ROUTES
  // ==========================================

  // SQLite Database Information & Stats
  app.get('/api/sqlite/info', async (req: Request, res: Response) => {
    try {
      const stats = await getDatabaseStats();
      res.json({ ok: true, stats });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Execute Direct SQL (For SQL Console & Queries)
  app.post('/api/sqlite/query', async (req: Request, res: Response) => {
    try {
      const { sql, params } = req.body;
      if (!sql || typeof sql !== 'string') {
        return res.status(400).json({ ok: false, error: 'SQL query string required.' });
      }
      const result = await executeSql(sql, params || []);
      res.json({ ok: true, result });
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  // Download gmao.sqlite binary file
  app.get('/api/sqlite/download', (req: Request, res: Response) => {
    const dbPath = path.resolve(process.cwd(), 'data', 'gmao.sqlite');
    if (!fs.existsSync(dbPath)) {
      return res.status(404).send('SQLite database file not found');
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.setHeader('Content-Disposition', `attachment; filename="gmao_production_${timestamp}.sqlite"`);
    res.setHeader('Content-Type', 'application/x-sqlite3');
    const stream = fs.createReadStream(dbPath);
    stream.pipe(res);
  });

  // Reset database back to seed
  app.post('/api/sqlite/reset', async (req: Request, res: Response) => {
    try {
      await resetDatabaseToSeed();
      const stats = await getDatabaseStats();
      res.json({ ok: true, message: 'Database reset to seed data.', stats });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Full state export / restore
  app.get('/api/full-state', async (req: Request, res: Response) => {
    try {
      const fullState = await getFullState();
      res.json({ ok: true, data: fullState });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/full-state', async (req: Request, res: Response) => {
    try {
      await restoreFullState(req.body);
      const fullState = await getFullState();
      res.json({ ok: true, data: fullState });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ==========================================
  // MACHINES
  // ==========================================
  app.get('/api/machines', async (req: Request, res: Response) => {
    try {
      const machines = await getMachines();
      res.json(machines);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/machines', async (req: Request, res: Response) => {
    try {
      const created = await upsertMachine(req.body);
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/machines/:id', async (req: Request, res: Response) => {
    try {
      const updated = await upsertMachine({ ...req.body, id: req.params.id });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/machines/:id', async (req: Request, res: Response) => {
    try {
      await deleteMachine(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // MOLDS
  // ==========================================
  app.get('/api/molds', async (req: Request, res: Response) => {
    try {
      const molds = await getMolds();
      res.json(molds);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/molds', async (req: Request, res: Response) => {
    try {
      const created = await upsertMold(req.body);
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/molds/:id', async (req: Request, res: Response) => {
    try {
      const updated = await upsertMold({ ...req.body, id: req.params.id });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/molds/:id', async (req: Request, res: Response) => {
    try {
      await deleteMold(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // INTERVENTION REQUESTS
  // ==========================================
  app.get('/api/intervention-requests', async (req: Request, res: Response) => {
    try {
      const requests = await getInterventionRequests();
      res.json(requests);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/intervention-requests', async (req: Request, res: Response) => {
    try {
      const created = await upsertInterventionRequest(req.body);
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/intervention-requests/:id', async (req: Request, res: Response) => {
    try {
      const updated = await upsertInterventionRequest({ ...req.body, id: req.params.id });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/intervention-requests/:id', async (req: Request, res: Response) => {
    try {
      await deleteInterventionRequest(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // PRODUCTION ORDERS (OFS)
  // ==========================================
  app.get('/api/ofs', async (req: Request, res: Response) => {
    try {
      const ofs = await getProductionOrdersOF();
      res.json(ofs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/ofs', async (req: Request, res: Response) => {
    try {
      const created = await upsertProductionOrderOF(req.body);
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/ofs/:id', async (req: Request, res: Response) => {
    try {
      const updated = await upsertProductionOrderOF({ ...req.body, id: req.params.id });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/ofs/:id', async (req: Request, res: Response) => {
    try {
      await deleteProductionOrderOF(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // MAINTENANCE ORDERS
  // ==========================================
  app.get('/api/maintenance-orders', async (req: Request, res: Response) => {
    try {
      const orders = await getMaintenanceOrders();
      res.json(orders);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/maintenance-orders', async (req: Request, res: Response) => {
    try {
      const created = await upsertMaintenanceOrder(req.body);
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/maintenance-orders/:id', async (req: Request, res: Response) => {
    try {
      const updated = await upsertMaintenanceOrder({ ...req.body, id: req.params.id });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/maintenance-orders/:id', async (req: Request, res: Response) => {
    try {
      await deleteMaintenanceOrder(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // INTERVENTION REPORTS
  // ==========================================
  app.get('/api/intervention-reports', async (req: Request, res: Response) => {
    try {
      const reports = await getInterventionReports();
      res.json(reports);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/intervention-reports', async (req: Request, res: Response) => {
    try {
      const created = await upsertInterventionReport(req.body);
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/intervention-reports/:id', async (req: Request, res: Response) => {
    try {
      const updated = await upsertInterventionReport({ ...req.body, id: req.params.id });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/intervention-reports/:id', async (req: Request, res: Response) => {
    try {
      await deleteInterventionReport(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // STOCK ITEMS
  // ==========================================
  app.get('/api/stock-items', async (req: Request, res: Response) => {
    try {
      const stock = await getStockItems();
      res.json(stock);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/stock-items', async (req: Request, res: Response) => {
    try {
      const created = await upsertStockItem(req.body);
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/stock-items/:id', async (req: Request, res: Response) => {
    try {
      const updated = await upsertStockItem({ ...req.body, id: req.params.id });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/stock-items/:id', async (req: Request, res: Response) => {
    try {
      await deleteStockItem(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // STOCK MOVEMENTS
  // ==========================================
  app.get('/api/stock-movements', async (req: Request, res: Response) => {
    try {
      const movements = await getStockMovements();
      res.json(movements);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/stock-movements', async (req: Request, res: Response) => {
    try {
      const created = await addStockMovement(req.body);
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // RAW MATERIALS & MOVEMENTS
  // ==========================================
  app.get('/api/materials', async (req: Request, res: Response) => {
    try {
      const materials = await getMaterials();
      res.json(materials);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/materials', async (req: Request, res: Response) => {
    try {
      const created = await upsertMaterial(req.body);
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/materials/:ref', async (req: Request, res: Response) => {
    try {
      const updated = await upsertMaterial({ ...req.body, item: req.params.ref });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/materials/:ref', async (req: Request, res: Response) => {
    try {
      await deleteMaterial(req.params.ref);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/material-movements', async (req: Request, res: Response) => {
    try {
      const type = req.query.type as 'in' | 'out' | undefined;
      const movements = await getMaterialMovements(type);
      res.json(movements);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/material-movements/batch — must be declared before POST /api/material-movements
  app.post('/api/material-movements/batch', async (req: Request, res: Response) => {
    try {
      const { movements, movementType } = req.body as { movements: any[]; movementType: 'in' | 'out' };
      if (!Array.isArray(movements) || movements.length === 0) {
        res.status(400).json({ error: 'Aucune ligne à traiter' });
        return;
      }
      const rawUser = req.headers['x-user-name'];
      const performedBy = rawUser ? decodeURIComponent(String(rawUser)) : 'Import Excel';
      const result = await batchMaterialMovements(movements, movementType || 'in', performedBy);
      res.json({ ok: true, message: `${result.count} mouvement(s) importé(s) avec succès`, count: result.count });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/material-movements', async (req: Request, res: Response) => {
    try {
      const rawUser = req.headers['x-user-name'];
      const body = { ...req.body };
      if (!body.performedBy && rawUser) {
        body.performedBy = decodeURIComponent(String(rawUser));
      }
      const created = await addMaterialMovement(body);
      res.json(created);
    } catch (err: any) {
      const isValidation = err.message && (
        err.message.includes('insuffisant') ||
        err.message.includes("n'existe pas") ||
        err.message.includes('supérieure à 0')
      );
      res.status(isValidation ? 400 : 500).json({ error: err.message });
    }
  });

  app.put('/api/material-movements/:id', async (req: Request, res: Response) => {
    try {
      const result = await updateMaterialMovement(req.params.id, req.body);
      if (!result) {
        res.status(404).json({ error: `Mouvement ${req.params.id} introuvable` });
        return;
      }
      res.json({ message: 'Mouvement mis à jour avec succès', movement: result });
    } catch (err: any) {
      const isValidation = err.message && (
        err.message.includes('insuffisant') ||
        err.message.includes("n'existe pas") ||
        err.message.includes('supérieure à 0')
      );
      res.status(isValidation ? 400 : 500).json({ error: err.message });
    }
  });

  app.delete('/api/material-movements/:id', async (req: Request, res: Response) => {
    try {
      await deleteMaterialMovement(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // DELIVERY NOTES
  // ==========================================
  app.get('/api/delivery-notes', async (req: Request, res: Response) => {
    try {
      const notes = await getDeliveryNotes();
      res.json(notes);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/delivery-notes', async (req: Request, res: Response) => {
    try {
      const created = await upsertDeliveryNote(req.body);
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/delivery-notes/:id', async (req: Request, res: Response) => {
    try {
      const updated = await upsertDeliveryNote({ ...req.body, id: req.params.id });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/delivery-notes/:id', async (req: Request, res: Response) => {
    try {
      await deleteDeliveryNote(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // CALENDAR EVENTS
  // ==========================================
  app.get('/api/calendar-events', async (req: Request, res: Response) => {
    try {
      const events = await getCalendarEvents();
      res.json(events);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/calendar-events', async (req: Request, res: Response) => {
    try {
      const created = await upsertCalendarEvent(req.body);
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/calendar-events/:id', async (req: Request, res: Response) => {
    try {
      const updated = await upsertCalendarEvent({ ...req.body, id: req.params.id });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/calendar-events/:id', async (req: Request, res: Response) => {
    try {
      await deleteCalendarEvent(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // USERS
  // ==========================================
  app.get('/api/users', async (req: Request, res: Response) => {
    try {
      const users = await getUsers();
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/users', async (req: Request, res: Response) => {
    try {
      const created = await upsertUser(req.body);
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const updated = await upsertUser({ ...req.body, id: req.params.id });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/users/:id', async (req: Request, res: Response) => {
    try {
      await deleteUser(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // MOLD MAINTENANCES
  // ==========================================
  app.get('/api/mold-maintenances', async (req: Request, res: Response) => {
    try {
      const list = await getMoldMaintenances();
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/mold-maintenances', async (req: Request, res: Response) => {
    try {
      const created = await upsertMoldMaintenance(req.body);
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/mold-maintenances/:id', async (req: Request, res: Response) => {
    try {
      const updated = await upsertMoldMaintenance({ ...req.body, id: req.params.id });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/mold-maintenances/:id', async (req: Request, res: Response) => {
    try {
      await deleteMoldMaintenance(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // AUDIT LOGS
  // ==========================================
  app.get('/api/audit-logs', async (req: Request, res: Response) => {
    try {
      const logs = await getAuditLogs();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/audit-logs', async (req: Request, res: Response) => {
    try {
      const created = await addAuditLog(req.body);
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/audit-logs', async (req: Request, res: Response) => {
    try {
      await clearAuditLogs();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // SNAPSHOTS
  // ==========================================
  app.get('/api/snapshots', async (req: Request, res: Response) => {
    try {
      const list = await getSnapshots();
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/snapshots/:id', async (req: Request, res: Response) => {
    try {
      const snap = await getSnapshotById(req.params.id);
      if (!snap) return res.status(404).json({ error: 'Snapshot not found' });
      res.json(snap);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/snapshots', async (req: Request, res: Response) => {
    try {
      await saveSnapshot(req.body);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/snapshots/:id', async (req: Request, res: Response) => {
    try {
      await deleteSnapshot(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // BACKUP & RESTORE ROUTES & ENGINE
  // ==========================================
  const BACKUPS_DIR = path.resolve(process.cwd(), 'backups');
  const BACKUP_CONFIG_FILE = path.join(BACKUPS_DIR, 'backup-config.json');

  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  interface BackupConfig {
    autoBackupEnabled: boolean;
    intervalHours: number;
    maxBackupsToKeep: number;
    lastBackupTime?: string;
    nextBackupTime?: string;
  }

  function loadBackupConfig(): BackupConfig {
    try {
      if (fs.existsSync(BACKUP_CONFIG_FILE)) {
        const data = JSON.parse(fs.readFileSync(BACKUP_CONFIG_FILE, 'utf-8'));
        return {
          autoBackupEnabled: typeof data.autoBackupEnabled === 'boolean' ? data.autoBackupEnabled : true,
          intervalHours: Number(data.intervalHours) || 6,
          maxBackupsToKeep: Number(data.maxBackupsToKeep) || 30,
          lastBackupTime: data.lastBackupTime || undefined,
          nextBackupTime: data.nextBackupTime || undefined,
        };
      }
    } catch (err) {
      console.error('[Backup] Failed to read backup config:', err);
    }
    return {
      autoBackupEnabled: true,
      intervalHours: 6,
      maxBackupsToKeep: 30,
    };
  }

  function saveBackupConfig(cfg: BackupConfig) {
    try {
      if (!fs.existsSync(BACKUPS_DIR)) {
        fs.mkdirSync(BACKUPS_DIR, { recursive: true });
      }
      fs.writeFileSync(BACKUP_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Backup] Failed to write backup config:', err);
    }
  }

  function getBackupTimestamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  }

  function pruneOldBackups(maxBackups: number) {
    try {
      if (!fs.existsSync(BACKUPS_DIR)) return;
      const files = fs.readdirSync(BACKUPS_DIR)
        .filter(f => f.endsWith('.sqlite') || f.endsWith('.db'))
        .map(f => {
          const fullPath = path.join(BACKUPS_DIR, f);
          const stat = fs.statSync(fullPath);
          return { name: f, path: fullPath, mtime: stat.mtimeMs };
        })
        .sort((a, b) => a.mtime - b.mtime);

      if (files.length > maxBackups) {
        const toDelete = files.slice(0, files.length - maxBackups);
        for (const item of toDelete) {
          fs.unlinkSync(item.path);
          console.log(`[Backup] Pruned old backup: ${item.name}`);
        }
      }
    } catch (err) {
      console.error('[Backup] Error pruning backups:', err);
    }
  }

  let autoBackupTimer: NodeJS.Timeout | null = null;

  function scheduleAutoBackup() {
    if (autoBackupTimer) {
      clearTimeout(autoBackupTimer);
      autoBackupTimer = null;
    }
    const cfg = loadBackupConfig();
    if (!cfg.autoBackupEnabled || cfg.intervalHours <= 0) {
      cfg.nextBackupTime = undefined;
      saveBackupConfig(cfg);
      return;
    }

    const intervalMs = cfg.intervalHours * 3600 * 1000;
    const nextTime = new Date(Date.now() + intervalMs);
    cfg.nextBackupTime = nextTime.toISOString();
    saveBackupConfig(cfg);

    autoBackupTimer = setTimeout(async () => {
      try {
        console.log('[Backup] Running scheduled automatic backup...');
        const stamp = getBackupTimestamp();
        const filename = `backup-${stamp}-auto.sqlite`;
        const targetPath = path.join(BACKUPS_DIR, filename);
        await exportDatabaseToFile(targetPath);

        const updatedCfg = loadBackupConfig();
        updatedCfg.lastBackupTime = new Date().toISOString();
        saveBackupConfig(updatedCfg);
        pruneOldBackups(updatedCfg.maxBackupsToKeep);
        console.log(`[Backup] Automatic backup created successfully: ${filename}`);
      } catch (err) {
        console.error('[Backup] Scheduled backup failed:', err);
      } finally {
        scheduleAutoBackup();
      }
    }, intervalMs);
  }

  // Start backup scheduler
  scheduleAutoBackup();

  app.get('/api/backups', async (_req: Request, res: Response) => {
    try {
      if (!fs.existsSync(BACKUPS_DIR)) {
        return res.json([]);
      }
      const files = fs.readdirSync(BACKUPS_DIR)
        .filter(f => f.endsWith('.sqlite') || f.endsWith('.db'))
        .map(f => {
          const fullPath = path.join(BACKUPS_DIR, f);
          const stat = fs.statSync(fullPath);
          let tag: 'auto' | 'manual' | 'safety' | 'upload' | 'other' = 'other';
          if (f.includes('-auto')) tag = 'auto';
          else if (f.includes('-manual')) tag = 'manual';
          else if (f.includes('-safety')) tag = 'safety';
          else if (f.includes('-upload')) tag = 'upload';

          return {
            filename: f,
            size: stat.size,
            createdAt: stat.birthtime || stat.mtime,
            mtime: stat.mtime,
            tag,
          };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json(files);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/backups/config', async (_req: Request, res: Response) => {
    try {
      res.json(loadBackupConfig());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/backups/config', async (req: Request, res: Response) => {
    try {
      const { autoBackupEnabled, intervalHours, maxBackupsToKeep } = req.body;
      const current = loadBackupConfig();
      if (typeof autoBackupEnabled === 'boolean') current.autoBackupEnabled = autoBackupEnabled;
      if (typeof intervalHours === 'number' && intervalHours > 0) current.intervalHours = intervalHours;
      if (typeof maxBackupsToKeep === 'number' && maxBackupsToKeep > 0) current.maxBackupsToKeep = maxBackupsToKeep;
      saveBackupConfig(current);
      scheduleAutoBackup();
      res.json(current);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/backups/create', async (req: Request, res: Response) => {
    try {
      const label = (req.body?.label || 'manual').replace(/[^a-zA-Z0-9_-]/g, '');
      const stamp = getBackupTimestamp();
      const filename = `backup-${stamp}-${label}.sqlite`;
      const targetPath = path.join(BACKUPS_DIR, filename);
      await exportDatabaseToFile(targetPath);

      const cfg = loadBackupConfig();
      cfg.lastBackupTime = new Date().toISOString();
      saveBackupConfig(cfg);
      pruneOldBackups(cfg.maxBackupsToKeep);

      const stat = fs.statSync(targetPath);
      res.json({
        success: true,
        filename,
        size: stat.size,
        createdAt: stat.birthtime || stat.mtime,
        tag: label === 'manual' ? 'manual' : 'other',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/backups/download', async (_req: Request, res: Response) => {
    try {
      const stamp = getBackupTimestamp();
      const tempFile = path.join(BACKUPS_DIR, `temp-live-export-${stamp}.sqlite`);
      await exportDatabaseToFile(tempFile);
      res.download(tempFile, `gmao-v1-database-${stamp}.sqlite`, () => {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/backups/download/:filename', async (req: Request, res: Response) => {
    try {
      const safeFilename = path.basename(req.params.filename);
      const filePath = path.join(BACKUPS_DIR, safeFilename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Fichier de sauvegarde introuvable.' });
      }
      res.download(filePath, safeFilename);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/backups/:filename', async (req: Request, res: Response) => {
    try {
      const safeFilename = path.basename(req.params.filename);
      const filePath = path.join(BACKUPS_DIR, safeFilename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/backups/restore/:filename', async (req: Request, res: Response) => {
    try {
      const safeFilename = path.basename(req.params.filename);
      const filePath = path.join(BACKUPS_DIR, safeFilename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Fichier de sauvegarde introuvable.' });
      }

      // Create safety snapshot before restoring
      const safetyStamp = getBackupTimestamp();
      const safetyFile = path.join(BACKUPS_DIR, `backup-${safetyStamp}-safety.sqlite`);
      try {
        await exportDatabaseToFile(safetyFile);
      } catch (e) {
        console.warn('[Backup] Could not create safety backup before restore:', e);
      }

      await restoreDatabaseFromFile(filePath);
      res.json({ success: true, message: 'Base de données restaurée avec succès.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/backups/restore-upload', async (req: Request, res: Response) => {
    try {
      let buffer: Buffer;
      if (Buffer.isBuffer(req.body)) {
        buffer = req.body;
      } else if (req.body && typeof req.body === 'object' && Object.keys(req.body).length === 0) {
        return res.status(400).json({ error: 'Fichier SQLite vide ou en-tête Content-Type invalide.' });
      } else {
        return res.status(400).json({ error: 'Format de fichier invalide. Envoyez le fichier SQLite en binaire.' });
      }

      if (buffer.length < 100) {
        return res.status(400).json({ error: 'Fichier SQLite invalide ou trop court.' });
      }

      // Create safety backup
      const safetyStamp = getBackupTimestamp();
      const safetyFile = path.join(BACKUPS_DIR, `backup-${safetyStamp}-safety.sqlite`);
      try {
        await exportDatabaseToFile(safetyFile);
      } catch (e) {
        console.warn('[Backup] Could not create safety backup:', e);
      }

      // Save uploaded backup file into backups directory for history
      const uploadFile = path.join(BACKUPS_DIR, `backup-${safetyStamp}-upload.sqlite`);
      fs.writeFileSync(uploadFile, buffer);

      // Restore
      await restoreDatabaseFromBuffer(buffer);
      res.json({
        success: true,
        message: 'Base de données importée et restaurée avec succès.',
        filename: path.basename(uploadFile),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // STATIC UPLOADS & VITE
  // ==========================================
  const uploadsPath = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
  app.use(
    '/uploads',
    express.static(uploadsPath, {
      setHeaders: (res, filePath) => {
        if (filePath.toLowerCase().endsWith('.pdf')) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'inline');
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
      },
    })
  );

  app.post('/api/upload-pdf', (req: Request, res: Response) => {
    try {
      const { filename, base64 } = req.body;
      if (!filename || !base64) {
        return res.status(400).json({ error: 'Fichier ou contenu base64 manquant' });
      }
      const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const targetPath = path.join(uploadsPath, safeName);
      fs.writeFileSync(targetPath, buffer);
      res.json({
        url: `/uploads/${safeName}`,
        filename: safeName,
        size: buffer.length,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  if (isProd) {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        allowedHosts: true,
        watch: {
          ignored: ['**/data/**', '**/backups/**'],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`  [Thermoplastics GMAO Server] Running with SQLite!`);
    console.log(`  > Desktop Local:   http://localhost:${PORT}`);
    console.log(`  > Tablet Local:    http://localhost:${PORT}/tablet`);
    try {
      const nets = os.networkInterfaces();
      for (const [name, arr] of Object.entries(nets)) {
        for (const net of arr || []) {
          if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254')) {
            console.log(`  > Desktop Network (${name}): http://${net.address}:${PORT}`);
            console.log(`  > Tablet Network  (${name}): http://${net.address}:${PORT}/tablet`);
          }
        }
      }
    } catch {
      // fallback
    }
    console.log(`======================================================\n`);
  });
}

startServer().catch((err) => {
  console.error('[Server Error]', err);
  process.exit(1);
});
