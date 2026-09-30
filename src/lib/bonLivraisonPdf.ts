import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DeliveryNote } from '../types/gmao';

export const downloadBonLivraisonPdf = (note: DeliveryNote) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Primary Colors (Industry Navy & Accents)
  const primaryColor = [20, 50, 90] as [number, number, number];
  const accentColor = [16, 185, 129] as [number, number, number];
  const darkTextColor = [30, 41, 59] as [number, number, number];
  const lightBgColor = [241, 245, 249] as [number, number, number];

  // --- Top Header Decorative Band ---
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 8, 'F');

  // --- Company Branding ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...primaryColor);
  doc.text('THERMOPLASTICS TUNISIA', 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Zone Industrielle Zaghouan - 1100, Tunisie', 14, 25);

  // --- Document Box Header (Top Right) ---
  doc.setFillColor(...lightBgColor);
  doc.roundedRect(pageWidth - 75, 14, 61, 22, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(pageWidth - 75, 14, 61, 22, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text(note.refBL, pageWidth - 44.5, 21, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Date : ${note.date}`, pageWidth - 44.5, 27, { align: 'center' });
  doc.text('Doc Ref: DOC-MAG-BL-2026', pageWidth - 44.5, 32, { align: 'center' });

  // --- Horizontal Divider ---
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 40, pageWidth - 14, 40);

  // --- Document Title Banner ---
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 44, pageWidth - 28, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('BON DE RÉCEPTION & LIVRAISON MAGASIN PDR', pageWidth / 2, 51.5, { align: 'center' });

  // --- Two Column Info Cards ---
  // Left: Fournisseur
  doc.setFillColor(...lightBgColor);
  doc.roundedRect(14, 60, (pageWidth - 32) / 2, 34, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, 60, (pageWidth - 32) / 2, 34, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);
  doc.text('FOURNISSEUR & EXPÉDITEUR', 18, 66);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkTextColor);
  doc.text('Société / Fournisseur :', 18, 73);
  doc.setFont('helvetica', 'bold');
  doc.text(note.supplier, 56, 73);

  doc.setFont('helvetica', 'normal');
  doc.text('N° Réf BL Fournisseur :', 18, 80);
  doc.setFont('helvetica', 'bold');
  doc.text(note.refBL, 56, 80);

  doc.setFont('helvetica', 'normal');
  doc.text('Destination Entrepôt :', 18, 87);
  doc.setFont('helvetica', 'normal');
  doc.text('Magasin Central PDR & Maintenance', 56, 87);

  // Right: Réception & Contrôle
  const rightX = 14 + (pageWidth - 32) / 2 + 4;
  doc.setFillColor(...lightBgColor);
  doc.roundedRect(rightX, 60, (pageWidth - 32) / 2, 34, 2, 2, 'F');
  doc.roundedRect(rightX, 60, (pageWidth - 32) / 2, 34, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);
  doc.text('RÉCEPTION & CONTRÔLE CONFORMITÉ', rightX + 4, 66);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkTextColor);
  doc.text('Réceptionné Par :', rightX + 4, 73);
  doc.setFont('helvetica', 'bold');
  doc.text(note.receivedBy, rightX + 40, 73);

  doc.setFont('helvetica', 'normal');
  doc.text('Statut Inspection :', rightX + 4, 80);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text(note.status || 'Conforme / Réceptionné', rightX + 40, 80);

  doc.setTextColor(...darkTextColor);
  doc.setFont('helvetica', 'normal');
  doc.text('Type Mouvement :', rightX + 4, 87);
  doc.text('Entrée Réassort Stock Magasin', rightX + 40, 87);

  // --- Items Table with autoTable ---
  const tableData = note.items.map((it, index) => [
    String(index + 1),
    it.partNumber,
    it.description,
    String(it.qty),
    `${it.unitPrice.toFixed(2)} TND`,
    `${(it.qty * it.unitPrice).toFixed(2)} TND`,
  ]);

  autoTable(doc, {
    startY: 100,
    head: [['#', 'Réf. Article PDR', 'Désignation / Spécification Pièce', 'Qté', 'Prix Unit.', 'Total HT']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [20, 50, 90],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 38, fontStyle: 'bold', textColor: [29, 78, 216] },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
  });

  // Calculate table end Y
  const finalY = (doc as any).lastAutoTable?.finalY || 150;

  // --- Total Summary Box ---
  const summaryBoxY = Math.min(finalY + 8, pageHeight - 65);
  doc.setFillColor(...lightBgColor);
  doc.roundedRect(pageWidth - 90, summaryBoxY, 76, 26, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(pageWidth - 90, summaryBoxY, 76, 26, 2, 2, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Total Articles Reçus :', pageWidth - 86, summaryBoxY + 7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkTextColor);
  doc.text(`${note.totalItems} pcs`, pageWidth - 18, summaryBoxY + 7, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Statut Conformité :', pageWidth - 86, summaryBoxY + 14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text(note.status, pageWidth - 18, summaryBoxY + 14, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...primaryColor);
  doc.text('Montant Total Facture :', pageWidth - 86, summaryBoxY + 22);
  doc.text(`${note.totalAmount.toFixed(2)} TND`, pageWidth - 18, summaryBoxY + 22, { align: 'right' });

  // --- Quality & Signatures Section ---
  const signY = summaryBoxY + 32;
  if (signY < pageHeight - 30) {
    const colW = (pageWidth - 36) / 3;

    // Box 1: Livreur
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, signY, colW, 20, 1.5, 1.5, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('VISA / SIGNATURE LIVREUR', 18, signY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Nom & Cachet transporteur', 18, signY + 9);

    // Box 2: Réceptionnaire Magasin
    doc.roundedRect(14 + colW + 4, signY, colW, 20, 1.5, 1.5, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('RÉCEPTIONNAIRE MAGASIN', 18 + colW + 4, signY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(note.receivedBy, 18 + colW + 4, signY + 9);
    doc.text('Emargement & Date', 18 + colW + 4, signY + 13);

    // Box 3: Contrôle Qualité / Technique
    doc.roundedRect(14 + (colW + 4) * 2, signY, colW, 20, 1.5, 1.5, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('RESPONSABLE MAINTENANCE', 18 + (colW + 4) * 2, signY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Conformité pièces & intégration stock', 18 + (colW + 4) * 2, signY + 9);
  }

  // --- Document Footer ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Document officiel généré automatiquement par le GMAO Thermoplastics Tunisia · ${new Date().toLocaleString()}`,
    14,
    pageHeight - 8
  );
  doc.text('Page 1 / 1', pageWidth - 14, pageHeight - 8, { align: 'right' });

  // Save / Trigger Download
  const filename = `Bon_Livraison_${note.refBL.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  doc.save(filename);
};
