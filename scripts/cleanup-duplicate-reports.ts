import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import { InterventionReport } from '../src/types/gmao';

async function main() {
  const isApply = process.argv.includes('--apply');
  console.log(`=== TASK 4: CLEANUP DUPLICATE INTERVENTION REPORTS ===`);
  console.log(`Mode: ${isApply ? 'APPLY (Will merge and delete duplicate rows)' : 'DRY-RUN (Listing only, no changes made)'}\n`);

  const dataDir = path.resolve(process.cwd(), 'data');
  const backupDir = path.resolve(process.cwd(), 'backups');
  const dbFile = path.join(dataDir, 'gmao.sqlite');

  if (!fs.existsSync(dbFile)) {
    console.log(`No database file found at ${dbFile}.`);
    return;
  }

  // 1. Back up data/gmao.sqlite first
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `gmao-before-report-dedup-${timestamp}.sqlite`);
  fs.copyFileSync(dbFile, backupPath);
  console.log(`[Backup] Created safety backup: ${backupPath}\n`);

  // 2. Open SQLite database using sql.js
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(dbFile);
  const db = new SQL.Database(fileBuffer);

  // 3. Query all intervention reports
  const res = db.exec('SELECT id, ref_report, ref_ot, date, updated_at, data FROM intervention_reports;');
  if (!res || res.length === 0 || res[0].values.length === 0) {
    console.log('No intervention reports found in database.');
    return;
  }

  const reports: Array<{
    id: string;
    ref_report: string;
    ref_ot: string;
    date: string;
    updated_at: string;
    data: InterventionReport;
  }> = res[0].values.map((v) => {
    let parsed: any = {};
    try {
      parsed = JSON.parse(v[5] as string);
    } catch {}
    return {
      id: v[0] as string,
      ref_report: v[1] as string,
      ref_ot: v[2] as string,
      date: v[3] as string,
      updated_at: (v[4] as string) || (v[3] as string) || '',
      data: parsed,
    };
  });

  // 4. Group by work order (ref_ot)
  const groupedByOT: Record<string, typeof reports> = {};
  for (const r of reports) {
    const ot = (r.ref_ot || '').trim();
    if (!ot) continue;
    if (!groupedByOT[ot]) groupedByOT[ot] = [];
    groupedByOT[ot].push(r);
  }

  const duplicateGroups = Object.entries(groupedByOT).filter(([_, list]) => list.length > 1);

  if (duplicateGroups.length === 0) {
    console.log('No duplicate intervention reports found across work orders.');
    console.log(`Checked ${reports.length} total reports across ${Object.keys(groupedByOT).length} work orders.`);
    return;
  }

  console.log(`Found ${duplicateGroups.length} work order(s) with duplicate reports:\n`);

  for (const [ot, list] of duplicateGroups) {
    console.log(`-------------------------------------------------------------------`);
    console.log(`Work Order (ref_ot): "${ot}" -> ${list.length} reports found:`);
    list.forEach((r, idx) => {
      console.log(`  [${idx + 1}] ID: ${r.id} | Ref: ${r.ref_report} | Date: ${r.date} | UpdatedAt: ${r.updated_at} | Technician: ${r.data.technicianName || r.data.filledBy || 'N/A'}`);
    });

    // Sort by updated_at descending (newest first)
    list.sort((a, b) => {
      const timeA = new Date(a.updated_at || a.date).getTime() || 0;
      const timeB = new Date(b.updated_at || b.date).getTime() || 0;
      return timeB - timeA;
    });

    const primary = list[0];
    const duplicatesToDelete = list.slice(1);

    console.log(`  -> Primary (most recent): ${primary.id} (${primary.ref_report})`);
    console.log(`  -> Duplicates to merge & remove: ${duplicatesToDelete.map((d) => `${d.id} (${d.ref_report})`).join(', ')}`);

    // Merge: fill empty fields in primary from the duplicates
    const mergedData: any = { ...primary.data };
    for (const dup of duplicatesToDelete) {
      for (const [key, val] of Object.entries(dup.data)) {
        if (
          (mergedData[key] === undefined ||
            mergedData[key] === null ||
            mergedData[key] === '' ||
            (Array.isArray(mergedData[key]) && mergedData[key].length === 0)) &&
          val !== undefined &&
          val !== null &&
          val !== ''
        ) {
          mergedData[key] = val;
          console.log(`     Filled empty field "${key}" from duplicate report ${dup.ref_report}`);
        }
      }
    }

    if (isApply) {
      // 1. Delete duplicates from DB
      for (const dup of duplicatesToDelete) {
        db.run('DELETE FROM intervention_reports WHERE id = ?;', [dup.id]);
        console.log(`     [APPLIED] Deleted duplicate row: ${dup.id} (${dup.ref_report})`);
      }

      // 2. Update primary row with merged data
      const now = new Date().toISOString();
      db.run(
        `UPDATE intervention_reports SET data = ?, updated_at = ? WHERE id = ?;`,
        [JSON.stringify(mergedData), now, primary.id]
      );
      console.log(`     [APPLIED] Updated merged report row: ${primary.id} (${primary.ref_report})`);

      // 3. Keep work order synced
      try {
        const orderRes = db.exec('SELECT id, data FROM maintenance_orders WHERE ref_ot = ? LIMIT 1;', [ot]);
        if (orderRes.length > 0 && orderRes[0].values.length > 0) {
          const ordId = orderRes[0].values[0][0] as string;
          const ordData = JSON.parse(orderRes[0].values[0][1] as string);
          ordData.reportRef = primary.ref_report;
          db.run('UPDATE maintenance_orders SET data = ?, updated_at = ? WHERE id = ?;', [JSON.stringify(ordData), now, ordId]);
          console.log(`     [APPLIED] Synced work order ${ot} reportRef to ${primary.ref_report}`);
        }
      } catch (e) {
        console.warn(`     [WARNING] Could not sync work order for ${ot}:`, e);
      }
    }
  }

  if (isApply) {
    const exported = db.export();
    fs.writeFileSync(dbFile, Buffer.from(exported));
    console.log(`\n[APPLIED] Database successfully persisted to ${dbFile}.`);

    // If server is running, trigger reload
    try {
      await fetch('http://localhost:5033/api/full-state', { method: 'GET' });
    } catch {}
  } else {
    console.log(`\n[DRY-RUN] No changes were written. Run with "--apply" to execute the merge and deletion.`);
  }
}

main().catch(console.error);
