import React, { useState, useEffect } from 'react';
import {
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Gauge,
  QrCode,
  Printer,
  X,
  Sparkles,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { AppUser, MaterialItem } from '../types/gmao';
import MaterialInput from '../components/stock-material/MaterialInput';
import MaterialOutput from '../components/stock-material/MaterialOutput';
import MaterialStatus from '../components/stock-material/MaterialStatus';
import { api } from '../services/api';

export type MaterialSubView = 'status' | 'input' | 'output';

interface StockMaterialViewProps {
  activeSubView?: MaterialSubView;
  onNavigateSubView?: (sub: MaterialSubView) => void;
  currentUser?: AppUser;
}

export const StockMaterialView: React.FC<StockMaterialViewProps> = ({
  activeSubView = 'status',
  onNavigateSubView,
  currentUser,
}) => {
  const [currentTab, setCurrentTab] = useState<MaterialSubView>(activeSubView);
  const [selectedItemForLabel, setSelectedItemForLabel] = useState<MaterialItem | null>(null);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);

  useEffect(() => {
    if (activeSubView) {
      setCurrentTab(activeSubView);
    }
  }, [activeSubView]);

  useEffect(() => {
    api.getMaterials().then(setMaterials).catch(console.error);
  }, [currentTab]);

  const handleTabChange = (tab: MaterialSubView) => {
    setCurrentTab(tab);
    if (onNavigateSubView) {
      onNavigateSubView(tab);
    }
  };

  const handlePrintLabel = () => {
    if (!selectedItemForLabel) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Étiquette Silo - ${selectedItemForLabel.item}</title>
          <style>
            body { font-family: monospace, sans-serif; margin: 24px; color: #111; }
            .label-card { border: 3px solid #000; padding: 24px; width: 420px; border-radius: 12px; }
            .badge { background: #000; color: #fff; font-weight: bold; font-size: 11px; padding: 4px 10px; display: inline-block; border-radius: 4px; margin-bottom: 8px; }
            .ref { font-size: 26px; font-weight: 900; margin: 4px 0; }
            .desc { font-size: 13px; font-weight: bold; margin: 8px 0; color: #333; }
            .silo { background: #eee; border: 2px solid #333; padding: 10px; font-size: 16px; font-weight: 900; text-align: center; margin: 14px 0; border-radius: 6px; }
            .meta { font-size: 12px; margin: 4px 0; }
            .qr-zone { text-align: center; margin-top: 14px; padding-top: 10px; border-top: 1px dashed #666; font-size: 10px; }
          </style>
        </head>
        <body>
          <div class="label-card">
            <span class="badge">CMMS TPM • RAW MATERIAL SILO</span>
            <div class="ref">${selectedItemForLabel.item}</div>
            <div class="desc">${selectedItemForLabel.description || 'Standard Injection Polymer'}</div>
            ${selectedItemForLabel.subFamily ? `<div class="meta"><strong>Sub-Family:</strong> ${selectedItemForLabel.subFamily}</div>` : ''}
            <div class="silo">📍 ${selectedItemForLabel.location || 'Main Silo / Rack'}</div>
            <div class="meta"><strong>Current Stock:</strong> ${selectedItemForLabel.currentStock} ${selectedItemForLabel.unit || 'kg'}</div>
            <div class="meta"><strong>Print Date:</strong> ${new Date().toISOString().split('T')[0]}</div>
            <div class="qr-zone">
              <p>Thermoplastics Tunisia • Industry 4.0 Traceability</p>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1700px] mx-auto select-none">

      {/* Render Active Sub-View */}
      <div className="pt-1">
        {currentTab === 'status' && <MaterialStatus />}
        {currentTab === 'input' && <MaterialInput />}
        {currentTab === 'output' && <MaterialOutput />}
      </div>

      {/* Modal: QR Code Silo Label Preview & Print */}
      {selectedItemForLabel && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-neutral-300 shadow-2xl max-w-md w-full space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <QrCode size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Étiquette Silo & Trémie</h3>
                  <p className="text-[11px] text-gray-500">Impression code-barres et QR pour identification rapide</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedItemForLabel(null)}
                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Select Material */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Choisir l'article :</label>
              <select
                value={selectedItemForLabel.item}
                onChange={(e) => {
                  const m = materials.find((it) => it.item === e.target.value);
                  if (m) setSelectedItemForLabel(m);
                }}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold font-mono"
              >
                {materials.map((m) => (
                  <option key={m.item} value={m.item}>
                    {m.item} — {m.description || m.subFamily || 'Matière'}
                  </option>
                ))}
              </select>
            </div>

            {/* Visual Label Card */}
            <div className="border-2 border-neutral-800 p-5 rounded-2xl bg-neutral-50/50 space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-300 pb-2">
                <span className="font-bold text-[10px] tracking-wider uppercase text-neutral-600">
                  Thermoplastics Tunisia • Silo
                </span>
                <span className="text-[10px] font-mono font-bold bg-neutral-900 text-white px-2 py-0.5 rounded">
                  {selectedItemForLabel.subFamily || 'POLYMER'}
                </span>
              </div>

              <div>
                <div className="font-mono text-xl font-black text-neutral-900 tracking-tight">
                  {selectedItemForLabel.item}
                </div>
                <div className="text-xs font-bold text-neutral-700 line-clamp-1 mt-0.5">
                  {selectedItemForLabel.description || 'Polymère Injection Standard'}
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-neutral-300 text-center">
                <div className="text-[10px] text-neutral-500 font-semibold uppercase">Emplacement Silo</div>
                <div className="text-sm font-black text-blue-900 mt-0.5">
                  📍 {selectedItemForLabel.location || 'Silo A-01'}
                </div>
              </div>

              <div className="flex items-center justify-center pt-2">
                <div className="p-2 bg-white rounded-xl border border-neutral-300 shadow-2xs">
                  <QRCodeCanvas
                    value={`GMAO-MAT:${selectedItemForLabel.item}|LOC:${selectedItemForLabel.location || 'SILO-A'}|STOCK:${selectedItemForLabel.currentStock}`}
                    size={110}
                    level="H"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setSelectedItemForLabel(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={handlePrintLabel}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Printer size={15} />
                <span>Imprimer l'étiquette</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockMaterialView;
