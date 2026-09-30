import { Mold } from '../types/gmao';

export const generateFicheTechniqueMoulePdf = (
  mold: Mold,
  signer?: { name: string; role: string; signatureUrl?: string }
) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Veuillez autoriser les fenêtres pop-up pour afficher la fiche technique moule.');
    return;
  }

  const dateStr = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>Fiche Moule - ${mold.moldNumber || mold.ref}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 24px;
            font-size: 12px;
            line-height: 1.4;
            background: #fff;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            border-bottom: 2px solid #047857;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .brand-title {
            font-size: 20px;
            font-weight: 900;
            color: #047857;
            letter-spacing: -0.5px;
          }
          .brand-sub {
            font-size: 10px;
            color: #64748b;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 1px;
          }
          .doc-badge {
            display: inline-block;
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
            color: #047857;
            padding: 4px 10px;
            border-radius: 6px;
            font-weight: 800;
            font-size: 11px;
            text-align: right;
          }
          .section-title {
            font-size: 12px;
            font-weight: 800;
            color: #047857;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1.5px solid #cbd5e1;
            padding-bottom: 4px;
            margin-top: 14px;
            margin-bottom: 8px;
          }
          .info-grid {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
          }
          .info-grid td {
            padding: 5px 8px;
            border: 1px solid #e2e8f0;
            font-size: 11px;
          }
          .label-cell {
            background-color: #f8fafc;
            color: #475569;
            font-weight: 700;
            width: 25%;
          }
          .value-cell {
            color: #0f172a;
            font-weight: 600;
            width: 25%;
          }
          .status-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 800;
            font-size: 10px;
            text-transform: uppercase;
          }
          .status-in-stock { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
          .status-in-use { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
          .status-in-maintenance { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
          .status-exported { background: #f3e8ff; color: #7e22ce; border: 1px solid #d8b4fe; }
          .check-pill {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 700;
            font-size: 10px;
            margin-right: 4px;
          }
          .check-yes { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
          .check-no { background: #f1f5f9; color: #94a3b8; border: 1px solid #e2e8f0; text-decoration: line-through; }
          .signatures {
            margin-top: 30px;
            display: flex;
            justify-content: space-between;
          }
          .sig-box {
            width: 45%;
            border: 1px dashed #94a3b8;
            border-radius: 8px;
            padding: 10px;
            text-align: center;
            font-size: 10px;
            color: #64748b;
          }
          .sig-title {
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 30px;
          }
          .print-btn-bar {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #1e293b;
            padding: 10px 16px;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            display: flex;
            gap: 10px;
            z-index: 999;
          }
          .print-btn {
            background: #059669;
            color: white;
            border: none;
            padding: 8px 16px;
            font-weight: 700;
            border-radius: 8px;
            cursor: pointer;
            font-size: 12px;
          }
          .print-btn:hover { background: #047857; }
        </style>
      </head>
      <body>
        <div class="print-btn-bar no-print">
          <button class="print-btn" onclick="window.print()">Imprimer / Télécharger PDF</button>
        </div>

        <table class="header-table">
          <tr>
            <td style="width: 65%;">
              <div class="brand-title">THERMOPLASTICS TUNISIA</div>
              <div class="brand-sub">Atelier Outillage & Maintenance des Moules</div>
              <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 6px;">
                FICHE TECHNIQUE MOULE D'INJECTION
              </div>
            </td>
            <td style="width: 35%; text-align: right; vertical-align: top;">
              <div class="doc-badge">MLD-${mold.moldNumber || mold.ref || '001'}</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Édité le : ${dateStr}</div>
              <div style="font-size: 10px; color: #64748b;">Statut : ${mold.status}</div>
            </td>
          </tr>
        </table>

        <!-- IDENTIFICATION GÉNÉRALE -->
        <div class="section-title">1. Identification du Moule & Emplacement</div>
        <table class="info-grid">
          <tr>
            <td class="label-cell">Référence Moule :</td>
            <td class="value-cell font-mono font-bold" style="color: #047857;">${mold.moldNumber || mold.ref}</td>
            <td class="label-cell">Statut Actuel :</td>
            <td class="value-cell">
              <span class="status-badge ${
                mold.status === 'In Use'
                  ? 'status-in-use'
                  : mold.status === 'In Stock'
                  ? 'status-in-stock'
                  : mold.status === 'In Maintenance'
                  ? 'status-in-maintenance'
                  : 'status-exported'
              }">
                ${mold.status}
              </span>
            </td>
          </tr>
          <tr>
            <td class="label-cell">Désignation / Pièce :</td>
            <td class="value-cell" colspan="3">${mold.description || 'Outillage d\'injection plastique'}</td>
          </tr>
          <tr>
            <td class="label-cell">Emplacement :</td>
            <td class="value-cell font-bold">${mold.location || mold.rackLocation || 'Rack A-01'}</td>
            <td class="label-cell">Client / Projet :</td>
            <td class="value-cell">${mold.customer || 'Automotive OEM (Valeo / Renault / Legrand)'}</td>
          </tr>
          <tr>
            <td class="label-cell">Matière / Résine :</td>
            <td class="value-cell">${mold.resin || 'PA66-GF30 / PP EPDM'}</td>
            <td class="label-cell">Nombre d'Empreintes :</td>
            <td class="value-cell font-bold">${mold.cavities || 4} empreintes</td>
          </tr>
          <tr>
            <td class="label-cell">Temps de Cycle Nominal :</td>
            <td class="value-cell">${mold.cycleTimeSec ? `${mold.cycleTimeSec} s` : '18.5 s'}</td>
            <td class="label-cell">Date d'Exportation :</td>
            <td class="value-cell">${mold.exportDate ? mold.exportDate.substring(0, 10) : 'Non applicable'}</td>
          </tr>
        </table>

        <!-- CARACTÉRISTIQUES TECHNIQUES -->
        <div class="section-title">2. Caractéristiques Techniques & Systèmes d'Alimentation</div>
        <table class="info-grid">
          <tr>
            <td class="label-cell">Force de Fermeture (MC T) :</td>
            <td class="value-cell font-bold">${mold.clampingForceRange || '50t / 60t / 100t'}</td>
            <td class="label-cell">Poids Total / Autres :</td>
            <td class="value-cell">${mold.othersWeight || '320 KG'}</td>
          </tr>
          <tr>
            <td class="label-cell">Configuration Plaques :</td>
            <td class="value-cell">
              <span class="check-pill ${mold.plateType2 ? 'check-yes' : 'check-no'}">2 Plate</span>
              <span class="check-pill ${mold.plateType3 ? 'check-yes' : 'check-no'}">3 Plate</span>
            </td>
            <td class="label-cell">Systèmes & Composants :</td>
            <td class="value-cell">
              <span class="check-pill ${mold.ewocon ? 'check-yes' : 'check-no'}">EWOCON</span>
              <span class="check-pill ${mold.dme ? 'check-yes' : 'check-no'}">DME</span>
              <span class="check-pill ${mold.flatNozzle ? 'check-yes' : 'check-no'}">Flat Nozzle</span>
            </td>
          </tr>
          <tr>
            <td class="label-cell">Commentaires & Particularités :</td>
            <td class="value-cell" colspan="3">${mold.comment || 'Outillage entretenu selon procédure TPM moules. Prêt pour campagne d\'injection.'}</td>
          </tr>
        </table>

        <!-- SUIVI COMPTEUR DE COUPS -->
        <div class="section-title">3. Compteur de Coups & État d'Usure</div>
        <table class="info-grid">
          <tr>
            <td class="label-cell">Coups Actuels :</td>
            <td class="value-cell font-mono font-bold">${(mold.currentShots || 125000).toLocaleString()} coups</td>
            <td class="label-cell">Limite Révision Préventive :</td>
            <td class="value-cell font-mono">${(mold.maxShotsBeforeMaintenance || 150000).toLocaleString()} coups</td>
          </tr>
          <tr>
            <td class="label-cell">Taux d'Usure / Potentiel :</td>
            <td class="value-cell font-bold" style="color: #047857;">
              ${Math.round(((mold.currentShots || 125000) / (mold.maxShotsBeforeMaintenance || 150000)) * 100)}% de la campagne
            </td>
            <td class="label-cell">Machine Assignée :</td>
            <td class="value-cell">${mold.assignedMachineNumber || 'Non installée'}</td>
          </tr>
        </table>

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-title">Responsable Atelier Outillage (Toolroom)</div>
            <div style="font-weight: 700; color: #047857;">${signer?.name || 'Chef d\'Atelier'}</div>
            <div>Visa & Contrôle Géométrique</div>
          </div>
          <div class="sig-box">
            <div class="sig-title">Direction Technique & Industrialisation</div>
            <div style="font-weight: 700; color: #047857;">${signer?.name || 'Direction Technique'}</div>
            <div>Validation Fiche Moule Usine</div>
          </div>
        </div>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};
