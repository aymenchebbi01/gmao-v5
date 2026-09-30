import React, { useState, useEffect, useRef } from 'react';
import {
  Machine,
  Mold,
  InterventionRequest,
  MaintenanceOrder,
  InterventionReport,
  StockItem,
  StockMovement,
  DeliveryNote,
  CalendarEvent,
  AppUser,
  MoldMaintenance,
  GMAOBackupPayload,
  GMAOBackupSnapshotSummary,
} from '../types/gmao';
import {
  createBackupPayload,
  downloadBackupJSON,
  saveLocalSnapshot,
  getLocalSnapshotSummaries,
  getLocalSnapshotById,
  deleteLocalSnapshot,
  validateBackupFile,
  FullGMAOState,
} from '../lib/backupManager';
import { logMovement } from '../lib/auditLogger';
import {
  sqliteApi,
  SqliteDbStats,
  SqlQueryResult,
  BackupFile,
  BackupConfig,
} from '../services/sqliteApi';
import {
  Database,
  Download,
  Upload,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  Trash2,
  ShieldCheck,
  RotateCcw,
  Clock,
  Layers,
  Terminal,
  Play,
  Copy,
  Calendar,
  Save,
  FolderArchive,
  ShieldAlert,
  Cpu,
  FileCode,
  Check,
  X,
  FileUp,
  Settings,
} from 'lucide-react';

interface BackupViewProps {
  currentUser?: AppUser;
  state: FullGMAOState;
  onRestoreState: (restoredData: FullGMAOState) => void;
  onResetFactoryData: () => void;
}

