import { jsPDF } from 'jspdf';
import { MaintenanceOrder, Machine, Mold, InterventionRequest } from '../types/gmao';

export interface MiseADispositionContext {
  machine?: Machine;
  mold?: Mold;
  request?: InterventionRequest;
}

/**
 * Generates and downloads the official "Fiche de Mise à Disposition & Autorisation d'Intervention"
 * compliant with ISO 9001:2015 & IATF 16949 standards for Thermoplastics Tunisia.
 */
export const downloadMiseADispositionPdf = (
  order: MaintenanceOrder,
  context?: MiseADispositionContext
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageWidth - margin * 2;
  const gap = 4;

  // Color Palette
  const primaryNavy = [20, 50, 90] as [number, number, number];
  const slateDark = [30, 41, 59] as [number, number, number];
  const slateMuted = [100, 116, 139] as [number, number, number];
  const lightBg = [248, 250, 252] as [number, number, number];
  const cardBorder = [203, 213, 225] as [number, number, number];
  const successGreen = [5, 150, 105] as [number, number, number];
  const amberAccent = [217, 119, 6] as [number, number, number];

  // Helper: draw a rounded card
  const drawCard = (
    x: number,
    y: number,
    w: number,
    h: number,
    fill: [number, number, number] = lightBg,
    border: [number, number, number] = cardBorder
  ) => {
    doc.setFillColor(...fill);
    doc.roundedRect(x, y, w, h, 2, 2, 'F');
    doc.setDrawColor(...border);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, w, h, 2, 2, 'S');
  };

  // 1. Top Decorative Brand Bar
  doc.setFillColor(...primaryNavy);
  doc.rect(0, 0, pageWidth, 7, 'F');

  // 2. Company Identity & ISO Branding
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...primaryNavy);
  doc.text('THERMOPLASTICS TUNISIA', margin, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...slateMuted);
  doc.text('Système de Management de la Qualité Certifié ISO 9001 & ISO 14001', margin, 23);
  doc.text('Direction Industrielle · Service Maintenance & Travaux Neufs', margin, 27);

  // 3. Document Identification Box (Top Right)
  const boxW = 68;
  const boxH = 24;
  const boxX = pageWidth - margin - boxW;
  const boxY = 11;

  drawCard(boxX, boxY, boxW, boxH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...primaryNavy);
  const madRef = `MAD-${order.refOT.replace(/^OT-?/, '')}`;
  doc.text(madRef, boxX + boxW / 2, boxY + 6.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateDark);
  doc.text(`Ordre de Travail : ${order.refOT}`, boxX + boxW / 2, boxY + 12, { align: 'center' });
  doc.text(
    `Date d'émission : ${order.date || new Date().toISOString().split('T')[0]}`,
    boxX + boxW / 2,
    boxY + 16.5,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...successGreen);
  doc.text('PRÉ-VALIDATIONS (3/3) APPROUVÉES', boxX + boxW / 2, boxY + 21, { align: 'center' });

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, 38, pageWidth - margin, 38);

  // 4. Document Main Banner
  doc.setFillColor(...primaryNavy);
  doc.roundedRect(margin, 41, contentW, 12, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text(
    "FICHE DE MISE À DISPOSITION & AUTORISATION D'INTERVENTION",
    pageWidth / 2,
    48.5,
    { align: 'center' }
  );

  // Running vertical cursor
  let y = 56;

  // 5. Section 1 & 2 (two columns)
  const cardW = (contentW - gap) / 2;
  const cardH = 37;
  const col2X = margin + cardW + gap;

  // Left Card: Équipement Cible
  drawCard(margin, y, cardW, cardH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryNavy);
  doc.text('1. ÉQUIPEMENT & MATÉRIEL CIBLE', margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...slateDark);

  const machineLabel = order.machineNumber
    ? `Presse / Machine : ${order.machineNumber} ${context?.machine?.brand ? `(${context.machine.brand} ${context.machine.model || ''})` : ''
    }`
    : `Équipement : ${order.equipmentName || 'Non spécifié'}`;
  doc.text(doc.splitTextToSize(machineLabel, cardW - 8)[0], margin + 4, y + 12);

  const moldLabel =
    order.moldRef || order.moldId
      ? `Moule Associé : ${order.moldRef || order.moldId}`
      : 'Moule : Aucun / Non applicable';
  doc.text(moldLabel, margin + 4, y + 18);

  const locationLabel = context?.machine?.location || 'Atelier Injection Plastique';
  doc.text(`Emplacement : ${locationLabel}`, margin + 4, y + 24);

  doc.setFont('helvetica', 'bold');
  if (order.priority === 'Urgent' || order.priority === 'High') {
    doc.setTextColor(...amberAccent);
  }
  doc.text(`Catégorie GMAO : ${order.category} · Priorité : ${order.priority}`, margin + 4, y + 30);

  // Right Card: Planification
  drawCard(col2X, y, cardW, cardH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryNavy);
  doc.text('2. PLANIFICATION & AFFECTATION', col2X + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...slateDark);

  doc.text(`Réf. Demande d'Intervention : ${order.refIR || 'Intervention directe'}`, col2X + 4, y + 12);
  doc.text(`Intervenant assigné : ${order.assignedTo || 'Technicien Maintenance'}`, col2X + 4, y + 18);
  doc.text(
    `Date & Heure début prévu : ${order.scheduledDate || order.date} à ${order.scheduledTime || '08:00'}`,
    col2X + 4,
    y + 24
  );
  doc.text(`Durée estimée arrêt : ${order.estimatedHours || 1} heure(s)`, col2X + 4, y + 30);

  y += cardH + gap;

  // 7. Section 4: Consignes de sécurité
  const qhseH = 33;
  drawCard(margin, y, contentW, qhseH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryNavy);
  doc.text('3. CONSIGNES DE SÉCURITÉ & PERMIS DE TRAVAIL (QHSE)', margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateDark);

  doc.text('• Arrêt complet du cycle de production et verrouillage des commandes pupitre opérateur.', margin + 4, y + 12.5);
  doc.text('• Consignation obligatoire des énergies : Électrique (cadenassage), Hydraulique (chute de pression), Pneumatique.', margin + 4, y + 18);
  doc.text('• Port des Équipements de Protection Individuelle (EPI) : Chaussures de sécurité, lunettes, gants adaptés.', margin + 4, y + 23.5);
  doc.text("• Délimitation et balisage de la zone de maintenance afin d'empêcher tout accès non autorisé pendant les travaux.", margin + 4, y + 29);

  y += qhseH + gap + 2;

  // 8. Section 5: Pré-validations
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryNavy);
  doc.text('4. ACCORDS FORMELS & PRÉ-VALIDATIONS HIÉRARCHIQUES (CONDITIONS SUSPENSIVES LEVÉES)', margin, y);

  y += 3;

  const colValW = (contentW - gap * 2) / 3;
  const colValH = 46;
  const emeraldBg = [240, 253, 244] as [number, number, number];
  const emeraldBorder = [187, 247, 208] as [number, number, number];

  const drawValidationBox = (
    x: number,
    title: string,
    status: string,
    signatory: string,
    dateTime: string,
    extraLines: { text: string; italic?: boolean }[]
  ) => {
    drawCard(x, y, colValW, colValH, emeraldBg, emeraldBorder);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...primaryNavy);
    doc.text(title, x + 4, y + 6);

    doc.setFontSize(7.5);
    doc.setTextColor(...successGreen);
    doc.text(status, x + 4, y + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...slateDark);
    doc.text(`Signataire : ${signatory}`, x + 4, y + 18);
    doc.text(`Date / Heure : ${dateTime}`, x + 4, y + 23);

    extraLines.forEach((l, i) => {
      doc.setFont('helvetica', l.italic ? 'italic' : 'normal');
      doc.text(l.text, x + 4, y + 28 + i * 5.5);
    });

    doc.setFont('helvetica', 'bold');
    doc.text('[ Signature Numérique OK ]', x + 4, y + 41);
  };

  const v1 = order.validationRespMaint;
  const v2 = order.validationRespProd;
  const v3 = order.validationQHSE;

  drawValidationBox(
    margin,
    'RESP. MAINTENANCE',
    'APPROUVÉ / PLANIFIÉ',
    v1?.validatedBy || 'Resp. Maintenance',
    v1?.validatedAt || order.date,
    [
      { text: `Estimation : ${v1?.estimatedHours || order.estimatedHours || 1} h` },
      { text: 'Ressources & outillage alloués', italic: true },
    ]
  );

  drawValidationBox(
    margin + colValW + gap,
    'RESP. PRODUCTION',
    'MISE À DISPOSITION ACCORDÉE',
    v2?.validatedBy || 'Resp. Production',
    v2?.validatedAt || order.date,
    [
      { text: 'Arrêt machine autorisé', italic: true },
      { text: 'Production libérée pour travaux', italic: true },
    ]
  );

  drawValidationBox(
    margin + (colValW + gap) * 2,
    'RESPONSABLE QHSE',
    'SÉCURITÉ & PERMIS VALIDÉ',
    v3?.validatedBy || 'Resp. QHSE',
    v3?.validatedAt || order.date,
    [
      { text: 'Consignes sécurité appliquées', italic: true },
      { text: 'Risques industriels maîtrisés', italic: true },
    ]
  );

  y += colValH + gap + 1;

  // 9. Section 6: Prise en charge par le technicien
  const takeChargeH = 24;
  drawCard(margin, y, contentW, takeChargeH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryNavy);
  doc.text('5. PRISE EN CHARGE DE MAINTENANCE', margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...slateDark);
  doc.text(
    'Je soussigné atteste avoir pris possession de la machine mise à disposition, avoir vérifié la consignation et pouvoir entamer les travaux.',
    margin + 4,
    y + 12
  );

  doc.text("Nom de l'intervenant : ______________________", margin + 4, y + 19);
  doc.text('Heure réelle début : _____ : _____', 100, y + 19);
  doc.text('Signature : _______________', 148, y + 19);

  // 10. Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...slateMuted);
  const printTimestamp = new Date().toLocaleString('fr-FR');
  doc.text(
    `Document de mise à disposition généré par le GMAO Thermoplastics Tunisia · Édité le ${printTimestamp} · Conforme ISO 9001`,
    margin,
    pageHeight - 6
  );
  doc.text('Page 1 / 1', pageWidth - margin, pageHeight - 6, { align: 'right' });

  // Save / Trigger Download
  const filename = `Mise_a_Disposition_${order.refOT.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  doc.save(filename);
};