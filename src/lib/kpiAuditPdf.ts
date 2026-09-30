import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Machine, Mold, InterventionReport, MaintenanceOrder } from '../types/gmao';

interface AuditReportPdfOptions {
  startDate?: string;
  endDate?: string;
  dateRangeLabel: string;
  availabilityRate: string;
  avgMtbf: number;
  avgMttr: string;
  preventiveRatio: number;
  totalCostTnd: number;
  sparePartsCostTnd: number;
  laborCostTnd: number;
  externalCostTnd: number;
  totalDowntimeHours: number;
  machines: Machine[];
  molds: Mold[];
  reports: InterventionReport[];
  orders: MaintenanceOrder[];
  generatedBy?: string;
}

export const downloadKpiAuditPdf = (options: AuditReportPdfOptions) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryBlue: [number, number, number] = [0, 102, 204]; // #0066cc
  const darkNavy: [number, number, number] = [20, 35, 60];
  const neutralGray: [number, number, number] = [100, 116, 139];
  const emeraldGreen: [number, number, number] = [16, 149, 93];

  let currentY = 14;

  // 1. HEADER SECTION
  doc.setFillColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.rect(0, 0, 210, 24, 'F');

  // Company Name & Logo title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('THERMOPLASTICS TUNISIA', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 220, 255);
  doc.text('Société de Plasturgie Industrielle & Injection Haute Précision - Z.I. Ben Arous, Tunisie', 14, 16);
  doc.text('Système GMAO - Division Direction Technique & Management de la Performance', 14, 20);

  // Document Badge on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('RAPPORT AUDIT DIRECTION', 196, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(220, 235, 255);
  doc.text(`Édité le : ${new Date().toISOString().replace('T', ' ').slice(0, 16)}`, 196, 18, { align: 'right' });

  currentY = 32;

  // 2. DOCUMENT TITLE & SCOPE
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text('RAPPORT DE PERFORMANCE GMAO & AUDIT DES COÛTS DE MAINTENANCE', 14, currentY);

  currentY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(neutralGray[0], neutralGray[1], neutralGray[2]);
  doc.text(
    `Période d'analyse : ${options.dateRangeLabel} | Périmètre : Ensemble du Parc Machines (Presses Injection), Outillages (Moules) & Utilités`,
    14,
    currentY
  );

  currentY += 8;

  // 3. EXECUTIVE KPI CARDS TABLE (Compact grid)
  const kpiData = [
    [
      { content: 'Disponibilité Opérationnelle', styles: { fontStyle: 'bold' as const, textColor: darkNavy } },
      { content: `${options.availabilityRate}%`, styles: { fontStyle: 'bold' as const, textColor: emeraldGreen, halign: 'center' as const } },
      { content: 'MTBF Moyen Usine', styles: { fontStyle: 'bold' as const, textColor: darkNavy } },
      { content: `${options.avgMtbf} hrs`, styles: { fontStyle: 'bold' as const, textColor: primaryBlue, halign: 'center' as const } },
    ],
    [
      { content: 'MTTR Moyen (Temps Réparation)', styles: { fontStyle: 'bold' as const, textColor: darkNavy } },
      { content: `${options.avgMttr} hrs`, styles: { fontStyle: 'bold' as const, halign: 'center' as const } },
      { content: 'Taux Maintenance Préventive', styles: { fontStyle: 'bold' as const, textColor: darkNavy } },
      { content: `${options.preventiveRatio}%`, styles: { fontStyle: 'bold' as const, halign: 'center' as const } },
    ],
    [
      { content: 'Temps d\'Arrêt Total (Downtime)', styles: { fontStyle: 'bold' as const, textColor: darkNavy } },
      { content: `${options.totalDowntimeHours} hrs`, styles: { fontStyle: 'bold' as const, halign: 'center' as const } },
      { content: 'Interventions Réalisées', styles: { fontStyle: 'bold' as const, textColor: darkNavy } },
      { content: `${options.reports.length} rapports`, styles: { fontStyle: 'bold' as const, halign: 'center' as const } },
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    body: kpiData,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      lineColor: [220, 226, 235],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 55, fillColor: [248, 250, 252] },
      1: { cellWidth: 40 },
      2: { cellWidth: 55, fillColor: [248, 250, 252] },
      3: { cellWidth: 32 },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 7;

  // 4. FINANCIAL SECTION: MAINTENANCE COSTS BREAKDOWN (TCO)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text('1. SYNTHÈSE FINANCIÈRE & COÛTS DE MAINTENANCE (TND)', 14, currentY);

  currentY += 3;

  const costTableData = [
    [
      'Pièces de Rechange (PDR Consommées)',
      `${options.sparePartsCostTnd.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TND`,
      `${options.totalCostTnd > 0 ? Math.round((options.sparePartsCostTnd / options.totalCostTnd) * 100) : 0}%`,
      'Composants hydrauliques, chauffants, buses, joints et consommables prélevés du stock magasin.',
    ],
    [
      'Main-d\'Œuvre Interne (Techniciens Usine)',
      `${options.laborCostTnd.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TND`,
      `${options.totalCostTnd > 0 ? Math.round((options.laborCostTnd / options.totalCostTnd) * 100) : 0}%`,
      'Temps d\'intervention cumulé des techniciens d\'atelier valorisé à taux horaire conventionnel.',
    ],
    [
      'Prestations Externes & Sous-Traitance Moules',
      `${options.externalCostTnd.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TND`,
      `${options.totalCostTnd > 0 ? Math.round((options.externalCostTnd / options.totalCostTnd) * 100) : 0}%`,
      'Usinage externe, rechargement laser, devis outilleurs et maintenance spécialisée.',
    ],
    [
      'COÛT GLOBAL TOTAL DE MAINTENANCE',
      `${options.totalCostTnd.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TND`,
      '100%',
      'Total des charges de maintenance opérationnelle sur la période sélectionnée.',
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Poste de Dépense', 'Montant (TND)', 'Part (%)', 'Justification & Observations']],
    body: costTableData,
    theme: 'striped',
    headStyles: {
      fillColor: primaryBlue,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2.2,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
    },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: 'bold' },
      1: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 67, fontSize: 7.5, textColor: [80, 80, 80] },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 7;

  // 5. TOP 5 MACHINES BY DOWNTIME & MAINTENANCE EXPENSES
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text('2. PARC MACHINES : FIABILITÉ & COÛTS PAR PRESSE', 14, currentY);

  currentY += 3;

  const machineTableRows = options.machines.map((m) => {
    const machineReports = options.reports.filter(
      (r) => r.equipmentId === m.id || (r.equipmentName && r.equipmentName.includes(m.number))
    );
    const partsCost = machineReports.reduce((acc, r) => acc + (r.sparePartsCost || 0), 0);
    const laborCost = machineReports.reduce((acc, r) => acc + (r.laborCost || 0), 0);
    const mCost = partsCost + laborCost;

    return [
      m.number,
      `${m.brand || ''} ${m.model || ''}`,
      m.clampingForce ? `${m.clampingForce} T` : '320 T',
      `${m.mtbfHours ?? 450}h`,
      `${m.mttrHours ?? 1.8}h`,
      m.status,
      `${mCost.toFixed(2)} TND`,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Presse', 'Modèle / Marque', 'Force (T)', 'MTBF', 'MTTR', 'Statut Actuel', 'Coût Cumulé']],
    body: machineTableRows,
    theme: 'striped',
    headStyles: {
      fillColor: darkNavy,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2,
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 20, fontStyle: 'bold' },
      1: { cellWidth: 50 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 25, halign: 'center' },
      6: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 7;

  // Check if we need to add a second page for root causes & signatures
  if (currentY > 210) {
    doc.addPage();
    currentY = 16;
  }

  // 6. PARETO ROOT CAUSES DISTRIBUTION
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text('3. TYPOLOGIE & RÉPARTITION PARETO DES PANNES', 14, currentY);

  currentY += 3;

  const causesCount: Record<string, number> = {
    Hydraulique: 0,
    Électrique: 0,
    Mécanique: 0,
    'Thermique / Refroidissement': 0,
    'Moule & Empreintes': 0,
    Pneumatique: 0,
  };

  options.reports.forEach((r) => {
    if (r.cause.includes('Hydraulic')) causesCount.Hydraulique += 1;
    else if (r.cause.includes('Electrical')) causesCount.Électrique += 1;
    else if (r.cause.includes('Mechanical')) causesCount.Mécanique += 1;
    else if (r.cause.includes('Thermal')) causesCount['Thermique / Refroidissement'] += 1;
    else if (r.cause.includes('Mold') || r.category === 'Mold') causesCount['Moule & Empreintes'] += 1;
    else causesCount.Hydraulique += 1;
  });

  const totalIncidents = Math.max(1, options.reports.length);
  const paretoRows = Object.entries(causesCount).map(([cause, count]) => {
    const pct = Math.round((count / totalIncidents) * 100);
    return [cause, count.toString(), `${pct}%`, `${count * 45} min`];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Cause Racine / Sous-système', 'Occurrences', 'Fréquence (%)', 'Temps d\'arrêt estimé']],
    body: paretoRows,
    theme: 'grid',
    headStyles: {
      fillColor: [80, 95, 115],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2,
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: 'bold' },
      1: { cellWidth: 35, halign: 'center' },
      2: { cellWidth: 35, halign: 'center' },
      3: { cellWidth: 42, halign: 'center' },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 9;

  // 7. OFFICIAL SIGNATURES & VALIDATION BLOCKS
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text('VISA & APPROBATIONS DE LA DIRECTION', 14, currentY);

  currentY += 4;

  const colW = 58;
  const h = 28;

  // Box 1: Responsable Maintenance
  doc.setDrawColor(200, 205, 215);
  doc.setFillColor(250, 252, 255);
  doc.roundedRect(14, currentY, colW, h, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 50, 70);
  doc.text('Responsable Maintenance Usine', 17, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(110, 120, 135);
  doc.text('Date & Visa : ______________________', 17, currentY + 12);
  doc.text('Signature / Bon pour validation :', 17, currentY + 18);

  // Box 2: Responsable Technique
  doc.roundedRect(14 + colW + 4, currentY, colW, h, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 50, 70);
  doc.text('Responsable Technique & Méthodes', 14 + colW + 7, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(110, 120, 135);
  doc.text('Date & Visa : ______________________', 14 + colW + 7, currentY + 12);
  doc.text('Signature / Bon pour validation :', 14 + colW + 7, currentY + 18);

  // Box 3: Direction Générale / Usine
  doc.roundedRect(14 + (colW + 4) * 2, currentY, colW, h, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 50, 70);
  doc.text('Direction Générale & Usine', 14 + (colW + 4) * 2 + 3, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(110, 120, 135);
  doc.text('Date & Visa : ______________________', 14 + (colW + 4) * 2 + 3, currentY + 12);
  doc.text('Signature / Bon pour accord :', 14 + (colW + 4) * 2 + 3, currentY + 18);

  // Footer on all pages
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(130, 140, 155);
    doc.text(
      `Thermoplastics Tunisia GMAO · Audit de Performance Direction · Document Officiel Confidentiel · Page ${i} sur ${pageCount}`,
      105,
      290,
      { align: 'center' }
    );
  }

  // Save / Trigger Download
  const filename = `Rapport_Audit_GMAO_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};
