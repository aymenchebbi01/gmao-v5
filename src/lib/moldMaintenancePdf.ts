import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MoldMaintenance, Mold } from '../types/gmao';

export const generateMoldMaintenancePdf = (record: MoldMaintenance, mold?: Mold) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryBlue: [number, number, number] = [0, 102, 204];
  const darkNavy: [number, number, number] = [20, 35, 60];
  const purpleCol: [number, number, number] = [124, 58, 237];
  const lightPurple: [number, number, number] = [245, 243, 255];
  const greenText: [number, number, number] = [16, 149, 93];

  // Header band
  doc.setFillColor(purpleCol[0], purpleCol[1], purpleCol[2]);
  doc.rect(0, 0, 210, 22, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('THERMOPLASTICS TUNISIA - ATELIER OUTILLAGE', 14, 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(230, 220, 255);
  doc.text('Fiche Officielle de Maintenance & Réparation Moule d\'Injection', 14, 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`TICKET : ${record.id.toUpperCase()}`, 196, 12, { align: 'right' });

  let currentY = 32;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text(`FICHE INTERVENTION MOULE : ${record.moldNumber}`, 14, currentY);

  currentY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Date : ${record.date} | Lieu : ${record.repairLocation === 'external' ? 'Sous-traitance Externe' : 'Interne (Atelier Moules)'} | Statut : ${record.status === 'completed' ? 'Clôturée' : 'En Cours'}`,
    14,
    currentY
  );

  currentY += 7;

  // General Mold & Maintenance details table
  const infoRows = [
    [
      { content: 'N° de Moule', styles: { fontStyle: 'bold' as const, fillColor: lightPurple } },
      { content: record.moldNumber, styles: { fontStyle: 'bold' as const, textColor: purpleCol } },
      { content: 'Désignation Outillage', styles: { fontStyle: 'bold' as const, fillColor: lightPurple } },
      { content: mold?.description || 'Outillage Injection', styles: {} },
    ],
    [
      { content: 'Client / Référence', styles: { fontStyle: 'bold' as const, fillColor: lightPurple } },
      { content: mold?.customer || 'Thermoplastics', styles: {} },
      { content: 'Nombre d\'Empreintes', styles: { fontStyle: 'bold' as const, fillColor: lightPurple } },
      { content: mold?.cavities ? `${mold.cavities} empreintes` : 'Standard', styles: {} },
    ],
    [
      { content: 'Lieu d\'Intervention', styles: { fontStyle: 'bold' as const, fillColor: lightPurple } },
      { content: record.repairLocation === 'external' ? `Externe : ${record.supplierName || 'Sous-traitant'}` : 'Atelier Outillage Usine', styles: {} },
      { content: 'Ordre de Travail Lié', styles: { fontStyle: 'bold' as const, fillColor: lightPurple } },
      { content: record.workOrderId || 'N/A', styles: { fontStyle: 'bold' as const } },
    ],
    [
      { content: 'Statut Sortie Réparation', styles: { fontStyle: 'bold' as const, fillColor: lightPurple } },
      { content: record.closedStatusChoice || (record.status === 'completed' ? 'En Stock' : 'En cours de travaux'), styles: { fontStyle: 'bold' as const } },
      { content: 'Coût Estimatif Travaux', styles: { fontStyle: 'bold' as const, fillColor: lightPurple } },
      { content: record.costTnd ? `${record.costTnd.toFixed(2)} TND` : 'Inclus atelier', styles: { fontStyle: 'bold' as const, textColor: greenText } },
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    body: infoRows as any,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: [220, 226, 235],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 50 },
      2: { cellWidth: 45 },
      3: { cellWidth: 42 },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Issue description
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text('DESCRIPTION DE LA DÉFAILLANCE / PROBLÈME OUTILLAGE', 14, currentY);

  currentY += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 50);

  const splitIssue = doc.splitTextToSize(record.issueDescription || 'Aucune description fournie', 182);
  doc.setFillColor(250, 250, 252);
  doc.setDrawColor(220, 226, 235);
  doc.roundedRect(14, currentY, 182, Math.max(12, splitIssue.length * 4.5 + 4), 2, 2, 'FD');
  doc.text(splitIssue, 17, currentY + 6);

  currentY += Math.max(16, splitIssue.length * 4.5 + 10);

  // Actions Performed List
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text('TRAVAUX & ACTIONS DE RÉPARATION EFFECTUÉS', 14, currentY);

  currentY += 4;

  const actionRows = (record.actionsPerformed || ['Maintenance effectuée']).map((act, idx) => [
    `#${idx + 1}`,
    act,
    'Conforme',
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['N°', 'Action / Opération d\'Ajustage & Réparation', 'Résultat']],
    body: actionRows,
    theme: 'striped',
    headStyles: {
      fillColor: purpleCol,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
    },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 140 },
      2: { cellWidth: 27, halign: 'center', fontStyle: 'bold', textColor: [16, 149, 93] },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 12;

  // Signatures
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text('VALIDATION & CLÔTURE ATELIER MOULES', 14, currentY);

  currentY += 4;
  const colW = 88;
  const h = 26;

  // Box 1: Technicien Mouliste
  doc.setDrawColor(200, 205, 215);
  doc.setFillColor(250, 252, 255);
  doc.roundedRect(14, currentY, colW, h, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Technicien Outilleur / Mouliste :', 17, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Visa & Date : __________________________', 17, currentY + 12);
  doc.text('Statut final : Conforme pour production', 17, currentY + 18);

  // Box 2: Responsable Outillage / Méthodes
  doc.roundedRect(14 + colW + 6, currentY, colW, h, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Responsable Outillage & Technique :', 14 + colW + 9, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Visa & Date : __________________________', 14 + colW + 9, currentY + 12);
  doc.text('Bon pour accord & clôture GMAO', 14 + colW + 9, currentY + 18);

  // Save
  doc.save(`Fiche_Maintenance_Moule_${record.moldNumber}_${record.date}.pdf`);
};
