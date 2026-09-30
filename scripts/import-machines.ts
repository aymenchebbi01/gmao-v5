import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import { Machine, MachineStatus } from '../src/types/gmao';
import { upsertMachine, persistDatabase, initializeDatabase, getMachines } from '../src/server/db';

function extractBrandAndModel(name: string): { brand: string; model: string } {
  if (!name) return { brand: '', model: '' };
  const trimmed = name.trim();
  const knownBrands = [
    'Sumitomo Demag',
    'Wittmann battenfled',
    'Wittmann Battenfeld',
    'Krauss Maffei',
    'KraussMaffe',
    'KraussMaffei',
    'Ferromatik Milacron',
    'Klockner ferromatik',
    'Baby Plast',
    'Battenfeld',
    'Battenfled',
    'Demag',
    'ENGEL',
    'Engel',
    'Arburg',
    'Ferromatik',
    'BOY',
    'Haitian',
    'Negri Bossi',
  ];

  for (const b of knownBrands) {
    if (trimmed.toLowerCase().startsWith(b.toLowerCase())) {
      const model = trimmed.slice(b.length).trim();
      return { brand: b, model };
    }
  }

  const parts = trimmed.split(/\s+/);
  return {
    brand: parts[0] || '',
    model: parts.slice(1).join(' ') || '',
  };
}

function normalizeStatus(status: any): MachineStatus {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'operational' || s === 'running' || s === 'in_production') return 'operational';
  if (s === 'down' || s === 'stopped' || s === 'error') return 'down';
  if (s === 'maintenance') return 'maintenance';
  return 'idle';
}

