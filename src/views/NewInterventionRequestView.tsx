import React, { useState, useMemo, useEffect } from 'react';
import { InterventionRequest, AppUser } from '../types/gmao';
import {
  AlertCircle,
  Send,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Calendar,
  Hash,
  WifiOff,
  Database,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { generateNextIRRef } from '../lib/gmaoUtils';
import {
  saveDIDraft,
  getDIDraft,
  clearDIDraft,
  useOnlineStatus,
} from '../lib/offlineDraftStorage';

export interface NewInterventionRequestViewProps {
  currentUser?: AppUser;
  existingRequests?: InterventionRequest[];
  onSave: (req: InterventionRequest) => void;
  onCancel: () => void;
  initialDescription?: string;
  isTabletMode?: boolean;
  targetMachineId?: string;
  targetMachineNumber?: string;
  hasActiveTicket?: boolean;
  activeTicketRef?: string;
  activeTicketStatus?: string;
}

export const NewInterventionRequestView: React.FC<NewInterventionRequestViewProps> = ({
  currentUser,
  existingRequests = [],
  onSave,
  onCancel,
  initialDescription,
  isTabletMode = false,
  targetMachineId,
  targetMachineNumber,
  hasActiveTicket = false,
  activeTicketRef,
  activeTicketStatus,
}) => {
  const isOnline = useOnlineStatus();

  // Point 1: Technicians can create intervention requests either in mobile or desktop.
  // -> ONLY fill a description of the problem field.
  const [problemDescription, setProblemDescription] = useState<string>(() => {
    if (initialDescription) return initialDescription;
    const draft = getDIDraft();
    return draft?.description || '';
  });
  const [requestDate, setRequestDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Sync initialDescription if changed from outside (e.g. clicking machine in tablet)
  useEffect(() => {
    if (initialDescription) {
      setProblemDescription(initialDescription);
    }
  }, [initialDescription]);

  // Auto-save draft on change
  useEffect(() => {
    if (problemDescription.trim()) {
      saveDIDraft({ description: problemDescription });
    }
  }, [problemDescription]);

  // Dynamic reference generation based on Year: IR-YYYY-0001, IR-YYYY-0002...
  // When year rolls over to 2027 -> resets cleanly to IR-2027-0001!
  const generatedRef = useMemo(() => {
    return generateNextIRRef(existingRequests, requestDate);
  }, [existingRequests, requestDate]);

  const QUICK_SUGGESTIONS = [
    'Hydraulic pressure drop under clamp cylinder',
    'Mold ejector jammed on cavity side',
    'Barrel heater band temperature fault',
    'Abnormal noise on hydraulic pump unit',
    'Cooling water hose leak on mold circuit',
    'Pneumatic parts unloader gripper fault',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemDescription.trim() || hasActiveTicket) return;

    const requesterName = currentUser ? currentUser.name : 'Shopfloor Technician';
    const requesterRole = currentUser ? currentUser.role : 'technician';

    const newRequest: InterventionRequest = {
      id: `ir-${Date.now()}`,
      refIR: generatedRef,
      date: requestDate,
      problemDescription: problemDescription.trim(),
      requester: requesterName,
      requesterRole,
      status: 'Waiting', // Point 2: The intervention request waits the validation of Responsable technique
      validatedBy: '',
      validatedAt: '',
      equipmentId: targetMachineId,
      equipmentName: targetMachineNumber,
      category: targetMachineId ? 'Machine' : undefined,
    };

    clearDIDraft();
    onSave(newRequest);
  };

  const handleClearText = () => {
    clearDIDraft();
    setProblemDescription('');
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5 animate-in fade-in duration-200">
      {/* Back & Title Header */}
      <div className="flex items-center justify-between border-b border-slate-300 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="min-h-[44px] min-w-[44px] rounded-lg text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-100 border border-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              New Intervention Request (DI)
            </h2>
          </div>
        </div>

        <span className="font-mono text-sm font-bold bg-slate-100 border border-slate-300 text-slate-900 px-3 py-1.5 rounded-lg">
          {generatedRef}
        </span>
      </div>

      {/* Duplicate ticket blocked warning banner */}
      {hasActiveTicket && (
        <div className="bg-amber-50 border-2 border-amber-500 text-amber-950 p-4 rounded-xl flex items-start gap-3 text-xs sm:text-sm shadow-xs animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-950 block text-sm">
              Machine {targetMachineNumber || 'sélectionnée'} a déjà un ticket en cours ({activeTicketRef || 'DI active'})
            </span>
            <span className="text-amber-900 block leading-relaxed">
              Statut actuel : <strong className="uppercase underline font-mono">{activeTicketStatus || 'En attente de validation'}</strong>.
              La création d'un doublon est bloquée pour éviter les conflits d'intervention en atelier.
            </span>
          </div>
        </div>
      )}

      {/* Workflow Information Banner */}

      {/* Submission Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-5 sm:p-7 border border-slate-300 shadow-xs space-y-5">
        {/* Requester & Dynamic Sequential Reference Badge */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs">
          <div>
            <span className="text-slate-500 font-bold block text-[11px] uppercase tracking-wider">
              Demandeur
            </span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">
              {currentUser?.name || 'Demandeur'}
            </span>
            <span className="text-slate-500 capitalize text-xs">
              {currentUser?.role || 'Technicien'}
            </span>
          </div>

          <div>
            <span className="text-slate-500 font-bold block text-[11px] uppercase tracking-wider">
              Reference
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono font-bold text-slate-900 bg-white border border-slate-300 px-3 py-1 rounded-md text-sm">
                {generatedRef}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-bold block text-[11px] uppercase tracking-wider">
                Date intervention
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRequestDate('2026-09-26')}
                  className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold transition-colors ${requestDate.startsWith('2026')
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  title="Test Année 2026"
                >
                  2026
                </button>
                {/*<button
                  type="button"
                  onClick={() => setRequestDate('2027-01-15')}
                  className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold transition-colors ${requestDate.startsWith('2027')
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  title="Test Année 2027"
                >
                  2027
                </button> */}
              </div>
            </div>
            <input
              type="date"
              value={requestDate}
              onChange={(e) => setRequestDate(e.target.value)}
              className="mt-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold w-full text-slate-900 focus:outline-none focus:border-slate-900"
            />
          </div>
        </div>

        {/* Offline indicator if working offline */}
        {!isOnline && (
          <div className="bg-amber-50 border border-amber-400 rounded-lg p-3 flex items-center gap-2.5 text-xs text-amber-950 font-medium">
            <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Mode Hors-Ligne Atelier Actif :</strong> Votre demande sera enregistrée localement dans la mémoire de la tablette et synchronisée automatiquement dès reconnexion.
            </span>
          </div>
        )}

        {/* Problem Description */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm sm:text-base font-bold text-slate-900">
              Problem Description *
            </label>
            {problemDescription.trim().length > 0 && (
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1 text-slate-700 font-semibold">
                  <Database className="w-3.5 h-3.5" />
                  Auto-saved
                </span>
                <button
                  type="button"
                  onClick={handleClearText}
                  className="text-red-700 hover:text-red-900 font-bold underline cursor-pointer"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
          <textarea
            rows={5}
            required
            autoFocus
            value={problemDescription}
            onChange={(e) => setProblemDescription(e.target.value)}
            placeholder=""
            className="w-full bg-white border border-slate-300 focus:border-slate-900 rounded-lg p-4 text-sm sm:text-base font-medium text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none transition-colors placeholder:text-slate-400 min-h-[140px]"
          />
        </div>

        {/* Shopfloor Quick Fault Suggestions 
        <div>
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-slate-600" />
            Symptômes fréquents en atelier :
          </span>
          <div className="flex flex-wrap gap-2">
            {QUICK_SUGGESTIONS.map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() =>
                  setProblemDescription((prev) =>
                    prev.trim() ? `${prev.trim().replace(/\.?$/, '')}. ${sug}` : sug
                  )
                }
                className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 px-3.5 py-2 rounded-lg transition-colors text-left cursor-pointer active:scale-98 min-h-[40px] flex items-center"
              >
                + {sug}
              </button>
            ))}
          </div>
        </div>*/}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-5 border-t border-slate-200 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[48px] px-6 py-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-sm rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!problemDescription.trim() || hasActiveTicket}
            className="min-h-[48px] flex items-center justify-center gap-2 px-8 py-3 bg-slate-900 hover:bg-black disabled:opacity-40 text-white font-bold text-sm rounded-lg shadow-xs transition-colors cursor-pointer active:scale-[0.99]"
          >
            <Send className="w-4 h-4" />
            <span>Send Request</span>
          </button>
        </div>
      </form>
    </div>
  );
};
