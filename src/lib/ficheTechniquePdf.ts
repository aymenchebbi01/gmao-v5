import { Machine } from '../types/gmao';

export const generateFicheTechniquePdf = (
  machine: Machine,
  signer?: { name: string; role: string; signatureUrl?: string }
) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Veuillez autoriser les fenêtres pop-up pour afficher la fiche technique.');
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
        <title>Fiche Technique - ${machine.name || machine.number}</title>
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
            border-bottom: 2px solid #1e3a8a;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .brand-title {
            font-size: 20px;
            font-weight: 900;
            color: #1e3a8a;
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
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            color: #1d4ed8;
            padding: 4px 10px;
            border-radius: 6px;
            font-weight: 800;
            font-size: 11px;
            text-align: right;
          }
          .section-title {
            font-size: 12px;
            font-weight: 800;
            color: #1e3a8a;
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
            padding: 4px 8px;
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
          .status-operational { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
          .status-down { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
          .status-maintenance { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
          .status-idle { background: #f3e8ff; color: #7e22ce; border: 1px solid #d8b4fe; }
          .plan-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
            font-size: 10px;
          }
          .plan-table th {
            background: #f1f5f9;
            color: #334155;
            font-weight: 800;
            padding: 6px 8px;
            border: 1px solid #cbd5e1;
            text-align: left;
          }
          .plan-table td {
            padding: 5px 8px;
            border: 1px solid #e2e8f0;
          }
          .signatures {
            margin-top: 24px;
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
            background: #2563eb;
            color: white;
            border: none;
            padding: 8px 16px;
            font-weight: 700;
            border-radius: 8px;
            cursor: pointer;
            font-size: 12px;
          }
          .print-btn:hover { background: #1d4ed8; }
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
              <div class="brand-sub">Système GMAO · Direction Technique & Maintenance</div>
              <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 6px;">
                FICHE TECHNIQUE MACHINE — INJECTION PLASTIQUE
              </div>
            </td>
            <td style="width: 35%; text-align: right; vertical-align: top;">
              <div class="doc-badge">FT-${machine.number || machine.serialNumber || '001'}</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Édité le : ${dateStr}</div>
              <div style="font-size: 10px; color: #64748b;">Réf Usine : #${machine.siteNumber || machine.number || 'M-01'}</div>
            </td>
          </tr>
        </table>

        <!-- IDENTIFICATION GÉNÉRALE -->
        <div class="section-title">1. Identification & État de la Machine</div>
        <table class="info-grid">
          <tr>
            <td class="label-cell">Désignation Machine :</td>
            <td class="value-cell">${machine.name || machine.number}</td>
            <td class="label-cell">Numéro de Série :</td>
            <td class="value-cell" style="font-family: monospace;">${machine.serialNumber || machine.number}</td>
          </tr>
          <tr>
            <td class="label-cell">Type de Machine :</td>
            <td class="value-cell">${machine.type || 'Simple Injection'}</td>
            <td class="label-cell">Année de Fabrication :</td>
            <td class="value-cell">${machine.manufacturingYear || machine.year || 2022}</td>
          </tr>
          <tr>
            <td class="label-cell">Emplacement / Ligne :</td>
            <td class="value-cell">${machine.location || machine.line || 'Atelier'} ${machine.siteNumber ? `(#${machine.siteNumber})` : ''}</td>
            <td class="label-cell">Produit Injecté :</td>
            <td class="value-cell">${machine.injectingProduct || 'Standard Automotive & Technical'}</td>
          </tr>
          <tr>
            <td class="label-cell">Force de Fermeture :</td>
            <td class="value-cell font-bold">${machine.clampingForce || machine.clampingForceTons || 0} Tonnes</td>
            <td class="label-cell">Statut Actuel :</td>
            <td class="value-cell">
              <span class="status-badge status-${machine.status || 'operational'}">
                ${machine.status || 'operational'}
              </span>
            </td>
          </tr>
          <tr>
            <td class="label-cell">Heures Fonctionnement :</td>
            <td class="value-cell font-mono">${(machine.currentHours || machine.totalOperatingHours || 0).toLocaleString()} h</td>
            <td class="label-cell">Date d'Installation en Tunisie :</td>
            <td class="value-cell">${machine.installationDate || '2022-01-15'}</td>
          </tr>
          <tr>
            <td class="label-cell">Condition Générale :</td>
            <td class="value-cell">${machine.condition || 'Excellent'}</td>
            <td class="label-cell">Prochaine Maintenance :</td>
            <td class="value-cell">${machine.nextMaintenance || (machine.nextMaintenanceHours ? `${machine.nextMaintenanceHours} h` : 'Programmé')}</td>
          </tr>
        </table>

        <!-- SPÉCIFICATIONS TECHNIQUES -->
        <div class="section-title">2. Spécifications Techniques & Capacités Outillage</div>
        <table class="info-grid">
          <tr>
            <td class="label-cell">Type de fermeture :</td>
            <td class="value-cell">${machine.closingType || 'Genouillère hydraulique haute précision'}</td>
            <td class="label-cell">Diamètre de centrage :</td>
            <td class="value-cell">${machine.centeringDiameter ? `${machine.centeringDiameter} mm` : '125 mm'}</td>
          </tr>
          <tr>
            <td class="label-cell">Épaisseur Moule (Mini / Maxi) :</td>
            <td class="value-cell">${machine.moldThicknessMin || 150} / ${machine.moldThicknessMax || 450} mm</td>
            <td class="label-cell">Passage entre colonnes (H × V) :</td>
            <td class="value-cell">${machine.tieBarSpacingHorizontal || 410} × ${machine.tieBarSpacingVertical || 410} mm</td>
          </tr>
          <tr>
            <td class="label-cell">Course ouverture maxi :</td>
            <td class="value-cell">${machine.maxOpeningStroke ? `${machine.maxOpeningStroke} mm` : '350 mm'}</td>
            <td class="label-cell">Course éjection maxi :</td>
            <td class="value-cell">${machine.maxEjectionStroke ? `${machine.maxEjectionStroke} mm` : '120 mm'}</td>
          </tr>
          <tr>
            <td class="label-cell">Diamètre de vis :</td>
            <td class="value-cell">${machine.screwDiameter ? `${machine.screwDiameter} mm` : '35 mm'}</td>
            <td class="label-cell">Volume injectable maxi :</td>
            <td class="value-cell">${machine.maxInjectableVolume ? `${machine.maxInjectableVolume} cm³` : '180 cm³'}</td>
          </tr>
          <tr>
            <td class="label-cell">Nombre de noyaux :</td>
            <td class="value-cell">${machine.coreCount || 2}</td>
            <td class="label-cell">Canaux de refroidissement :</td>
            <td class="value-cell">${machine.coolingChannelCount || 8} voies</td>
          </tr>
          <tr>
            <td class="label-cell">Régulation thermique :</td>
            <td class="value-cell">${machine.thermalRegulation || 'Eau tempérée / Ravitaillement centralisé'}</td>
            <td class="label-cell">Accessoires connectés :</td>
            <td class="value-cell">${machine.accessories || 'Robot 3 axes, Tapis d\'évacuation, Trémie chauffante'}</td>
          </tr>
          <tr>
            <td class="label-cell">Huile hydraulique préconisée :</td>
            <td class="value-cell">${machine.hydraulicOilType || 'ISO VG 46 (Total Azolla ZS)'}</td>
            <td class="label-cell">Capacité du réservoir :</td>
            <td class="value-cell">${machine.reservoirCapacity ? `${machine.reservoirCapacity} L` : '250 Litres'}</td>
          </tr>
        </table>

        <!-- PLAN DE MAINTENANCE PRÉVENTIVE -->
        <div class="section-title">3. Gamme & Plan de Maintenance Préventive</div>
        <table class="plan-table">
          <thead>
            <tr>
              <th style="width: 20%;">Type</th>
              <th style="width: 25%;">Périodicité</th>
              <th style="width: 55%;">Opération de Contrôle / Entretien</th>
            </tr>
          </thead>
          <tbody>
            ${
              machine.preventivePlan && machine.preventivePlan.length > 0
                ? machine.preventivePlan
                    .map(
                      (task) => `
                <tr>
                  <td><b>${task.type}</b></td>
                  <td>${task.frequency === 'hours' ? `Toutes les ${task.frequencyHours} h` : task.frequency}</td>
                  <td>${task.description}</td>
                </tr>
              `
                    )
                    .join('')
                : `
                <tr><td>Contrôle hydraulique</td><td>Toutes les 250 h</td><td>Vérification niveau d'huile, étanchéité flexibles et pression de gavage</td></tr>
                <tr><td>Graissage & Colonnes</td><td>Toutes les 250 h</td><td>Nettoyage plateaux, graissage colonnes et genouillères (EP2)</td></tr>
                <tr><td>Groupe d'injection</td><td>Toutes les 1000 h</td><td>Contrôle résistances colliers chauffants, sondes thermocouples et usure vis</td></tr>
                <tr><td>Sécurités & LOTO</td><td>Toutes les 250 h</td><td>Test des arrêts d'urgence, micro-contacts protecteurs portes et clapets sécurité</td></tr>
              `
            }
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-title">Responsable Maintenance Usine</div>
            <div style="font-weight: 700; color: #1e3a8a;">Moncef Trabelsi</div>
            <div>Visa & Date : ${dateStr}</div>
          </div>
          <div class="sig-box">
            <div class="sig-title">Direction Technique & Ingénierie</div>
            <div style="font-weight: 700; color: #1e3a8a;">${signer?.name || 'Dr. Khaled Riahi'}</div>
            <div>Visa de Conformité Fiche Machine</div>
          </div>
        </div>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};