async function runImport() {
  console.log('=== TASK 3: IMPORT MACHINES FROM OLD DATABASE ===\n');

  // Step 1: Safety Backup of data/gmao.sqlite
  const dataDir = path.resolve(process.cwd(), 'data');
  const backupDir = path.resolve(process.cwd(), 'backups');
  const liveDbFile = path.join(dataDir, 'gmao.sqlite');

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  if (fs.existsSync(liveDbFile)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupTarget = path.join(backupDir, `gmao-before-machine-import-${timestamp}.sqlite`);
    fs.copyFileSync(liveDbFile, backupTarget);
    console.log(`[Safety Backup] Created copy of data/gmao.sqlite -> ${backupTarget}`);
  } else {
    console.log('[Safety Backup] data/gmao.sqlite does not exist yet; skipping pre-backup copy.');
  }

  // Step 2: Read source machines table from Downloads read-only
  const downloadsDir = path.join(process.env.USERPROFILE || 'C:\\Users\\ChebbiAymen', 'Downloads');
  const sourceDbPath = path.join(downloadsDir, 'gmao-backup-2026-09-28.db');

  if (!fs.existsSync(sourceDbPath)) {
    throw new Error(`Source database file not found at: ${sourceDbPath}`);
  }

  console.log(`[Source DB] Reading (read-only): ${sourceDbPath}`);
  const sourceBuffer = fs.readFileSync(sourceDbPath);
  const SQL = await initSqlJs();
  const sourceDb = new SQL.Database(sourceBuffer);

  const queryResult = sourceDb.exec('SELECT * FROM machines;');
  if (!queryResult || queryResult.length === 0) {
    console.log('No machines found in source database.');
    return;
  }

  const columns = queryResult[0].columns;
  const rawRows = queryResult[0].values;
  console.log(`[Source DB] Found ${rawRows.length} machine records.`);

  // Step 3: Print column mapping
  const fieldMapping: Record<string, string> = {
    id: 'id',
    name: 'name',
    siteNumber: 'number & siteNumber',
    serialNumber: 'serialNumber',
    type: 'type',
    manufacturingYear: 'manufacturingYear & year',
    location: 'location',
    clampingForce: 'clampingForce & clampingForceTons',
    status: 'status (normalized to MachineStatus)',
    installationDate: 'installationDate',
    imageUrl: 'imageUrl',
    closingType: 'closingType',
    moldThicknessMin: 'moldThicknessMin',
    moldThicknessMax: 'moldThicknessMax',
    centeringDiameter: 'centeringDiameter',
    tieBarSpacingHorizontal: 'tieBarSpacingHorizontal',
    tieBarSpacingVertical: 'tieBarSpacingVertical',
    maxOpeningStroke: 'maxOpeningStroke',
    maxEjectionStroke: 'maxEjectionStroke',
    coreCount: 'coreCount',
    screwDiameter: 'screwDiameter',
    maxInjectableVolume: 'maxInjectableVolume',
    coolingChannelCount: 'coolingChannelCount',
    thermalRegulation: 'thermalRegulation',
    accessories: 'accessories',
    hydraulicOilType: 'hydraulicOilType',
    lubricantType: 'lubricantType',
    reservoirCapacity: 'reservoirCapacity',
    injectingProduct: 'injectingProduct',
    currentMoule: 'currentMoule & activeMoldRef',
  };

  console.log('\n--- Field Mapping (Old Columns -> New Machine Fields) ---');
  for (const [oldCol, newField] of Object.entries(fieldMapping)) {
    console.log(`  Old Column: ${oldCol.padEnd(25)} -> New Field: ${newField}`);
  }
  console.log('\n--- Excluded Telemetry / Dynamic Fields ---');
  console.log('  EXCLUDED: currentHours (set to 0), lastHoursUpdate, totalOperatingTime, totalDownTime,');
  console.log('            failureCount, operationalStartTime, lastHoursSync, condition history,');
  console.log('            work orders, and preventivePlan.\n');

  // Check if server is running
  let isServerRunning = false;
  try {
    const healthCheck = await fetch('http://localhost:5033/api/machines', { method: 'GET' });
    if (healthCheck.ok) {
      isServerRunning = true;
    }
  } catch {
    isServerRunning = false;
  }

  console.log(
    isServerRunning
      ? '[Execution Route] Running server detected at http://localhost:5033. Importing through server API to update in-memory sql.js state and persist.'
      : '[Execution Route] Server not running. Importing directly via src/server/db.ts module and calling persistDatabase().'
  );

  let importedCount = 0;
  let skippedCount = 0;
  const importedSamples: Machine[] = [];

  for (const row of rawRows) {
    const rawObj: Record<string, any> = {};
    columns.forEach((col, idx) => {
      rawObj[col] = row[idx];
    });

    if (!rawObj.id) {
      skippedCount++;
      continue;
    }

    const { brand, model } = extractBrandAndModel(rawObj.name || '');
    const machineNumber = String(rawObj.siteNumber || rawObj.number || rawObj.name || rawObj.id).trim();

    const machine: Machine = {
      id: String(rawObj.id).trim(),
      name: rawObj.name ? String(rawObj.name).trim() : undefined,
      number: machineNumber,
      siteNumber: rawObj.siteNumber ? String(rawObj.siteNumber).trim() : machineNumber,
      serialNumber: rawObj.serialNumber ? String(rawObj.serialNumber).trim() : undefined,
      type: rawObj.type ? String(rawObj.type).trim() : 'Simple Injection',
      manufacturingYear: rawObj.manufacturingYear ? Number(rawObj.manufacturingYear) : undefined,
      year: rawObj.manufacturingYear ? Number(rawObj.manufacturingYear) : undefined,
      location: rawObj.location ? String(rawObj.location).trim() : undefined,
      brand: brand || undefined,
      model: model || undefined,
      clampingForce: rawObj.clampingForce ? Number(rawObj.clampingForce) : undefined,
      clampingForceTons: rawObj.clampingForce ? Number(rawObj.clampingForce) : undefined,
      status: normalizeStatus(rawObj.status),
      installationDate: rawObj.installationDate ? String(rawObj.installationDate).trim() : undefined,
      imageUrl: rawObj.imageUrl ? String(rawObj.imageUrl).trim() : undefined,
      currentHours: 0, // Excluded telemetry: zeroed/empty per specification

      // Technical specifications
      closingType: rawObj.closingType ? String(rawObj.closingType).trim() : undefined,
      moldThicknessMin: rawObj.moldThicknessMin != null ? Number(rawObj.moldThicknessMin) : undefined,
      moldThicknessMax: rawObj.moldThicknessMax != null ? Number(rawObj.moldThicknessMax) : undefined,
      centeringDiameter: rawObj.centeringDiameter != null ? Number(rawObj.centeringDiameter) : undefined,
      tieBarSpacingHorizontal:
        rawObj.tieBarSpacingHorizontal != null ? Number(rawObj.tieBarSpacingHorizontal) : undefined,
      tieBarSpacingVertical:
        rawObj.tieBarSpacingVertical != null ? Number(rawObj.tieBarSpacingVertical) : undefined,
      maxOpeningStroke: rawObj.maxOpeningStroke != null ? Number(rawObj.maxOpeningStroke) : undefined,
      maxEjectionStroke: rawObj.maxEjectionStroke != null ? Number(rawObj.maxEjectionStroke) : undefined,
      coreCount: rawObj.coreCount != null ? Number(rawObj.coreCount) : undefined,
      screwDiameter: rawObj.screwDiameter != null ? Number(rawObj.screwDiameter) : undefined,
      maxInjectableVolume:
        rawObj.maxInjectableVolume != null ? Number(rawObj.maxInjectableVolume) : undefined,
      coolingChannelCount:
        rawObj.coolingChannelCount != null ? Number(rawObj.coolingChannelCount) : undefined,
      thermalRegulation: rawObj.thermalRegulation ? String(rawObj.thermalRegulation).trim() : undefined,
      accessories: rawObj.accessories ? String(rawObj.accessories).trim() : undefined,
      hydraulicOilType: rawObj.hydraulicOilType ? String(rawObj.hydraulicOilType).trim() : undefined,
      lubricantType: rawObj.lubricantType ? String(rawObj.lubricantType).trim() : undefined,
      reservoirCapacity: rawObj.reservoirCapacity != null ? Number(rawObj.reservoirCapacity) : undefined,
      injectingProduct: rawObj.injectingProduct ? String(rawObj.injectingProduct).trim() : undefined,
      currentMoule: rawObj.currentMoule ? String(rawObj.currentMoule).trim() : undefined,
      activeMoldRef: rawObj.currentMoule ? String(rawObj.currentMoule).trim() : undefined,
    };

    if (isServerRunning) {
      const resp = await fetch('http://localhost:5033/api/machines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(machine),
      });
      if (!resp.ok) {
        throw new Error(`Failed to upsert machine ${machine.id}: ${resp.statusText}`);
      }
    } else {
      await upsertMachine(machine);
    }

    importedCount++;
    if (importedSamples.length < 3) {
      importedSamples.push(machine);
    }
  }

  if (!isServerRunning) {
    persistDatabase();
  }

  console.log(`\nImport completed successfully!`);
  console.log(`- Total machines imported/upserted: ${importedCount}`);
  console.log(`- Total skipped: ${skippedCount}`);

  console.log('\n--- Sample of 3 Imported Machines ---');
  importedSamples.forEach((m, idx) => {
    console.log(`\n[Machine Sample #${idx + 1}]`);
    console.log(JSON.stringify(m, null, 2));
  });
}

runImport().catch((err) => {
  console.error('[Import Error]', err);
  process.exit(1);
});
