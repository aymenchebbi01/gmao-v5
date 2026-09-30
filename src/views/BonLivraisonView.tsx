import React, { useState, useMemo } from 'react';
import { DeliveryNote, AppUser } from '../types/gmao';
import {
  Search,
  Plus,
  FileText,
  CheckCircle2,
  Truck,
  Eye,
  Download,
  Printer,
  X,
  Building2,
  ShieldCheck,
  PackageCheck,
  Check,
  Trash2,
  Edit2,
  AlertTriangle,
} from 'lucide-react';
import { ThermoplasticsLogo } from '../components/ThermoplasticsLogo';
import { downloadBonLivraisonPdf } from '../lib/bonLivraisonPdf';

interface BonLivraisonViewProps {
  notes: DeliveryNote[];
  onAddNewBL: (note: DeliveryNote) => void;
  onDeleteBL?: (id: string) => void;
  onEditBL?: (note: DeliveryNote) => void;
  currentUser?: AppUser;
}

export const BonLivraisonView: React.FC<BonLivraisonViewProps> = ({
  notes,
  onAddNewBL,
  onDeleteBL,
  onEditBL,
  currentUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState<DeliveryNote | null>(null);
  const [pdfNote, setPdfNote] = useState<DeliveryNote | null>(null);
  const [downloadSuccessToast, setDownloadSuccessToast] = useState<string | null>(null);

  // Admin Delete & Edit States
  const [deletingNote, setDeletingNote] = useState<DeliveryNote | null>(null);
  const [editingNote, setEditingNote] = useState<DeliveryNote | null>(null);
  const [editFormData, setEditFormData] = useState<{
    date: string;
    supplier: string;
    receivedBy: string;
    totalAmount: number;
    totalItems: number;
    status: DeliveryNote['status'];
  }>({
    date: '',
    supplier: '',
    receivedBy: '',
    totalAmount: 0,
    totalItems: 0,
    status: 'Received',
  });

  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    return (currentUser.role || '').toLowerCase() === 'admin';
  }, [currentUser]);

  const handleOpenEdit = (note: DeliveryNote) => {
    setEditingNote(note);
    setEditFormData({
      date: note.date || '',
      supplier: note.supplier || '',
      receivedBy: note.receivedBy || '',
      totalAmount: note.totalAmount || 0,
      totalItems: note.totalItems || 0,
      status: note.status,
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote) return;
    const updated: DeliveryNote = {
      ...editingNote,
      date: editFormData.date,
      supplier: editFormData.supplier.trim(),
      receivedBy: editFormData.receivedBy.trim(),
      totalAmount: Number(editFormData.totalAmount) || 0,
      totalItems: Number(editFormData.totalItems) || 0,
      status: editFormData.status,
    };
    onEditBL?.(updated);
    setEditingNote(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingNote) return;
    onDeleteBL?.(deletingNote.id);
    setDeletingNote(null);
  };

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      const q = searchQuery.toLowerCase();
      return (
        !q ||
        n.refBL.toLowerCase().includes(q) ||
        n.supplier.toLowerCase().includes(q) ||
        n.receivedBy.toLowerCase().includes(q)
      );
    });
  }, [notes, searchQuery]);

  const handleDownloadPdf = (note: DeliveryNote) => {
    downloadBonLivraisonPdf(note);
    setDownloadSuccessToast(`Bon de Livraison ${note.refBL} downloaded as PDF (.pdf).`);
    setTimeout(() => setDownloadSuccessToast(null), 3500);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Download Success Notification */}
      {downloadSuccessToast && (
        <div className="fixed top-5 right-5 z-50 bg-neutral-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-200 border border-neutral-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{downloadSuccessToast}</span>
        </div>
      )}

      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by BL ref, supplier, receiver..."
            className="w-full pl-10 pr-4 py-2 bg-white rounded-xl text-sm font-medium border border-neutral-300 shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-neutral-600 bg-white/70 px-3.5 py-2 rounded-xl border border-neutral-300">
            Total Delivery Notes: <strong className="text-neutral-900 font-mono">{notes.length}</strong>
          </span>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-[#ebeeed] rounded-3xl border border-neutral-400/80 shadow-xs overflow-hidden flex flex-col justify-between min-h-[500px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-300 text-sm font-bold text-neutral-900 bg-black/5">
                <th className="py-4 px-5">Receiving Date</th>
                <th className="py-4 px-5">Réf BL</th>
                <th className="py-4 px-6">Supplier / Manufacturer</th>
                <th className="py-4 px-5">Received By</th>
                <th className="py-4 px-4 text-center">Quantité Articles</th>
                <th className="py-4 px-4 text-right">Montant Facture</th>
                <th className="py-4 px-5">Statut Conformité</th>
                <th className="py-4 px-5 text-right">Actions Document</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-300/70 text-sm font-medium text-neutral-800">
              {filteredNotes.map((n) => (
                <tr key={n.id} className="hover:bg-white/40 transition-colors">
                  <td className="py-3.5 px-5 font-mono text-xs tabular-nums text-neutral-700 whitespace-nowrap">
                    {n.date}
                  </td>
                  <td className="py-3.5 px-5 font-mono font-bold text-blue-700 whitespace-nowrap">
                    {n.refBL}
                  </td>
                  <td className="py-3.5 px-6 whitespace-nowrap">
                    <div className="font-bold text-neutral-900">{n.supplier}</div>
                  </td>
                  <td className="py-3.5 px-5 text-neutral-700 whitespace-nowrap">
                    {n.receivedBy}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold whitespace-nowrap">
                    {n.totalItems} pcs
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-neutral-900 whitespace-nowrap">
                    {n.totalAmount.toFixed(2)} TND
                  </td>
                  <td className="py-3.5 px-5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{n.status}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedNote(n)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-neutral-100 text-neutral-900 rounded-lg text-xs font-bold border border-neutral-300 shadow-xs cursor-pointer"
                        title="Consulter les détails du bon"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        <span>Détails</span>
                      </button>

                      <button
                        onClick={() => handleDownloadPdf(n)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                        title="Télécharger le fichier PDF officiel (.pdf)"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Télécharger PDF</span>
                      </button>

                      <button
                        onClick={() => setPdfNote(n)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-xs font-bold border border-neutral-300 shadow-xs transition-colors cursor-pointer"
                        title="Aperçu & Impression A4"
                      >
                        <FileText className="w-3.5 h-3.5 text-neutral-600" />
                        <span>Aperçu</span>
                      </button>

                      {isAdmin && (
                        <div className="flex items-center gap-1 pl-1 border-l border-neutral-300 ml-1">
                          <button
                            onClick={() => handleOpenEdit(n)}
                            className="p-1.5 bg-white hover:bg-blue-50 text-blue-700 rounded-lg border border-neutral-300 hover:border-blue-300 transition-colors shadow-2xs cursor-pointer"
                            title="Modifier le Bon de Livraison (Admin)"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingNote(n)}
                            className="p-1.5 bg-white hover:bg-red-50 text-red-700 rounded-lg border border-neutral-300 hover:border-red-300 transition-colors shadow-2xs cursor-pointer"
                            title="Supprimer le Bon de Livraison (Admin)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inline Slip Details Sheet */}
      {selectedNote && (
        <div className="bg-white text-neutral-900 rounded-3xl p-6 border border-neutral-300 shadow-sm space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-neutral-400 uppercase">Goods Receipt Note</span>
              <h3 className="text-xl font-bold font-mono text-blue-700">{selectedNote.refBL}</h3>
              <span className="px-3 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                {selectedNote.status}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleDownloadPdf(selectedNote)}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger BL (PDF)</span>
              </button>
              <button
                onClick={() => setPdfNote(selectedNote)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl border border-neutral-300 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Aperçu Impression</span>
              </button>
              <button
                onClick={() => setSelectedNote(null)}
                className="text-xs font-bold text-neutral-500 hover:text-neutral-900 cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-[#f8faf9] rounded-2xl border border-neutral-200 text-xs">
            <div>
              <span className="text-neutral-500 font-semibold">Supplier:</span>
              <div className="font-bold text-sm text-neutral-900 mt-0.5">{selectedNote.supplier}</div>
            </div>
            <div>
              <span className="text-neutral-500 font-semibold">Receiving Date:</span>
              <div className="font-bold text-sm text-neutral-900 font-mono mt-0.5">{selectedNote.date}</div>
            </div>
            <div>
              <span className="text-neutral-500 font-semibold">Received & Inspected By:</span>
              <div className="font-bold text-sm text-neutral-800 mt-0.5">{selectedNote.receivedBy}</div>
            </div>
            <div>
              <span className="text-neutral-500 font-semibold">Montant Total Facture :</span>
              <div className="font-bold text-sm text-neutral-900 font-mono mt-0.5">
                {selectedNote.totalAmount.toFixed(2)} TND
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="text-xs font-bold text-neutral-700 uppercase">Delivered Items & Parts:</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border border-neutral-200 rounded-xl overflow-hidden">
                <thead className="bg-neutral-100 font-bold text-neutral-700">
                  <tr>
                    <th className="p-2.5">Part Ref</th>
                    <th className="p-2.5">Désignation</th>
                    <th className="p-2.5 text-center">Quantité</th>
                    <th className="p-2.5 text-right">Prix Unitaire</th>
                    <th className="p-2.5 text-right">Total Ligne</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {selectedNote.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-mono font-bold text-blue-700">{it.partNumber}</td>
                      <td className="p-2.5 font-medium">{it.description}</td>
                      <td className="p-2.5 text-center font-bold">{it.qty}</td>
                      <td className="p-2.5 text-right font-mono">{it.unitPrice.toFixed(2)} TND</td>
                      <td className="p-2.5 text-right font-mono font-bold">
                        {(it.qty * it.unitPrice).toFixed(2)} TND
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OFFICIAL PRINTABLE / DOWNLOADABLE BL PDF MODAL (IATF 16949 / ISO 9001)    */}
      {/* ========================================================================= */}
      {pdfNote && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-neutral-900 rounded-3xl max-w-4xl w-full my-6 p-6 sm:p-10 border border-neutral-300 shadow-2xl space-y-6 animate-in zoom-in-95 duration-150">
            {/* Modal Controls Header */}
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <span className="font-bold text-neutral-900 text-sm">
                  Aperçu Goods Receipt Note / Livraison Format PDF
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => pdfNote && handleDownloadPdf(pdfNote)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger le Fichier PDF (.pdf)</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="flex items-center gap-2 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs rounded-xl border border-neutral-300 transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer (A4)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPdfNote(null)}
                  className="p-2 text-neutral-400 hover:text-neutral-900 rounded-xl hover:bg-neutral-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Sheet Container */}
            <div id="printable-bl-doc" className="bg-white p-6 sm:p-8 border border-neutral-300 rounded-2xl space-y-6">
              {/* Document Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-neutral-900 pb-5">
                <div className="flex items-center gap-3">
                  <ThermoplasticsLogo className="w-12 h-12" />
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-neutral-900 leading-tight">
                      THERMOPLASTICS TUNISIA
                    </h2>
                    <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                      Plasturgie & Injection Technique · Zone Industrielle Ben Arous
                    </p>
                    <p className="text-[10px] text-neutral-400">
                      Système Qualité Certifié ISO 9001:2015 & IATF 16949
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="inline-block bg-neutral-900 text-white font-mono font-black text-sm px-3 py-1 rounded-md">
                    {pdfNote.refBL}
                  </div>
                  <div className="text-xs font-bold text-neutral-600 mt-1">
                    Receiving Date: <span className="font-mono text-neutral-900">{pdfNote.date}</span>
                  </div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">
                    Réf Doc : DOC-MAG-BL-{new Date().getFullYear()}
                  </div>
                </div>
              </div>

              {/* Title Banner */}
              <div className="bg-neutral-100 p-3 rounded-xl border border-neutral-300 text-center">
                <h1 className="text-base sm:text-lg font-black text-neutral-900 tracking-wide uppercase">
                  GOODS RECEIPT & DELIVERY NOTE - SPARE PARTS WAREHOUSE
                </h1>
                <p className="text-[11px] text-neutral-600 font-medium">
                  Spare Parts, Consumables & Tooling Inventory Inbound Procedure
                </p>
              </div>

              {/* Stakeholders Info Boxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1.5">
                  <div className="font-black text-neutral-900 uppercase text-[11px] flex items-center gap-1.5 pb-1 border-b border-neutral-200">
                    <Truck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Supplier & Shipper</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 font-semibold">Société / Fabricant : </span>
                    <strong className="text-neutral-900">{pdfNote.supplier}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 font-semibold">Delivery Note N°: </span>
                    <span className="font-mono font-bold text-blue-700">{pdfNote.refBL}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 font-semibold">Destination : </span>
                    <span className="text-neutral-800">Magasin Central & Maintenance Usine</span>
                  </div>
                </div>

                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1.5">
                  <div className="font-black text-neutral-900 uppercase text-[11px] flex items-center gap-1.5 pb-1 border-b border-neutral-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Receiving & Quality Inspection</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 font-semibold">CMMS Receiving Agent: </span>
                    <strong className="text-neutral-900">{pdfNote.receivedBy}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 font-semibold">Statut Inspection : </span>
                    <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                      {pdfNote.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 font-semibold">Type de mouvement : </span>
                    <span className="font-bold text-neutral-800">Entrée Réassort Catalogue PDR</span>
                  </div>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase text-neutral-700 flex items-center gap-1.5">
                  <PackageCheck className="w-4 h-4 text-neutral-600" />
                  <span>Delivered Spare Parts & Components Detail</span>
                </div>
                <table className="w-full text-left text-xs border border-neutral-300 rounded-xl overflow-hidden">
                  <thead>
                    <tr className="bg-neutral-900 text-white font-bold">
                      <th className="p-3">#</th>
                      <th className="p-3">Réf Article PDR</th>
                      <th className="p-3">Désignation Complète</th>
                      <th className="p-3 text-center">Quantité Livrée</th>
                      <th className="p-3 text-right">Prix Unitaire (TND)</th>
                      <th className="p-3 text-right">Total Ligne HT (TND)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 font-medium">
                    {pdfNote.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50">
                        <td className="p-3 font-mono text-neutral-500">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-blue-700">{it.partNumber}</td>
                        <td className="p-3 font-bold text-neutral-900">{it.description}</td>
                        <td className="p-3 text-center font-mono font-black text-neutral-900">
                          {it.qty} pcs
                        </td>
                        <td className="p-3 text-right font-mono">{it.unitPrice.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono font-black text-neutral-900">
                          {(it.qty * it.unitPrice).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-neutral-900 text-white font-bold text-sm">
                      <td colSpan={3} className="p-3 text-right uppercase tracking-wider">
                        Montant Total HT :
                      </td>
                      <td className="p-3 text-center font-mono font-black">{pdfNote.totalItems} pcs</td>
                      <td colSpan={2} className="p-3 text-right font-mono font-black text-emerald-400">
                        {pdfNote.totalAmount.toFixed(2)} TND
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Official 3-Signatures & Stamps Block */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-neutral-300 text-xs">
                <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 flex flex-col justify-between h-32">
                  <div className="font-bold text-neutral-700 uppercase text-[10px]">
                    1. Supplier / Delivery Agent Signature
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Nom & Signature :
                  </div>
                  <div className="text-[9px] text-neutral-400 italic">
                    Marchandise remise en bon état
                  </div>
                </div>

                <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 flex flex-col justify-between h-32">
                  <div className="font-bold text-neutral-700 uppercase text-[10px]">
                    2. Visa Contrôle Conformité Qualité
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Contrôle visuel & références : <strong className="text-emerald-700">Conforme</strong>
                  </div>
                  <div className="text-[9px] text-neutral-400 italic">
                    Conforme aux exigences d&apos;achat PDR
                  </div>
                </div>

                <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 flex flex-col justify-between h-32">
                  <div className="font-bold text-neutral-700 uppercase text-[10px]">
                    3. Visa Magasinier GMAO & Cachet
                  </div>
                  <div className="text-[11px] font-bold text-neutral-900">
                    {pdfNote.receivedBy}
                  </div>
                  <div className="text-[9px] text-neutral-500">
                    Stock GMAO mis à jour avec succès
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Footer Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-200 print:hidden">
              <span className="text-xs text-neutral-500">
                Imprimez ou enregistrez ce bon en PDF haute définition pour vos dossiers d&apos;achats & audit.
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPdfNote(null)}
                  className="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADMIN EDIT DELIVERY NOTE                                           */}
      {/* ========================================================================= */}
      {editingNote && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-neutral-900 rounded-3xl p-6 sm:p-8 border border-neutral-300 shadow-2xl max-w-lg w-full space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2 text-blue-600 font-bold">
                <Edit2 className="w-5 h-5" />
                <h3 className="text-base font-black text-neutral-900">
                  Modifier le Bon de Livraison {editingNote.refBL}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingNote(null)}
                className="p-1 text-neutral-400 hover:text-neutral-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Date de Réception
                  </label>
                  <input
                    type="date"
                    required
                    value={editFormData.date}
                    onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Statut de Conformité
                  </label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as DeliveryNote['status'] })}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Received">Received</option>
                    <option value="Partially Received">Partially Received</option>
                    <option value="Inspected">Inspected</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                  Fournisseur / Fabricant
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.supplier}
                  onChange={(e) => setEditFormData({ ...editFormData, supplier: e.target.value })}
                  className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                  Réceptionnaire
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.receivedBy}
                  onChange={(e) => setEditFormData({ ...editFormData, receivedBy: e.target.value })}
                  className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Quantité Articles (pcs)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editFormData.totalItems}
                    onChange={(e) => setEditFormData({ ...editFormData, totalItems: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Montant Facture (TND)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editFormData.totalAmount}
                    onChange={(e) => setEditFormData({ ...editFormData, totalAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#f8faf9] border border-neutral-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setEditingNote(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADMIN DELETE DELIVERY NOTE CONFIRMATION                             */}
      {/* ========================================================================= */}
      {deletingNote && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-neutral-900 rounded-3xl p-6 sm:p-8 border border-neutral-300 shadow-2xl max-w-md w-full space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2 text-red-600 font-bold">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-base font-black text-neutral-900">
                  Supprimer le Bon de Livraison {deletingNote.refBL}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingNote(null)}
                className="p-1 text-neutral-400 hover:text-neutral-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-neutral-600">
                Êtes-vous sûr de vouloir supprimer définitivement ce Bon de Livraison ? Cette action est irréversible.
              </p>

              <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 text-xs space-y-1.5 text-neutral-700">
                <div>
                  <span className="font-bold text-neutral-900">Réf BL : </span>
                  <span className="font-mono text-blue-700">{deletingNote.refBL}</span>
                </div>
                <div>
                  <span className="font-bold text-neutral-900">Fournisseur : </span>
                  {deletingNote.supplier}
                </div>
                <div>
                  <span className="font-bold text-neutral-900">Réceptionné par : </span>
                  {deletingNote.receivedBy}
                </div>
                <div>
                  <span className="font-bold text-neutral-900">Articles : </span>
                  {deletingNote.totalItems} pcs
                </div>
                <div>
                  <span className="font-bold text-neutral-900">Montant : </span>
                  {deletingNote.totalAmount.toFixed(2)} TND
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingNote(null)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
