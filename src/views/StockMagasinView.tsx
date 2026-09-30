import React, { useState, useMemo, useRef } from 'react';
import { StockItem, StockMovement, StockCategory, AppUser } from '../types/gmao';
import {
  Search,
  Plus,
  Minus,
  AlertTriangle,
  Boxes,
  PackagePlus,
  ArrowDownUp,
  Download,
  Upload,
  QrCode,
  Printer,
  History,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Sparkles,
  RefreshCw,
  Building2,
  Trash2,
  Eye,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  PackageCheck,
  Tag,
  ClipboardPaste,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import * as XLSX from 'xlsx';

interface StockMagasinViewProps {
  stock: StockItem[];
  movements?: StockMovement[];
  onAdjustStock: (id: string, delta: number, reason?: string, refDoc?: string) => void;
  onAddNewPart: (part: StockItem) => void;
  onRecordMovement?: (movement: StockMovement) => void;
  onBulkImport?: (items: StockItem[]) => void;
  onDeletePart?: (id: string) => void;
  onDeleteMovement?: (id: string) => void;
  currentUser?: AppUser;
}

type TabType = 'all' | 'mechanical' | 'electrical' | 'hydraulic_pneumatic' | 'mold_parts' | 'consumables' | 'movements';

export const StockMagasinView: React.FC<StockMagasinViewProps> = ({
  stock,
  movements = [],
  onAdjustStock,
  onAddNewPart,
  onRecordMovement,
  onBulkImport,
  onDeletePart,
  onDeleteMovement,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // Modals
  const [isNewPartModalOpen, setIsNewPartModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<StockItem | null>(null);
  const [selectedItemForLabel, setSelectedItemForLabel] = useState<StockItem | null>(null);
  const [selectedItemForMovement, setSelectedItemForMovement] = useState<StockItem | null>(null);

  // Delete movement confirmation
  const [movementToDelete, setMovementToDelete] = useState<StockMovement | null>(null);

  // Toast / Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Form State for New Item (PDR / Spare Parts only)
  const [partNumber, setPartNumber] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('Mechanical');
  const [currentQty, setCurrentQty] = useState<number>(10);
  const [minQty, setMinQty] = useState<number>(2);
  const [unit, setUnit] = useState('pcs');
  const [unitPrice, setUnitPrice] = useState<number>(25.0);
  const [shelfLocation, setShelfLocation] = useState('Rayon M - Tiroir 01');

  const defaultStandardCategories = [
    'Mechanical',
    'Hydraulic',
    'Electrical',
    'Pneumatic',
    'Mold Part',
    'Consumable',
    'Tooling',
    'Hardware',
  ];

  const allCategories = useMemo(() => {
    const set = new Set<string>(defaultStandardCategories);
    stock.forEach((s) => {
      if (s.category && typeof s.category === 'string') {
        const trimmed = s.category.trim();
        if (trimmed) set.add(trimmed);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [stock]);
  const [supplier, setSupplier] = useState('');
  const [supplierRef, setSupplierRef] = useState('');
  const [compatibleMachinesStr, setCompatibleMachinesStr] = useState('ALL');
  const [technicalNotes, setTechnicalNotes] = useState('');

  // Form State for Quick Stock Movement
  const [mvtType, setMvtType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN');
  const [mvtQty, setMvtQty] = useState<number>(10);
  const [mvtReason, setMvtReason] = useState<StockMovement['reason']>('Reception BL');
  const [mvtRefDoc, setMvtRefDoc] = useState('');
  const [mvtNotes, setMvtNotes] = useState('');

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFileName, setImportFileName] = useState('');
  const [pastedData, setPastedData] = useState('');
  const [importPreview, setImportPreview] = useState<Partial<StockItem>[]>([]);

  // Apply Quick Templates in New Item Form (Dedicated PDR Spare Parts)

  // KPI Calculations (Strictly PDR / Spare Parts)
  const totalSKUs = stock.length;
  const totalPdrUnits = stock.reduce((acc, s) => acc + s.currentQty, 0);
  const totalInventoryValue = stock.reduce((acc, s) => acc + s.currentQty * s.unitPrice, 0);
  const lowStockItems = stock.filter((s) => s.currentQty <= s.minQty);
  const lowStockCount = lowStockItems.length;

  // Filtered Stock list
  const filteredStock = useMemo(() => {
    return stock.filter((item) => {
      // Tab filter
      if (activeTab === 'mechanical' && item.category !== 'Mechanical') return false;
      if (activeTab === 'electrical' && item.category !== 'Electrical') return false;
      if (activeTab === 'hydraulic_pneumatic' && item.category !== 'Hydraulic' && item.category !== 'Pneumatic') return false;
      if (activeTab === 'mold_parts' && item.category !== 'Mold Part') return false;
      if (activeTab === 'consumables' && item.category !== 'Consumable' && item.category !== 'Tooling' && item.category !== 'Hardware') return false;

      // Category filter dropdown
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;

      // Low stock filter
      if (showLowStockOnly && item.currentQty > item.minQty) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.partNumber.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.shelfLocation.toLowerCase().includes(q) ||
          (item.supplier && item.supplier.toLowerCase().includes(q)) ||
          item.category.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [stock, activeTab, selectedCategory, showLowStockOnly, searchQuery]);

  // Handle Create Part Form Submission
  const handleCreatePart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partNumber.trim() || !name.trim()) {
      showToast('Reference and Designation are required.');
      return;
    }

    const newItem: StockItem = {
      id: `sp-${Date.now()}`,
      partNumber: partNumber.trim(),
      name: name.trim(),
      category,
      currentQty: Number(currentQty) || 0,
      minQty: Number(minQty) || 1,
      unit: unit.trim() || 'pcs',
      unitPrice: Number(unitPrice) || 0,
      shelfLocation: shelfLocation.trim() || 'Rayon M - Tiroir 01',
      supplier: supplier.trim() || undefined,
      supplierRef: supplierRef.trim() || undefined,
      compatibleMachines: compatibleMachinesStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      lastRestocked: new Date().toISOString().split('T')[0],
      barcode: `${partNumber.trim()}-${Date.now().toString().slice(-4)}`,
      technicalNotes: technicalNotes.trim() || undefined,
    };

    onAddNewPart(newItem);

    // Also record movement if initial qty > 0
    if (newItem.currentQty > 0 && onRecordMovement) {
      onRecordMovement({
        id: `mvt-${Date.now()}`,
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        itemId: newItem.id,
        partNumber: newItem.partNumber,
        itemName: newItem.name,
        type: 'IN',
        qty: newItem.currentQty,
        previousQty: 0,
        newQty: newItem.currentQty,
        reason: 'Inventory Count',
        operator: currentUser?.name || 'Magasinier GMAO',
        notes: 'Initial catalogue registration.',
      });
    }

    setIsNewPartModalOpen(false);
    resetNewPartForm();
    showToast(`Stock item "${newItem.partNumber}" registered successfully.`);
  };

  const resetNewPartForm = () => {
    setPartNumber('');
    setName('');
    setCategory('Mechanical');
    setCurrentQty(10);
    setMinQty(2);
    setUnit('pcs');
    setUnitPrice(25.0);
    setShelfLocation('Rayon M - Tiroir 01');
    setSupplier('');
    setSupplierRef('');
    setCompatibleMachinesStr('ALL');
    setTechnicalNotes('');
  };

  // Open Quick Movement Modal
  const handleOpenMovementModal = (item?: StockItem) => {
    if (item) {
      setSelectedItemForMovement(item);
    } else if (stock.length > 0) {
      setSelectedItemForMovement(stock[0]);
    }
    setMvtType('IN');
    setMvtQty(25);
    setMvtReason('Reception BL');
    setMvtRefDoc('');
    setMvtNotes('');
    setIsMovementModalOpen(true);
  };

  // Submit Stock Movement
  const handleSubmitMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForMovement) return;

    const qtyVal = Number(mvtQty) || 0;
    if (qtyVal <= 0) {
      showToast('Quantity must be greater than zero.');
      return;
    }

    const previousQty = selectedItemForMovement.currentQty;
    let newQty = previousQty;
    let delta = 0;

    if (mvtType === 'IN') {
      delta = qtyVal;
      newQty = previousQty + delta;
    } else if (mvtType === 'OUT') {
      delta = -qtyVal;
      newQty = Math.max(0, previousQty - qtyVal);
    } else {
      // ADJUSTMENT: newQty set directly to qtyVal
      delta = qtyVal - previousQty;
      newQty = qtyVal;
    }

    onAdjustStock(selectedItemForMovement.id, delta, mvtReason, mvtRefDoc);

    if (onRecordMovement) {
      onRecordMovement({
        id: `mvt-${Date.now()}`,
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        itemId: selectedItemForMovement.id,
        partNumber: selectedItemForMovement.partNumber,
        itemName: selectedItemForMovement.name,
        type: mvtType,
        qty: qtyVal,
        previousQty,
        newQty,
        reason: mvtReason,
        referenceDoc: mvtRefDoc || undefined,
        operator: currentUser?.name || 'Aymen Chebbi',
        notes: mvtNotes || undefined,
      });
    }

    setIsMovementModalOpen(false);
    showToast(`Stock updated: ${selectedItemForMovement.partNumber} is now ${newQty} ${selectedItemForMovement.unit}`);
  };

  // Excel Export
  const handleExportExcel = () => {
    const exportRows = stock.map((s) => ({
      'Reference (Part Number)': s.partNumber,
      'Designation / Nom': s.name,
      Categorie: s.category,
      'Quantite en Stock': s.currentQty,
      'Seuil Mini Securite': s.minQty,
      Unite: s.unit,
      'Prix Unitaire (TND)': s.unitPrice,
      'Valeur Totale (TND)': Number((s.currentQty * s.unitPrice).toFixed(2)),
      'Emplacement Magasin': s.shelfLocation,
      Fournisseur: s.supplier || '',
      'Ref Fournisseur': s.supplierRef || '',
      'Machines Compatibles': s.compatibleMachines.join(', '),
      'Dernier Reassort': s.lastRestocked || '',
      'Notes Techniques': s.technicalNotes || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock_PDR');
    XLSX.writeFile(workbook, `Stock_Magasin_PDR_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Stock PDR exporté vers Excel (.xlsx)');
  };

  // Download Excel Import Template
  const handleDownloadTemplate = () => {
    const templateRows = [
      {
        'Reference (Part Number)': 'BEAR-6205-2RS-SKF',
        'Designation / Nom': 'Roulement Rigide à Billes 6205-2RS SKF (25x52x15 mm)',
        Categorie: 'Mechanical',
        'Quantite en Stock': 12,
        'Seuil Mini Securite': 4,
        Unite: 'pcs',
        'Prix Unitaire (TND)': 24.5,
        'Emplacement Magasin': 'Rayon M - Tiroir 08',
        Fournisseur: 'SKF / Somat',
        'Ref Fournisseur': 'SKF-6205-2RS',
        'Machines Compatibles': 'ENGEL, BATTENFELD',
        'Notes Techniques': 'Jeu C3, étanchéité 2RS',
      },
      {
        'Reference (Part Number)': 'HEAT-BAND-100-60',
        'Designation / Nom': 'Collier Chauffant Mica 100mm x 60mm 3000W 230V',
        Categorie: 'Electrical',
        'Quantite en Stock': 6,
        'Seuil Mini Securite': 3,
        Unite: 'pcs',
        'Prix Unitaire (TND)': 92.0,
        'Emplacement Magasin': 'Rayon E - Étagère 02',
        Fournisseur: 'Watlow / Hotset',
        'Ref Fournisseur': 'WAT-10060',
        'Machines Compatibles': 'ENGEL 150T, BATTENFELD 200T',
        'Notes Techniques': 'Collier mica avec serrage inox',
      },
      {
        'Reference (Part Number)': 'EP-DIN1530-4-250',
        'Designation / Nom': 'Éjecteur Cylindrique DIN 1530 Forme A D=4mm L=250mm',
        Categorie: 'Mold Part',
        'Quantite en Stock': 30,
        'Seuil Mini Securite': 10,
        Unite: 'pcs',
        'Prix Unitaire (TND)': 19.0,
        'Emplacement Magasin': 'Rayon Moules - Tiroir 12',
        Fournisseur: 'Hasco Normalien',
        'Ref Fournisseur': 'Z40/4x250',
        'Machines Compatibles': 'MOULES ALL',
        'Notes Techniques': 'Acier nitruré 950-1000 HV',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Modele_Import');
    XLSX.writeFile(workbook, 'Modele_Import_Stock_Materiel.xlsx');
    showToast('Template downloaded: Modele_Import_Stock_Materiel.xlsx');
  };

  // Parse Excel / CSV File
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const reader = new FileReader();

    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (!rows || rows.length === 0) {
          showToast('The selected file is empty.');
          setImportPreview([]);
          return;
        }

        parseImportRows(rows);
      } catch (err) {
        showToast('Error parsing file: Please check the file format.');
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Parse Pasted Text (CSV or TSV)
  const handleParsePastedData = () => {
    if (!pastedData.trim()) {
      showToast('Please paste text data first.');
      return;
    }

    try {
      const lines = pastedData.trim().split('\n');
      if (lines.length === 0) return;

      const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ''));

      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = line.split(delimiter).map((v) => v.trim().replace(/^["']|["']$/g, ''));
        const rowObj: any = {};
        headers.forEach((h, idx) => {
          rowObj[h] = values[idx] || '';
        });
        rows.push(rowObj);
      }

      parseImportRows(rows);
    } catch (err) {
      showToast('Unable to parse pasted text. Ensure it is comma, tab, or semicolon separated.');
    }
  };

  // Convert raw rows to StockItem preview
  const parseImportRows = (rows: any[]) => {
    const parsed: Partial<StockItem>[] = rows.map((r, idx) => {
      const pNum = String(
        r['Reference (Part Number)'] ||
        r['Reference'] ||
        r['Référence'] ||
        r['Part Number'] ||
        r['Code'] ||
        r['partNumber'] ||
        `ITEM-${Date.now()}-${idx}`
      ).trim();

      const pName = String(
        r['Designation / Nom'] ||
        r['Designation'] ||
        r['Désignation'] ||
        r['Nom'] ||
        r['Description'] ||
        r['name'] ||
        'Unnamed Material'
      ).trim();

      const rawCat = String(
        r['Categorie'] ||
        r['Catégorie'] ||
        r['Category'] ||
        r['category'] ||
        r['catégorie'] ||
        ''
      ).trim();

      let matchedCat: string = rawCat || 'Mechanical';
      const lower = rawCat.toLowerCase();
      if (lower === 'hydraul' || lower === 'hydraulique') {
        matchedCat = 'Hydraulic';
      } else if (lower === 'electr' || lower === 'electrique' || lower === 'électrique') {
        matchedCat = 'Electrical';
      } else if (lower === 'pneu' || lower === 'pneumatique') {
        matchedCat = 'Pneumatic';
      } else if (lower === 'mould' || lower === 'moule' || lower === 'mold' || lower === 'mold part') {
        matchedCat = 'Mold Part';
      } else if (lower === 'meca' || lower === 'mecanique' || lower === 'mécanique') {
        matchedCat = 'Mechanical';
      } else if (lower === 'consum' || lower === 'consommable') {
        matchedCat = 'Consumable';
      } else if (lower === 'tool' || lower === 'outil' || lower === 'outillage') {
        matchedCat = 'Tooling';
      } else if (lower === 'vis' || lower === 'visserie' || lower === 'hardware' || lower === 'quincaillerie') {
        matchedCat = 'Hardware';
      } else if (rawCat) {
        matchedCat = rawCat;
      }

      const currentQtyVal = parseFloat(r['Quantite en Stock'] || r['Stock'] || r['Quantity'] || r['currentQty'] || '0') || 0;
      const minQtyVal = parseFloat(r['Seuil Mini Securite'] || r['Min'] || r['minQty'] || '2') || 2;
      const unitVal = String(r['Unite'] || r['Unit'] || r['unit'] || 'pcs').trim();
      const unitPriceVal = parseFloat(r['Prix Unitaire (TND)'] || r['Prix'] || r['Price'] || r['unitPrice'] || '0') || 0;
      const locationVal = String(r['Emplacement Magasin'] || r['Emplacement Silo / Etagere'] || r['Emplacement'] || r['Location'] || r['shelfLocation'] || 'Magasin PDR').trim();
      const supplierVal = String(r['Fournisseur'] || r['Supplier'] || r['supplier'] || '').trim();

      return {
        id: `sp-imp-${Date.now()}-${idx}`,
        partNumber: pNum,
        name: pName,
        category: matchedCat,
        currentQty: currentQtyVal,
        minQty: minQtyVal,
        unit: unitVal,
        unitPrice: unitPriceVal,
        shelfLocation: locationVal,
        supplier: supplierVal || undefined,
        compatibleMachines: ['ALL'],
        barcode: `${pNum}-${idx}`,
        lastRestocked: new Date().toISOString().split('T')[0],
      };
    });

    setImportPreview(parsed);
    showToast(`${parsed.length} items parsed and ready for review.`);
  };

  // Commit Import
  const handleConfirmImport = () => {
    if (importPreview.length === 0) return;

    const validItems: StockItem[] = importPreview.map((item) => {
      const cleanRef = (item.partNumber || 'REF-GEN').trim();
      const existing = stock.find(
        (s) => s.partNumber?.trim().toLowerCase() === cleanRef.toLowerCase()
      );

      return {
        id: existing?.id || item.id || `sp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        partNumber: cleanRef,
        name: (item.name || 'Unnamed Part').trim(),
        category: (item.category || 'Mechanical').trim(),
        currentQty: Number(item.currentQty) || 0,
        minQty: Number(item.minQty) || 1,
        unit: (item.unit || 'pcs').trim(),
        unitPrice: Number(item.unitPrice) || 0,
        shelfLocation: (item.shelfLocation || 'Magasin PDR').trim(),
        supplier: item.supplier?.trim() || undefined,
        compatibleMachines: item.compatibleMachines || ['ALL'],
        barcode: item.barcode || `${cleanRef}-BC`,
        lastRestocked: item.lastRestocked || new Date().toISOString().split('T')[0],
      };
    });

    if (onBulkImport) {
      onBulkImport(validItems);
    } else {
      validItems.forEach((it) => onAddNewPart(it));
    }

    setIsImportModalOpen(false);
    setImportPreview([]);
    setImportFileName('');
    setPastedData('');
    showToast(`Successfully imported ${validItems.length} materials into stock.`);
  };

  // Print Label Handler
  const handlePrintLabel = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !selectedItemForLabel) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Label - ${selectedItemForLabel.partNumber}</title>
          <style>
            body { font-family: monospace, sans-serif; margin: 20px; color: #111; }
            .label-card { border: 2px solid #000; padding: 16px; width: 380px; }
            .title { font-size: 16px; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 8px; }
            .ref { font-size: 20px; font-weight: 900; color: #000; }
            .meta { font-size: 11px; margin: 3px 0; }
            .qr-wrap { text-align: center; margin: 12px 0; }
            .location-box { background: #eee; border: 1px solid #999; padding: 6px; font-weight: bold; font-size: 13px; text-align: center; margin-top: 8px; }
          </style>
        </head>
        <body>
          <div class="label-card">
            <div class="title">GMAO TPM - MATERIEL & STOCK</div>
            <div class="ref">${selectedItemForLabel.partNumber}</div>
            <div style="font-weight: bold; font-size: 13px; margin: 4px 0;">${selectedItemForLabel.name}</div>
            <div class="meta"><strong>Catégorie:</strong> ${selectedItemForLabel.category}</div>
            ${selectedItemForLabel.grade ? `<div class="meta"><strong>Grade / Spéc:</strong> ${selectedItemForLabel.grade}</div>` : ''}
            ${selectedItemForLabel.lotNumber ? `<div class="meta"><strong>Lot / Batch #:</strong> ${selectedItemForLabel.lotNumber}</div>` : ''}
            <div class="meta"><strong>Seuil Mini Sécurité:</strong> ${selectedItemForLabel.minQty} ${selectedItemForLabel.unit}</div>
            <div class="location-box">📍 EMPLACEMENT: ${selectedItemForLabel.shelfLocation}</div>
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
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-neutral-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-neutral-700 text-sm font-semibold flex items-center gap-3 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Fast Action Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold border border-neutral-300 transition-all shadow-xs"
            title="Importer des pièces depuis un fichier Excel ou texte collé"
          >
            <Upload className="w-4 h-4 text-neutral-600" />
            <span>Importer Pièces PDR (Excel/CSV)</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold border border-neutral-300 transition-all shadow-xs"
            title="Exporter l'inventaire en fichier Excel .xlsx"
          >
            <Download className="w-4 h-4 text-emerald-700" />
            <span>Exporter Excel</span>
          </button>

          <button
            onClick={() => handleOpenMovementModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            title="Enregistrer une entrée, sortie ou ajustement de stock"
          >
            <ArrowDownUp className="w-4 h-4 text-amber-400" />
            <span>Mouvement Entrée / Sortie</span>
          </button>

          <button
            onClick={() => {
              resetNewPartForm();
              setIsNewPartModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <PackagePlus className="w-4 h-4" />
            <span>+ Ajouter Pièce PDR</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Catalog Items */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-300 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Total Références PDR</span>
            <Tag className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-neutral-900 mt-1.5 tabular-nums">
            {totalSKUs} <span className="text-sm font-semibold text-neutral-500">articles</span>
          </div>
        </div>

        {/* Total Parts Quantity */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-300 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Unités en Magasin</span>
            <Boxes className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-700 mt-1.5 tabular-nums">
            {totalPdrUnits.toLocaleString()} <span className="text-sm font-semibold text-blue-600">unités</span>
          </div>
        </div>

        {/* Total Valuation */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-300 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Valeur Magasin PDR</span>
            <Building2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-800 mt-1.5 tabular-nums">
            {totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            <span className="text-sm font-semibold text-emerald-700">TND</span>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div
          onClick={() => setShowLowStockOnly(!showLowStockOnly)}
          className={`rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer shadow-xs ${showLowStockOnly
            ? 'bg-red-50 border-red-400 ring-2 ring-red-400'
            : 'bg-white border-neutral-300 hover:border-red-300'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Alertes Seuil Mini</span>
            <AlertTriangle className={`w-4 h-4 ${lowStockCount > 0 ? 'text-red-600' : 'text-neutral-400'}`} />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-red-600 mt-1.5 tabular-nums flex items-center gap-2">
            <span>{lowStockCount}</span>
            <span className="text-sm font-semibold text-red-600">critiques</span>
          </div>
        </div>
      </div>

      {/* Primary Category Tabs (Strictly PDR / Spare Parts) */}
      <div className="bg-[#ebeeed] p-1.5 rounded-2xl border border-neutral-300 flex flex-wrap items-center gap-1">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'all'
            ? 'bg-neutral-900 text-white shadow-xs'
            : 'text-neutral-700 hover:bg-black/5'
            }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>Vue Globale PDR ({stock.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ml-auto ${activeTab === 'movements'
            ? 'bg-blue-700 text-white shadow-xs'
            : 'text-blue-900 bg-blue-50/70 hover:bg-blue-100/70'
            }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Journal des Mouvements ({movements.length})</span>
        </button>
      </div>

      {/* Tab: Movements History vs Stock Items Table */}
      {activeTab === 'movements' ? (
        <div className="bg-[#ebeeed] rounded-3xl border border-neutral-400/80 shadow-xs overflow-hidden flex flex-col justify-between min-h-[550px]">
          <div className="p-4 bg-white/70 border-b border-neutral-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                <span>Journal d&apos;Entrées / Sorties & Consommations Stock</span>
              </h2>
            </div>
            <button
              onClick={() => handleOpenMovementModal()}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouveau Mouvement</span>
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-300 text-xs font-bold text-neutral-900 bg-black/5 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Date & Heure</th>
                  <th className="py-3.5 px-4 text-center">Type</th>
                  <th className="py-3.5 px-5">Référence Matière</th>
                  <th className="py-3.5 px-6">Désignation</th>
                  <th className="py-3.5 px-4 text-center">Quantité</th>
                  <th className="py-3.5 px-4 text-center">Avant → Après</th>
                  <th className="py-3.5 px-5">Motif</th>
                  <th className="py-3.5 px-4">Document / Réf</th>
                  <th className="py-3.5 px-5">Opérateur</th>
                  {currentUser?.role === 'admin' && <th className="py-3.5 px-4 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-300/70 text-xs font-medium text-neutral-800">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={currentUser?.role === 'admin' ? 10 : 9} className="py-16 text-center text-neutral-500 font-semibold">
                      Aucun mouvement de stock enregistré.
                    </td>
                  </tr>
                ) : (
                  movements.map((mvt) => {
                    const isMvtIn = mvt.type === 'IN';
                    const isMvtOut = mvt.type === 'OUT';
                    return (
                      <tr key={mvt.id} className="hover:bg-white/40 transition-colors">
                        <td className="py-3.5 px-5 font-mono text-neutral-600 whitespace-nowrap">
                          {mvt.date}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] ${isMvtIn
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : isMvtOut
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-blue-100 text-blue-800 border border-blue-300'
                              }`}
                          >
                            {isMvtIn ? (
                              <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                            ) : isMvtOut ? (
                              <ArrowUpRight className="w-3 h-3 text-amber-600" />
                            ) : (
                              <RefreshCw className="w-3 h-3 text-blue-600" />
                            )}
                            <span>{mvt.type}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-5 font-mono font-bold text-blue-700 whitespace-nowrap">
                          {mvt.partNumber}
                        </td>
                        <td className="py-3.5 px-6 font-semibold text-neutral-900 max-w-xs truncate">
                          {mvt.itemName}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-black whitespace-nowrap">
                          <span
                            className={
                              isMvtIn
                                ? 'text-emerald-700'
                                : isMvtOut
                                  ? 'text-red-700'
                                  : 'text-neutral-900'
                            }
                          >
                            {isMvtIn ? `+${mvt.qty}` : isMvtOut ? `-${mvt.qty}` : `${mvt.qty}`}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-neutral-600 whitespace-nowrap">
                          {mvt.previousQty} → <strong className="text-neutral-900">{mvt.newQty}</strong>
                        </td>
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <span className="font-semibold text-neutral-800 bg-white/70 px-2 py-0.5 rounded-md border border-neutral-300">
                            {mvt.reason}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-neutral-700 whitespace-nowrap">
                          {mvt.referenceDoc || '—'}
                        </td>
                        <td className="py-3.5 px-5 text-neutral-700 whitespace-nowrap">
                          {mvt.operator}
                        </td>
                        {currentUser?.role === 'admin' && (
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => setMovementToDelete(mvt)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-[11px] font-bold transition-all"
                              title="Supprimer ce mouvement (admin)"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Suppr.</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative max-w-md w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher référence PDR, emplacement, désignation..."
                className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl text-sm font-medium border border-neutral-300 shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-neutral-300 text-xs">
                <Filter className="w-3.5 h-3.5 text-neutral-500" />
                <span className="font-bold text-neutral-600">Catégorie:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-transparent font-bold text-neutral-900 focus:outline-none cursor-pointer"
                >
                  <option value="All">Toutes les catégories PDR ({stock.length})</option>
                  {allCategories.map((cat) => {
                    const count = stock.filter((s) => s.category?.toLowerCase() === cat.toLowerCase()).length;
                    return (
                      <option key={cat} value={cat}>
                        {cat} {count > 0 ? `(${count})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <button
                onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 ${showLowStockOnly
                  ? 'bg-red-600 text-white border-red-700 shadow-xs'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
                  }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Alerte Rupture ({lowStockCount})</span>
              </button>
            </div>
          </div>

          {/* Main Stock Table */}
          <div className="bg-[#ebeeed] rounded-3xl border border-neutral-400/80 shadow-xs overflow-hidden flex flex-col justify-between min-h-[520px]">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-300 text-xs font-bold text-neutral-900 bg-black/5 uppercase tracking-wider">
                    <th className="py-4 px-5">Ref</th>
                    <th className="py-4 px-6">Description</th>
                    <th className="py-4 px-4">Catégorie</th>
                    <th className="py-4 px-4 text-center">Qte</th>
                    <th className="py-4 px-4 text-center">Mini</th>
                    <th className="py-4 px-4 text-right">Prix.U</th>
                    <th className="py-4 px-4 text-right">Val. Stock</th>
                    <th className="py-4 px-5">Emplacement</th>
                    <th className="py-4 px-5 text-right">Ajuster Stock</th>
                    <th className="py-4 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-300/70 text-xs font-medium text-neutral-800">
                  {filteredStock.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center text-neutral-500 font-semibold">
                        Aucun article ou matière ne correspond à vos filtres.
                      </td>
                    </tr>
                  ) : (
                    filteredStock.map((item) => {
                      const isLow = item.currentQty <= item.minQty;
                      const isOutOfStock = item.currentQty <= 0;
                      const rowValuation = item.currentQty * item.unitPrice;

                      return (
                        <tr key={item.id} className="hover:bg-white/40 transition-colors">
                          {/* Part Number & QR preview */}
                          <td className="py-3.5 px-5 whitespace-nowrap">
                            <div className="font-mono font-bold text-blue-700 text-sm flex items-center gap-1.5">
                              <span>{item.partNumber}</span>
                            </div>
                            {item.lotNumber && (
                              <div className="text-[10px] font-mono text-neutral-500">
                                Lot: {item.lotNumber}
                              </div>
                            )}
                          </td>

                          {/* Name & Grade */}
                          <td className="py-3.5 px-6 max-w-sm">
                            <div className="font-bold text-neutral-900 text-xs leading-snug">{item.name}</div>
                            {item.grade && (
                              <div className="text-[11px] font-semibold text-blue-800 mt-0.5">
                                Grade: {item.grade}
                              </div>
                            )}
                            {item.supplier && (
                              <div className="text-[10px] text-neutral-500 mt-0.5">
                                Fournisseur: {item.supplier}
                              </div>
                            )}
                          </td>

                          {/* Category Badge */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`font-bold text-[11px] px-2.5 py-0.5 rounded-full border ${item.category === 'Raw Material / Resin'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : item.category === 'Masterbatch / Colorant'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : item.category === 'Purge & Chemical'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : item.category === 'Mold Part'
                                      ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                      : 'bg-neutral-100 text-neutral-800 border-neutral-300'
                                }`}
                            >
                              {item.category}
                            </span>
                          </td>

                          {/* Current Stock */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span
                              className={`font-mono font-black text-sm px-2.5 py-1 rounded-lg tabular-nums inline-block ${isOutOfStock
                                ? 'bg-red-200 text-red-900 border border-red-400'
                                : isLow
                                  ? 'bg-red-100 text-red-800 border border-red-300'
                                  : 'bg-emerald-100 text-emerald-950 border border-emerald-200'
                                }`}
                            >
                              {item.currentQty.toLocaleString()} {item.unit}
                            </span>
                          </td>

                          {/* Min Qty */}
                          <td className="py-3.5 px-4 text-center font-mono text-xs text-neutral-600 whitespace-nowrap">
                            {item.minQty.toLocaleString()} {item.unit}
                          </td>

                          {/* Unit Price */}
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-neutral-900 whitespace-nowrap">
                            {item.unitPrice.toFixed(2)} TND
                          </td>

                          {/* Total Valuation */}
                          <td className="py-3.5 px-4 text-right font-mono font-black text-neutral-900 whitespace-nowrap">
                            {rowValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TND
                          </td>

                          {/* Location */}
                          <td className="py-3.5 px-5 whitespace-nowrap">
                            <span className="font-mono text-xs font-semibold text-neutral-700 bg-white/70 px-2 py-1 rounded border border-neutral-300">
                              {item.shelfLocation}
                            </span>
                          </td>

                          {/* Stock Quick Adjust */}
                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  const step = item.unit.toLowerCase().includes('kg') ? 25 : 1;
                                  onAdjustStock(item.id, -step, 'Manual Adjustment');
                                }}
                                disabled={item.currentQty <= 0}
                                className="p-1.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 rounded-lg disabled:opacity-30 transition-colors"
                                title={`Diminuer le stock (${item.unit.toLowerCase().includes('kg') ? '-25kg' : '-1'})`}
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  const step = item.unit.toLowerCase().includes('kg') ? 25 : 1;
                                  onAdjustStock(item.id, step, 'Manual Adjustment');
                                }}
                                className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-2xs"
                                title={`Augmenter le stock (${item.unit.toLowerCase().includes('kg') ? '+25kg' : '+1'})`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                          {/* Details & Label actions */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedItemForDetails(item)}
                                className="p-1.5 bg-white hover:bg-neutral-100 text-neutral-700 rounded-lg border border-neutral-300 transition-colors"
                                title="Voir la fiche détaillée"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {onDeletePart && (
                                <button
                                  onClick={() => {
                                    if (confirm(`Supprimer définitivement "${item.partNumber}" du stock ?`)) {
                                      onDeletePart(item.id);
                                    }
                                  }}
                                  className="p-1.5 bg-white hover:bg-red-50 text-red-600 rounded-lg border border-neutral-300 transition-colors"
                                  title="Supprimer la référence"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer info */}
            <div className="p-3 bg-white/70 border-t border-neutral-300 text-xs font-semibold text-neutral-600 flex flex-wrap items-center justify-between gap-3">
              <div>
                Affichage de <strong className="text-neutral-900">{filteredStock.length}</strong> sur{' '}
                <strong className="text-neutral-900">{stock.length}</strong> articles au total
              </div>
              <div className="flex items-center gap-4">
                <span>
                  Sous-total sélection :{' '}
                  <strong className="font-mono text-neutral-900">
                    {filteredStock
                      .reduce((acc, s) => acc + s.currentQty * s.unitPrice, 0)
                      .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                    TND
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* MODAL 1: Add New Material / Spare Part */}
      {isNewPartModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-neutral-900 rounded-3xl p-6 sm:p-8 border border-neutral-300 shadow-2xl max-w-3xl w-full my-8 space-y-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
              <div>
                <h2 className="text-xl font-black text-neutral-900">Ajouter une Pièce de Rechange (PDR)</h2>
                <p className="text-xs text-neutral-500 font-medium">
                  Remplissez la fiche technique ou choisissez un modèle prédéfini PDR
                </p>
              </div>
              <button
                onClick={() => setIsNewPartModalOpen(false)}
                className="p-2 text-neutral-400 hover:text-neutral-900 rounded-xl hover:bg-neutral-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePart} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Référence *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: BEAR-6205-2RS ou EP-30-250"
                    value={partNumber}
                    onChange={(e) => setPartNumber(e.target.value)}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-neutral-700 uppercase">
                      Catégorie *
                    </label>
                    <span className="text-[10px] text-blue-600 font-semibold">
                      Sélectionnez ou écrivez librement
                    </span>
                  </div>
                  <input
                    type="text"
                    list="stock-magasin-available-categories"
                    required
                    placeholder="Choisir ou écrire une catégorie..."
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <datalist id="stock-magasin-available-categories">
                    {allCategories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Roulement Rigide à Billes 6205-2RS SKF (25x52x15 mm)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Quantité Initiale
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={currentQty}
                    onChange={(e) => setCurrentQty(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl px-3 py-2 text-sm font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Seuil Mini Sécurité
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={minQty}
                    onChange={(e) => setMinQty(parseFloat(e.target.value) || 1)}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl px-3 py-2 text-sm font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Unité (pcs, m, L, boîte)
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl px-3 py-2 text-sm font-bold text-center"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Prix Unitaire (TND)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl px-3 py-2 text-sm font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={shelfLocation}
                    onChange={(e) => setShelfLocation(e.target.value)}
                    placeholder=""
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl px-3 py-2 text-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Fournisseur & Référence Fabricant
                  </label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder=""
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl px-3 py-2 text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                  Notes & Spécifications Techniques
                </label>
                <textarea
                  rows={2}
                  value={technicalNotes}
                  onChange={(e) => setTechnicalNotes(e.target.value)}
                  placeholder=""
                  className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setIsNewPartModalOpen(false)}
                  className="px-6 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-7 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Bulk Import (Excel / CSV / Pasted text) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-neutral-900 rounded-3xl p-6 sm:p-8 border border-neutral-300 shadow-2xl max-w-4xl w-full my-8 space-y-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
              <div>
                <h2 className="text-xl font-black text-neutral-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                  <span>Importer Votre Liste de Stock & Matières</span>
                </h2>
                <p className="text-xs text-neutral-500 font-medium">
                  Téléchargez le modèle, déposez un fichier Excel/CSV ou collez directement votre tableau de données
                </p>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-2 text-neutral-400 hover:text-neutral-900 rounded-xl hover:bg-neutral-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Download & File Upload Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                    <Download className="w-4 h-4 text-emerald-700" />
                    <span>Modèle Excel Prêt à l&apos;Emploi</span>
                  </h3>
                  <p className="text-xs text-emerald-800 mt-1">
                    Téléchargez le fichier gabarit avec les colonnes préformatées pour les polymères, colorants et pièces.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="mt-4 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs w-fit"
                >
                  Télécharger Modèle Excel (.xlsx)
                </button>
              </div>

              <div className="p-4 bg-neutral-50 border border-neutral-300 rounded-2xl flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-blue-600" />
                    <span>Fichier Excel / CSV</span>
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    Sélectionnez un fichier .xlsx ou .csv sur votre ordinateur.
                  </p>
                </div>
                <div className="mt-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileChange}
                    className="text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                  />
                  {importFileName && (
                    <div className="text-xs font-mono text-blue-700 mt-1.5 font-bold">
                      Fichier chargé : {importFileName}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Paste Data directly */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-700 uppercase flex items-center gap-1.5">
                  <ClipboardPaste className="w-4 h-4 text-neutral-500" />
                  <span>Ou Collez Vos Données Texte Directement (TSV / CSV) :</span>
                </label>
                <button
                  type="button"
                  onClick={handleParsePastedData}
                  className="text-xs font-bold text-blue-700 hover:underline"
                >
                  Analyser le texte collé
                </button>
              </div>
              <textarea
                rows={4}
                value={pastedData}
                onChange={(e) => setPastedData(e.target.value)}
                placeholder={`Reference,Designation,Categorie,Quantite,Unite,Prix\nBEAR-6205-2RS,Roulement SKF 6205-2RS,Mechanical,12,pcs,24.5\nHEAT-BAND-100,Collier Chauffant Mica,Electrical,6,pcs,92.0`}
                className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-3 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Preview of Parsed Items */}
            {importPreview.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-900 uppercase">
                    Aperçu avant enregistrement ({importPreview.length} articles détectés) :
                  </span>
                  <span className="text-xs text-emerald-700 font-bold">Format valide</span>
                </div>
                <div className="max-h-56 overflow-y-auto border border-neutral-300 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-neutral-100 font-bold text-neutral-800 border-b border-neutral-200">
                        <th className="py-2.5 px-3">Réf</th>
                        <th className="py-2.5 px-4">Désignation</th>
                        <th className="py-2.5 px-3">Catégorie</th>
                        <th className="py-2.5 px-3 text-center">Qté</th>
                        <th className="py-2.5 px-3 text-right">Prix</th>
                        <th className="py-2.5 px-3">Emplacement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 text-neutral-700 font-medium">
                      {importPreview.map((item, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50">
                          <td className="py-2 px-3 font-mono font-bold text-blue-700">{item.partNumber}</td>
                          <td className="py-2 px-4 font-semibold text-neutral-900 truncate max-w-xs">{item.name}</td>
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              list="stock-magasin-available-categories"
                              value={item.category || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setImportPreview((prev) =>
                                  prev.map((it, i) => (i === idx ? { ...it, category: val } : it))
                                );
                              }}
                              className="w-32 bg-white border border-neutral-300 rounded-lg px-2 py-1 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              placeholder="Catégorie..."
                            />
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold">
                            {item.currentQty} {item.unit}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">{item.unitPrice?.toFixed(2)} TND</td>
                          <td className="py-2 px-3 font-mono text-neutral-500">{item.shelfLocation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-6 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs rounded-xl"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importPreview.length === 0}
                className="px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-40"
              >
                Confirm Import ({importPreview.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Stock Movement (Entrée, Sortie, Inventaire) */}
      {isMovementModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-neutral-900 rounded-3xl p-6 sm:p-8 border border-neutral-300 shadow-2xl max-w-lg w-full space-y-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
              <div>
                <h2 className="text-xl font-black text-neutral-900 flex items-center gap-2">
                  <ArrowDownUp className="w-5 h-5 text-amber-500" />
                  <span>Stock Movement</span>
                </h2>
              </div>
              <button
                onClick={() => setIsMovementModalOpen(false)}
                className="p-2 text-neutral-400 hover:text-neutral-900 rounded-xl hover:bg-neutral-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitMovement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                  Article *
                </label>
                <select
                  value={selectedItemForMovement?.id || ''}
                  onChange={(e) => {
                    const found = stock.find((s) => s.id === e.target.value);
                    if (found) setSelectedItemForMovement(found);
                  }}
                  className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {stock.map((s) => (
                    <option key={s.id} value={s.id}>
                      [{s.partNumber}] {s.name} (Actuel: {s.currentQty} {s.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Type de Mouvement *
                  </label>
                  <select
                    value={mvtType}
                    onChange={(e) => setMvtType(e.target.value as any)}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value="IN">Entrée / Réception (+)</option>
                    <option value="OUT">Sortie / Consommation (-)</option>
                    <option value="ADJUSTMENT">Ajustement (=)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Quantité ({selectedItemForMovement?.unit || 'unités'}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min={0.1}
                    value={mvtQty}
                    onChange={(e) => setMvtQty(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl px-3 py-2 text-sm font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Motif du Mouvement
                  </label>
                  <select
                    value={mvtReason}
                    onChange={(e) => setMvtReason(e.target.value as any)}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value="Reception BL">Réception Bon de Livraison (BL)</option>
                    <option value="Production Consumption">Consommation Production Ligne</option>
                    <option value="Maintenance OT">Intervention Maintenance (OT)</option>
                    <option value="Scrap / Purge">Pertes</option>
                    <option value="Manual Adjustment">Ajustement Manuel</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Réf Document (BL / OT / Lot)
                  </label>
                  <input
                    type="text"
                    placeholder="ex: BL-2026-0312 ou OT-002"
                    value={mvtRefDoc}
                    onChange={(e) => setMvtRefDoc(e.target.value)}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                  Remarques
                </label>
                <input
                  type="text"
                  placeholder="ex: Livraison reçue conforme / Aymen Chebbi"
                  value={mvtNotes}
                  onChange={(e) => setMvtNotes(e.target.value)}
                  className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl px-3 py-2 text-xs font-medium"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setIsMovementModalOpen(false)}
                  className="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  Validate Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Item Technical Details */}
      {selectedItemForDetails && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-neutral-900 rounded-3xl p-6 sm:p-8 border border-neutral-300 shadow-2xl max-w-xl w-full space-y-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
              <div>
                <span className="font-mono text-xs font-bold text-blue-700 uppercase tracking-widest">
                  Fiche Technique Magasin
                </span>
                <h2 className="text-xl font-black text-neutral-900 mt-0.5">{selectedItemForDetails.partNumber}</h2>
              </div>
              <button
                onClick={() => setSelectedItemForDetails(null)}
                className="p-2 text-neutral-400 hover:text-neutral-900 rounded-xl hover:bg-neutral-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200">
                <div className="font-bold text-neutral-500 uppercase text-[10px]">Désignation</div>
                <div className="font-bold text-neutral-900 text-sm mt-0.5">{selectedItemForDetails.name}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div className="font-bold text-neutral-500 uppercase text-[10px]">Catégorie</div>
                  <div className="font-bold text-neutral-900 mt-0.5">{selectedItemForDetails.category}</div>
                </div>
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div className="font-bold text-neutral-500 uppercase text-[10px]">Location</div>
                  <div className="font-bold text-neutral-900 mt-0.5">{selectedItemForDetails.shelfLocation}</div>
                </div>
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div className="font-bold text-neutral-500 uppercase text-[10px]">Stock Actuel</div>
                  <div className="font-black text-blue-700 text-base mt-0.5">
                    {selectedItemForDetails.currentQty.toLocaleString()} {selectedItemForDetails.unit}
                  </div>
                </div>
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div className="font-bold text-neutral-500 uppercase text-[10px]">Seuil Minimum Sécurité</div>
                  <div className="font-bold text-neutral-900 text-base mt-0.5">
                    {selectedItemForDetails.minQty.toLocaleString()} {selectedItemForDetails.unit}
                  </div>
                </div>
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div className="font-bold text-neutral-500 uppercase text-[10px]">Prix Unitaire</div>
                  <div className="font-bold text-neutral-900 mt-0.5">{selectedItemForDetails.unitPrice.toFixed(2)} TND</div>
                </div>
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div className="font-bold text-neutral-500 uppercase text-[10px]">Valeur Totale en Stock</div>
                  <div className="font-black text-emerald-700 mt-0.5">
                    {(selectedItemForDetails.currentQty * selectedItemForDetails.unitPrice).toFixed(2)} TND
                  </div>
                </div>
              </div>

              {selectedItemForDetails.grade && (
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                  <div className="font-bold text-blue-900 uppercase text-[10px]">Spécification Technique</div>
                  <div className="font-bold text-blue-950 mt-0.5">{selectedItemForDetails.grade}</div>
                </div>
              )}

              {selectedItemForDetails.technicalNotes && (
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                  <div className="font-bold text-neutral-500 uppercase text-[10px]">Notes & Spécifications PDR</div>
                  <div className="text-neutral-700 mt-0.5">{selectedItemForDetails.technicalNotes}</div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => {
                  setSelectedItemForLabel(selectedItemForDetails);
                  setSelectedItemForDetails(null);
                }}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs rounded-xl flex items-center gap-1.5"
              >
                <QrCode className="w-4 h-4 text-blue-600" />
                <span>Imprimer Étiquette QR</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedItemForDetails(null)}
                className="px-6 py-2 bg-neutral-900 text-white font-bold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Movement Confirmation Modal */}
      {movementToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-md p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-900">Supprimer ce mouvement ?</h2>
                <p className="text-sm text-neutral-500 mt-0.5">Cette action est irréversible et sera enregistrée dans le journal d&apos;audit.</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-500 font-semibold">Date</span>
                <span className="font-mono text-neutral-800">{movementToDelete.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-semibold">Type</span>
                <span className={`font-bold ${movementToDelete.type === 'IN' ? 'text-emerald-700' : movementToDelete.type === 'OUT' ? 'text-amber-700' : 'text-blue-700'}`}>{movementToDelete.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-semibold">Référence</span>
                <span className="font-mono font-bold text-blue-700">{movementToDelete.partNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-semibold">Désignation</span>
                <span className="text-neutral-800 truncate max-w-[200px]">{movementToDelete.itemName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-semibold">Quantité</span>
                <span className="font-mono font-black text-neutral-900">{movementToDelete.qty}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 font-semibold">Opérateur</span>
                <span className="text-neutral-700">{movementToDelete.operator}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setMovementToDelete(null)}
                className="flex-1 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs rounded-xl border border-neutral-300 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (onDeleteMovement) onDeleteMovement(movementToDelete.id);
                  setMovementToDelete(null);
                  showToast('Mouvement de stock supprimé.');
                }}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