export const BackupView: React.FC<BackupViewProps> = ({
  currentUser,
  state,
  onRestoreState,
  onResetFactoryData,
}) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'manager' | 'console' | 'snapshots'>('manager');

  // Physical SQLite backups state
  const [backupsList, setBackupsList] = useState<BackupFile[]>([]);
  const [backupConfig, setBackupConfig] = useState<BackupConfig>({
    autoBackupEnabled: true,
    intervalHours: 6,
    maxBackupsToKeep: 30,
  });
  const [loadingBackups, setLoadingBackups] = useState<boolean>(false);
  const [creatingBackup, setCreatingBackup] = useState<boolean>(false);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [backupNote, setBackupNote] = useState<string>('');

  // Selected file for restore / delete confirmation modal
  const [confirmRestoreFile, setConfirmRestoreFile] = useState<BackupFile | null>(null);
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<BackupFile | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  // Drag and drop upload state
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const sqliteUploadInputRef = useRef<HTMLInputElement>(null);

  // Feedback notifications
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // SQLite stats and SQL Console state
  const [sqliteStats, setSqliteStats] = useState<SqliteDbStats | null>(null);
  const [loadingSqlite, setLoadingSqlite] = useState<boolean>(false);
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT number, name, brand, status, line FROM machines LIMIT 5;');
  const [sqlResult, setSqlResult] = useState<SqlQueryResult | null>(null);
  const [sqlRunning, setSqlRunning] = useState<boolean>(false);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [integrityMessage, setIntegrityMessage] = useState<string | null>(null);

  // JSON Snapshots state (legacy / browser storage)
  const [localSnapshots, setLocalSnapshots] = useState<GMAOBackupSnapshotSummary[]>([]);
  const [stagedBackup, setStagedBackup] = useState<GMAOBackupPayload | null>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  const showSuccess = (msg: string) => {
    setSuccessBanner(msg);
    setErrorBanner(null);
    setTimeout(() => setSuccessBanner(null), 5000);
  };

  const showError = (msg: string) => {
    setErrorBanner(msg);
    setSuccessBanner(null);
    setTimeout(() => setErrorBanner(null), 6000);
  };

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'Ko', 'Mo', 'Go'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatDate = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Load backups list and configuration
  const loadBackupsData = async () => {
    try {
      setLoadingBackups(true);
      const [files, cfg] = await Promise.all([
        sqliteApi.getBackups(),
        sqliteApi.getBackupConfig(),
      ]);
      setBackupsList(files);
      setBackupConfig(cfg);
    } catch (err: any) {
      console.warn('Failed to load backup data:', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  const fetchSqliteStats = async () => {
    try {
      setLoadingSqlite(true);
      const stats = await sqliteApi.getStats();
      setSqliteStats(stats);
    } catch (err: any) {
      console.warn('Could not fetch SQLite stats:', err);
    } finally {
      setLoadingSqlite(false);
    }
  };

  const refreshSnapshots = () => {
    setLocalSnapshots(getLocalSnapshotSummaries());
  };

  useEffect(() => {
    loadBackupsData();
    fetchSqliteStats();
    refreshSnapshots();
  }, []);

  // Create manual backup immediately
  const handleCreateManualBackup = async () => {
    try {
      setCreatingBackup(true);
      const label = backupNote.trim() ? backupNote.trim().replace(/\s+/g, '_') : 'manual';
      const res = await sqliteApi.createBackup(label);
      showSuccess(`Sauvegarde SQLite "${res.filename}" créée avec succès.`);
      setBackupNote('');
      await loadBackupsData();
      await fetchSqliteStats();

      const author = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Administrateur';
      logMovement({
        category: 'System Backup',
        action: 'BACKUP_CREATE',
        targetRef: res.filename,
        user: author,
        details: `Création d'une sauvegarde physique SQLite (${res.filename}). Note: ${label}`,
        newState: 'Saved to Server',
        severity: 'success',
      });
    } catch (err: any) {
      showError(`Échec de création de la sauvegarde : ${err.message}`);
    } finally {
      setCreatingBackup(false);
    }
  };

  // Save auto backup configuration
  const handleSaveConfig = async () => {
    try {
      setSavingConfig(true);
      const updated = await sqliteApi.updateBackupConfig(backupConfig);
      setBackupConfig(updated);
      showSuccess('Paramètres de planification automatique enregistrés avec succès.');
    } catch (err: any) {
      showError(`Erreur lors de la sauvegarde de la configuration : ${err.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  // Delete a backup file
  const handleDeleteBackup = async (file: BackupFile) => {
    try {
      await sqliteApi.deleteBackup(file.filename);
      showSuccess(`Sauvegarde "${file.filename}" supprimée.`);
      setConfirmDeleteFile(null);
      await loadBackupsData();
    } catch (err: any) {
      showError(`Erreur lors de la suppression : ${err.message}`);
    }
  };

  // Restore from an existing backup file on the server
  const handleRestoreBackup = async (file: BackupFile) => {
    try {
      setIsRestoring(true);
      const res = await sqliteApi.restoreBackup(file.filename);
      
      // Reload full state into the client application
      const full = await sqliteApi.getFullState();
      if (full) {
        onRestoreState(full);
      }

      const author = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Administrateur';
      logMovement({
        category: 'System Backup',
        action: 'BACKUP_RESTORE',
        targetRef: file.filename,
        user: author,
        details: `Restauration complète de la base de données SQLite depuis l'archive ${file.filename}.`,
        previousState: 'Previous Active State',
        newState: 'Restored from SQLite Archive',
        severity: 'warning',
      });

      showSuccess(`Restauration réussie depuis "${file.filename}". La base est synchronisée.`);
      setConfirmRestoreFile(null);
      await loadBackupsData();
      await fetchSqliteStats();
    } catch (err: any) {
      showError(`Erreur lors de la restauration : ${err.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  // Upload and restore a direct SQLite file (.sqlite or .db)
  const handleRestoreUploadedFile = async () => {
    if (!uploadFile) return;
    try {
      setUploading(true);
      const res = await sqliteApi.restoreUploadedBackup(uploadFile);

      // Reload full state
      const full = await sqliteApi.getFullState();
      if (full) {
        onRestoreState(full);
      }

      const author = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Administrateur';
      logMovement({
        category: 'System Backup',
        action: 'BACKUP_RESTORE',
        targetRef: uploadFile.name,
        user: author,
        details: `Importation et restauration d'un fichier SQLite (${uploadFile.name}).`,
        previousState: 'Previous Active State',
        newState: 'Restored from Uploaded SQLite',
        severity: 'warning',
      });

      showSuccess(`Fichier "${uploadFile.name}" importé et restauré avec succès dans SQLite !`);
      setUploadFile(null);
      if (sqliteUploadInputRef.current) {
        sqliteUploadInputRef.current.value = '';
      }
      await loadBackupsData();
      await fetchSqliteStats();
    } catch (err: any) {
      showError(`Erreur lors de l'importation SQLite : ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.sqlite') || file.name.endsWith('.db')) {
        setUploadFile(file);
      } else {
        showError('Format invalide. Veuillez déposer un fichier .sqlite ou .db.');
      }
    }
  };

  // SQL Query Runner
  const handleRunSqlQuery = async (customSql?: string) => {
    const toRun = customSql || sqlQuery;
    if (!toRun.trim()) return;
    setSqlRunning(true);
    setSqlError(null);
    setSqlResult(null);
    try {
      const res = await sqliteApi.runQuery(toRun);
      setSqlResult(res);
      showSuccess(`Requête exécutée avec succès (${res.rows.length} lignes renvoyées)`);
      fetchSqliteStats();
    } catch (err: any) {
      setSqlError(err.message || 'Échec de l\'exécution SQL');
      showError(`Erreur SQL : ${err.message}`);
    } finally {
      setSqlRunning(false);
    }
  };

  const handleRunIntegrityCheck = async () => {
    try {
      setSqlRunning(true);
      const res = await sqliteApi.runQuery('PRAGMA integrity_check;');
      const status = res.rows[0]?.integrity_check || res.values[0]?.[0] || 'ok';
      setIntegrityMessage(`Contrôle d'intégrité SQLite : ${status}`);
      showSuccess(`Résultat intégrité SQLite : ${status}`);
    } catch (err: any) {
      showError(`Échec du contrôle d'intégrité : ${err.message}`);
    } finally {
      setSqlRunning(false);
    }
  };

  // Factory Reset
  const handleFactoryReset = () => {
    if (
      window.confirm(
        'RÉINITIALISATION D\'URGENCE :\nÊtes-vous sûr de vouloir réinitialiser toutes les données aux valeurs d\'usine ?\n\nConseil : Effectuez une sauvegarde SQLite avant pour éviter toute perte.'
      )
    ) {
      const author = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Administrateur';
      onResetFactoryData();

      logMovement({
        category: 'System Backup',
        action: 'SYSTEM_RESET',
        targetRef: 'FACTORY-RESET',
        user: author,
        details: 'Réinitialisation complète de l\'application GMAO aux données d\'usine initiales.',
        previousState: 'Customized',
        newState: 'Factory Default',
        severity: 'danger',
      });

      showSuccess('Application réinitialisée aux données par défaut.');
      loadBackupsData();
      fetchSqliteStats();
    }
  };

  // Tag badge color mapper
  const getTagBadge = (tag: BackupFile['tag']) => {
    switch (tag) {
      case 'auto':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="w-3 h-3" /> Auto
          </span>
        );
      case 'manual':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Manuel
          </span>
        );
      case 'safety':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <ShieldCheck className="w-3 h-3" /> Sécurité
          </span>
        );
      case 'upload':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            <FileUp className="w-3 h-3" /> Importé
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
            Archive
          </span>
        );
    }
  };

  const totalBackupSize = backupsList.reduce((acc, f) => acc + (f.size || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-200">
      {/* Notifications */}
      {successBanner && (
        <div className="bg-emerald-50 border-2 border-emerald-400 text-emerald-950 p-4 rounded-2xl flex items-center justify-between text-xs font-bold shadow-md animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-800 hover:text-emerald-950 underline cursor-pointer text-xs"
          >
            Fermer
          </button>
        </div>
      )}

      {errorBanner && (
        <div className="bg-rose-50 border-2 border-rose-400 text-rose-950 p-4 rounded-2xl flex items-center justify-between text-xs font-bold shadow-md animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            onClick={() => setErrorBanner(null)}
            className="text-rose-800 hover:text-rose-950 underline cursor-pointer text-xs"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-indigo-500/20">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span>GMAO v1 &bull; Base SQLite Physique &bull; Thermoplastics Ltd</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Sauvegarde & Restauration Système
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Moteur de sauvegarde automatique et manuelle de la base SQLite intégrale (14 tables GMAO v1).
              Exportez, téléchargez et restaurez vos archives à tout moment avec sécurité garantie.
            </p>
          </div>

          {/* Quick Actions in Header */}
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="/api/backups/download"
              download
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all shadow-sm backdrop-blur-sm"
              title="Télécharger directement la base SQLite active"
            >
              <Download className="w-4 h-4 text-indigo-300" />
              <span>Télécharger Base Active</span>
            </a>

            <button
              onClick={handleRunIntegrityCheck}
              disabled={sqlRunning}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600/60 hover:bg-indigo-600 text-white border border-indigo-400/30 transition-all shadow-sm"
              title="Vérifier l'intégrité structurelle de la base SQLite"
            >
              <ShieldCheck className="w-4 h-4 text-indigo-200" />
              <span>{sqlRunning ? 'Vérification...' : 'Vérifier Intégrité'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overview Stat Cards (Inspired by gmao102 BackupManager) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Backups */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <FolderArchive className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Archives Fichiers</div>
            <div className="text-2xl font-black text-slate-800 mt-0.5">{backupsList.length}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Fichiers SQLite sur disque</div>
          </div>
        </div>

        {/* Card 2: Total Storage */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Espace Stockage</div>
            <div className="text-2xl font-black text-slate-800 mt-0.5">{formatBytes(totalBackupSize)}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Dossier backups/</div>
          </div>
        </div>

        {/* Card 3: Auto-Backup Status */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
            backupConfig.autoBackupEnabled
              ? 'bg-indigo-50 border border-indigo-100 text-indigo-600'
              : 'bg-slate-100 border border-slate-200 text-slate-400'
          }`}>
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sauvegarde Auto</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${backupConfig.autoBackupEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span className="text-base font-bold text-slate-800">
                {backupConfig.autoBackupEnabled ? `Toutes les ${backupConfig.intervalHours}h` : 'Désactivée'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Rétention: max {backupConfig.maxBackupsToKeep}</div>
          </div>
        </div>

        {/* Card 4: SQLite Database State */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600 shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Base Active</div>
            <div className="text-2xl font-black text-slate-800 mt-0.5">
              {sqliteStats?.totalRows ?? 0} <span className="text-xs font-normal text-slate-500">lignes</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {sqliteStats?.fileSizeBytes ? formatBytes(sqliteStats.fileSizeBytes) : 'data/gmao.sqlite'}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('manager')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'manager'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FolderArchive className="w-4 h-4" />
          <span>Gestionnaire des Sauvegardes SQLite</span>
        </button>

        <button
          onClick={() => setActiveTab('console')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'console'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Console & Diagnostic SQLite</span>
        </button>

        <button
          onClick={() => setActiveTab('snapshots')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'snapshots'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileJson className="w-4 h-4" />
          <span>Instantanés JSON & Usine</span>
        </button>
      </div>

      {/* TAB 1: MAIN BACKUP MANAGER */}
      {activeTab === 'manager' && (
        <div className="space-y-6">
          {/* Top Row: Scheduler Settings & Immediate Manual Backup */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: Scheduler Configuration */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Planification Automatique (Scheduler)</h2>
                    <p className="text-[11px] text-slate-400">Exécution en arrière-plan sans interruption de service</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={backupConfig.autoBackupEnabled}
                    onChange={(e) =>
                      setBackupConfig({ ...backupConfig, autoBackupEnabled: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Intervalle de Sauvegarde Automatique
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {[1, 2, 4, 6, 12, 24].map((hours) => (
                      <button
                        key={hours}
                        type="button"
                        onClick={() => setBackupConfig({ ...backupConfig, intervalHours: hours })}
                        className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                          backupConfig.intervalHours === hours
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {hours}h
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Rétention maximale (fichiers)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={100}
                      value={backupConfig.maxBackupsToKeep}
                      onChange={(e) =>
                        setBackupConfig({
                          ...backupConfig,
                          maxBackupsToKeep: Math.max(5, parseInt(e.target.value) || 30),
                        })
                      }
                      className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Les plus anciennes archives au-delà seront purgées
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="block text-xs font-semibold text-slate-700">Dernière / Prochaine</span>
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-1">
                      <div className="flex justify-between text-slate-600">
                        <span>Dernière :</span>
                        <span className="font-semibold text-slate-800">
                          {backupConfig.lastBackupTime ? formatDate(backupConfig.lastBackupTime) : 'Aucune'}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Prochaine :</span>
                        <span className="font-semibold text-indigo-600">
                          {backupConfig.nextBackupTime ? formatDate(backupConfig.nextBackupTime) : 'En attente'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleSaveConfig}
                    disabled={savingConfig}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingConfig ? 'Enregistrement...' : 'Enregistrer les Paramètres'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 2: Immediate Manual Backup & Direct Download */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Sauvegarde Manuelle Immédiate</h2>
                  <p className="text-[11px] text-slate-400">Génère un instantané physique complet de la base actuelle</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Étiquette ou motif (Optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: avant_mise_a_jour_moules, audit_annuel, etc."
                    value={backupNote}
                    onChange={(e) => setBackupNote(e.target.value)}
                    className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Sera incorporé dans le nom de fichier pour identification facile.
                  </span>
                </div>

                <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-indigo-900 leading-relaxed">
                    <strong>Sauvegarde physique intégrale :</strong> Le fichier généré comprend toutes les tables
                    (machines, moules, OT, DI, rapports, stocks PDR, matières premières, bons de livraison, utilisateurs et logs).
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={handleCreateManualBackup}
                    disabled={creatingBackup}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    <span>{creatingBackup ? 'Création de l\'archive...' : 'Sauvegarder Maintenant'}</span>
                  </button>

                  <a
                    href="/api/backups/download"
                    download
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-all"
                    title="Télécharger une copie immédiate sur votre ordinateur"
                  >
                    <Download className="w-4 h-4" />
                    <span>Télécharger</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Upload / Drag & Drop SQLite Zone */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <FileUp className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">
                    Restaurer depuis un Fichier SQLite (.sqlite / .db)
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Importez une archive externe pour remplacer la base active avec sécurité automatique
                  </p>
                </div>
              </div>

              {uploadFile && (
                <button
                  onClick={() => setUploadFile(null)}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                >
                  Annuler la sélection
                </button>
              )}
            </div>

            {/* Dropzone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => sqliteUploadInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-50/50'
                  : uploadFile
                  ? 'border-emerald-400 bg-emerald-50/30'
                  : 'border-slate-300 bg-slate-50/50 hover:bg-slate-100/50 hover:border-slate-400'
              }`}
            >
              <input
                ref={sqliteUploadInputRef}
                type="file"
                accept=".sqlite,.db"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setUploadFile(e.target.files[0]);
                  }
                }}
              />

              {uploadFile ? (
                <div className="space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Database className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">Fichier sélectionné : {uploadFile.name}</div>
                  <div className="text-[11px] text-slate-500">Taille : {formatBytes(uploadFile.size)}</div>
                  <div className="pt-2 flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestoreUploadedFile();
                      }}
                      disabled={uploading}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>{uploading ? 'Restauration en cours...' : 'Confirmer et Restaurer ce Fichier'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-slate-700">
                    Glissez-déposez votre fichier .sqlite ici, ou <span className="text-indigo-600 underline">parcourez vos fichiers</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Formats acceptés : base SQLite (.sqlite, .db) jusqu'à 150 Mo.
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                <strong>Sécurité garantie :</strong> Avant chaque restauration, une sauvegarde de secours est automatiquement
                enregistrée avec l'étiquette <code>-safety</code> pour vous permettre de revenir en arrière si nécessaire.
              </span>
            </div>
          </div>

          {/* Backups List Table */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <FolderArchive className="w-4 h-4 text-indigo-600" />
                  <span>Historique des Sauvegardes Disponibles ({backupsList.length})</span>
                </h2>
                <p className="text-[11px] text-slate-400">
                  Archives enregistrées sur le serveur local dans le dossier <code>backups/</code>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadBackupsData}
                  disabled={loadingBackups}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
                  title="Actualiser la liste"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingBackups ? 'animate-spin' : ''}`} />
                  <span>Actualiser</span>
                </button>
              </div>
            </div>

            {loadingBackups ? (
              <div className="py-12 text-center text-slate-400 text-xs">Chargement des archives SQLite...</div>
            ) : backupsList.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                  <FolderArchive className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-slate-600">Aucune archive de sauvegarde trouvée</div>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Cliquez sur "Sauvegarder Maintenant" ci-dessus pour générer votre première archive physique.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Nom de l'Archive</th>
                      <th className="py-3 px-4">Date de Création</th>
                      <th className="py-3 px-4">Taille</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {backupsList.map((file) => (
                      <tr key={file.filename} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">{getTagBadge(file.tag)}</td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                          {file.filename}
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {formatDate(file.createdAt)}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-600 whitespace-nowrap">
                          {formatBytes(file.size)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <a
                              href={`/api/backups/download/${encodeURIComponent(file.filename)}`}
                              download
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="Télécharger cette archive"
                            >
                              <Download className="w-4 h-4" />
                            </a>

                            <button
                              onClick={() => setConfirmRestoreFile(file)}
                              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                              title="Restaurer la base à cet état"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => setConfirmDeleteFile(file)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="Supprimer cette archive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SQLITE CONSOLE & DIAGNOSTIC */}
      {activeTab === 'console' && (
        <div className="space-y-6">
          {/* SQLite Engine & File Details */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Diagnostic de la Base SQLite Active</h2>
                  <p className="text-[11px] text-slate-400">Statistiques en temps réel et tables GMAO v1</p>
                </div>
              </div>
              <button
                onClick={fetchSqliteStats}
                disabled={loadingSqlite}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingSqlite ? 'animate-spin' : ''}`} />
                <span>Rafraîchir Stats</span>
              </button>
            </div>

            {sqliteStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Moteur</span>
                  <span className="font-semibold text-slate-800">{sqliteStats.engine}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Chemin Fichier</span>
                  <span className="font-mono font-semibold text-slate-800 truncate block" title={sqliteStats.filePath}>
                    {sqliteStats.filePath}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Taille Fichier</span>
                  <span className="font-semibold text-slate-800">{formatBytes(sqliteStats.fileSizeBytes)}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Lignes</span>
                  <span className="font-semibold text-slate-800">{sqliteStats.totalRows} enregistrements</span>
                </div>
              </div>
            )}

            {/* Tables Breakdown */}
            {sqliteStats?.tables && (
              <div>
                <h3 className="text-xs font-bold text-slate-700 mb-2">Répartition des tables GMAO v1 :</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {Object.entries(sqliteStats.tables).map(([tbl, count]) => (
                    <div
                      key={tbl}
                      className="p-2.5 bg-slate-50 hover:bg-indigo-50/50 rounded-xl border border-slate-200 transition-colors"
                    >
                      <span className="text-[10px] text-slate-500 font-mono block truncate" title={tbl}>
                        {tbl}
                      </span>
                      <span className="text-sm font-bold text-slate-800">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SQL Query Console */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Console SQL Directe</h2>
                  <p className="text-[11px] text-slate-400">Exécutez des requêtes SQL sur les tables GMAO</p>
                </div>
              </div>

              {/* Quick Preset Queries */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  onClick={() => handleRunSqlQuery('SELECT number, name, status, line FROM machines;')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-[11px]"
                >
                  Machines
                </button>
                <button
                  onClick={() => handleRunSqlQuery('SELECT refOT, type, status, priority FROM orders LIMIT 10;')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-[11px]"
                >
                  Ordres (OT)
                </button>
                <button
                  onClick={() => handleRunSqlQuery('SELECT item, sub_family, current_stock FROM materials LIMIT 10;')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-[11px]"
                >
                  Matières
                </button>
                <button
                  onClick={() => handleRunSqlQuery('SELECT part_number, name, current_stock FROM stock_items LIMIT 10;')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-[11px]"
                >
                  Pièces PDR
                </button>
                <button
                  onClick={() => handleRunSqlQuery('PRAGMA integrity_check;')}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-[11px]"
                >
                  Integrity Check
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <textarea
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                rows={3}
                className="w-full font-mono text-xs p-3 rounded-xl border border-slate-300 bg-slate-900 text-emerald-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="SELECT * FROM machines LIMIT 10;"
              />

              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-400">
                  Astuce : Vous pouvez exécuter des requêtes SELECT, PRAGMA ou des opérations directes.
                </span>
                <button
                  onClick={() => handleRunSqlQuery()}
                  disabled={sqlRunning}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{sqlRunning ? 'Exécution...' : 'Exécuter la Requête'}</span>
                </button>
              </div>
            </div>

            {sqlError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-mono text-rose-800">
                {sqlError}
              </div>
            )}

            {sqlResult && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Résultat ({sqlResult.rows.length} lignes renvoyées)</span>
                  {sqlResult.rowsAffected !== undefined && (
                    <span>Lignes affectées : {sqlResult.rowsAffected}</span>
                  )}
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-72">
                  <table className="w-full text-left text-xs border-collapse font-mono">
                    <thead className="bg-slate-100 text-slate-700 sticky top-0">
                      <tr>
                        {sqlResult.columns.map((col) => (
                          <th key={col} className="p-2 border-b border-slate-200 font-bold whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sqlResult.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          {sqlResult.columns.map((col) => (
                            <td key={col} className="p-2 whitespace-nowrap max-w-xs truncate text-slate-800">
                              {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: JSON SNAPSHOTS & FACTORY RESET */}
      {activeTab === 'snapshots' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <FileJson className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Instantanés JSON & Sauvegarde Locale du Navigateur</h2>
                <p className="text-[11px] text-slate-400">
                  Exportation/Importation de fichiers JSON portables pour échange ou archivage texte
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  try {
                    const author = currentUser ? `${currentUser.name} (${currentUser.role})` : 'Administrateur';
                    const payload = createBackupPayload(state, author, backupNote.trim() || undefined);
                    downloadBackupJSON(payload);
                    saveLocalSnapshot(payload);
                    refreshSnapshots();
                    showSuccess(`Sauvegarde JSON téléchargée (${payload.backupId}).`);
                  } catch (err: any) {
                    showError(`Erreur : ${err.message}`);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger Archive JSON</span>
              </button>

              <button
                onClick={() => jsonFileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
              >
                <Upload className="w-4 h-4" />
                <span>Importer un Fichier JSON</span>
              </button>
              <input
                ref={jsonFileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const content = event.target?.result as string;
                    const res = validateBackupFile(content);
                    if (!res.valid || !res.payload) {
                      showError(`Fichier JSON invalide : ${res.error || 'Erreur de syntaxe'}`);
                      setStagedBackup(null);
                      return;
                    }
                    setStagedBackup(res.payload);
                    showSuccess(`Fichier JSON "${file.name}" validé.`);
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }}
              />
            </div>

            {/* Staged JSON confirmation */}
            {stagedBackup && (
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-emerald-950">
                    Archive JSON prête à être restaurée : {stagedBackup.backupId}
                  </div>
                  <button
                    onClick={() => setStagedBackup(null)}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                  >
                    Annuler
                  </button>
                </div>
                <div className="text-[11px] text-emerald-800">
                  Créée le {stagedBackup.createdAt} par {stagedBackup.createdBy}. Note : {stagedBackup.notes || 'Aucune'}
                </div>
                <button
                  onClick={() => {
                    if (window.confirm('Confirmer la restauration depuis ce fichier JSON ?')) {
                      onRestoreState(stagedBackup.data);
                      showSuccess('État restauré avec succès depuis le fichier JSON.');
                      setStagedBackup(null);
                    }
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Appliquer la Restauration
                </button>
              </div>
            )}
          </div>

          {/* Emergency Factory Reset Card */}
          <div className="bg-rose-50/60 rounded-3xl p-6 border-2 border-rose-200 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-rose-900">Zone de Danger : Réinitialisation d'Usine</h2>
                <p className="text-[11px] text-rose-700">
                  Supprime l'ensemble des données créées et rétablit les valeurs par défaut de démonstration
                </p>
              </div>
            </div>

            <p className="text-xs text-rose-800">
              Cette action est irréversible sauf si vous possédez une archive de sauvegarde physique SQLite.
            </p>

            <button
              onClick={handleFactoryReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Réinitialiser aux Valeurs Usine</span>
            </button>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL FOR RESTORE */}
      {confirmRestoreFile && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Confirmer la Restauration</h3>
                <p className="text-xs text-slate-500">Remplacement de la base active par une archive</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Fichier archive :</span>
                <span className="font-mono font-bold text-slate-800">{confirmRestoreFile.filename}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Taille :</span>
                <span className="font-semibold text-slate-700">{formatBytes(confirmRestoreFile.size)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date de création :</span>
                <span className="font-semibold text-slate-700">{formatDate(confirmRestoreFile.createdAt)}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
              <strong>Sécurité automatique :</strong> Une sauvegarde de sécurité de l'état actuel de votre base GMAO sera
              automatiquement enregistrée avant que cette archive ne soit appliquée.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmRestoreFile(null)}
                disabled={isRestoring}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
              >
                Annuler
              </button>

              <button
                onClick={() => handleRestoreBackup(confirmRestoreFile)}
                disabled={isRestoring}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all"
              >
                <RotateCcw className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`} />
                <span>{isRestoring ? 'Restauration en cours...' : 'Confirmer la Restauration'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL FOR DELETE */}
      {confirmDeleteFile && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Supprimer l'archive</h3>
                <p className="text-xs text-slate-500">Cette action est définitive</p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Êtes-vous sûr de vouloir supprimer définitivement le fichier{' '}
              <strong className="font-mono text-slate-800">{confirmDeleteFile.filename}</strong> du disque ?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDeleteFile(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDeleteBackup(confirmDeleteFile)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
              >
                Supprimer Définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupView;
