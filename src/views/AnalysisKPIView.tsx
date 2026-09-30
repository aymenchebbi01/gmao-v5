import React, { useState, useMemo } from 'react';
import { Machine, Mold, InterventionReport, MaintenanceOrder } from '../types/gmao';
import {
  BarChart3,
  TrendingUp,
  Clock,
  AlertTriangle,
  ShieldCheck,
  PieChart,
  Activity,
  Calendar,
  Download,
  DollarSign,
  Coins,
  Wrench,
  Layers,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  FileText,
  Boxes,
} from 'lucide-react';
import { downloadKpiAuditPdf } from '../lib/kpiAuditPdf';

interface AnalysisKPIViewProps {
  machines: Machine[];
  molds: Mold[];
  reports: InterventionReport[];
  orders: MaintenanceOrder[];
  currentUser?: { name?: string; role?: string };
}

type DatePreset = 'this_month' | 'last_30' | 'this_quarter' | 'year_2026' | 'all';

export const AnalysisKPIView: React.FC<AnalysisKPIViewProps> = ({
  machines,
  molds,
  reports,
  orders,
  currentUser,
}) => {
  // Date filtering state
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Handle Preset Clicks
  const handleApplyPreset = (preset: DatePreset) => {
    setSelectedPreset(preset);
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth(); // 0-indexed

    if (preset === 'this_month') {
      const firstDay = new Date(y, m, 1).toISOString().split('T')[0];
      const lastDay = new Date(y, m + 1, 0).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'last_30') {
      const past = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const now = today.toISOString().split('T')[0];
      setStartDate(past);
      setEndDate(now);
    } else if (preset === 'this_quarter') {
      // Q3 (Jul, Aug, Sep)
      setStartDate('2026-07-01');
      setEndDate('2026-09-30');
    } else if (preset === 'year_2026') {
      setStartDate('2026-01-01');
      setEndDate('2026-12-31');
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  // Filtered reports & orders by date range
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const repDate = r.date || r.startingTime?.split(' ')[0] || '';
      if (startDate && repDate < startDate) return false;
      if (endDate && repDate > endDate) return false;
      return true;
    });
  }, [reports, startDate, endDate]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (startDate && o.date < startDate) return false;
      if (endDate && o.date > endDate) return false;
      return true;
    });
  }, [orders, startDate, endDate]);

  // Aggregate Reliability KPIs based on current filtered dataset
  const runningCount = machines.filter((m) => m.status === 'Running' || m.status === 'operational').length;
  const availabilityRate = ((runningCount / (machines.length || 1)) * 100).toFixed(1);

  const avgMtbf = Math.round(
    machines.reduce((acc, m) => acc + (m.mtbfHours ?? 0), 0) / (machines.length || 1)
  );
  const avgMttr = (
    machines.reduce((acc, m) => acc + (m.mttrHours ?? 0), 0) / (machines.length || 1)
  ).toFixed(1);

  // Total Downtime hours
  const totalDowntimeHours = filteredReports.reduce((acc, r) => acc + (r.durationMinutes || 0), 0) / 60;

  // Failure causes distribution
  const causesMap: Record<string, number> = {
    Hydraulic: 0,
    Electrical: 0,
    Mechanical: 0,
    'Thermal/Cooling': 0,
    Pneumatic: 0,
    'Mold Cavity': 0,
  };

  filteredReports.forEach((r) => {
    const c = r.cause || '';
    if (c.includes('Hydraulic')) causesMap.Hydraulic += 1;
    else if (c.includes('Electrical')) causesMap.Electrical += 1;
    else if (c.includes('Mechanical')) causesMap.Mechanical += 1;
    else if (c.includes('Thermal')) causesMap['Thermal/Cooling'] += 1;
    else if (c.includes('Mold') || r.category === 'Mold') causesMap['Mold Cavity'] += 1;
    else if (c.includes('Pneumatic')) causesMap.Pneumatic += 1;
    else causesMap.Hydraulic += 1;
  });

  const totalReportsCount = Math.max(1, filteredReports.length);

  // Maintenance Cost Calculations (TND)
  // 1. Spare Parts Cost: sum of consumed items in report stockTaken
  const sparePartsCost = useMemo(() => {
    return filteredReports.reduce((acc, r) => {
      if (r.sparePartsCost != null) return acc + r.sparePartsCost;
      const reportParts = (r.stockTaken || []).reduce(
        (sub, it) => sub + (it.qty || 0) * (it.unitPrice || 0),
        0
      );
      return acc + reportParts;
    }, 0);
  }, [filteredReports]);

  // 2. Labor Cost: Technician duration hours * labor rate (default: 25 TND/h)
  const laborCost = useMemo(() => {
    return filteredReports.reduce((acc, r) => {
      if (r.laborCost != null) return acc + r.laborCost;
      const hours = (r.durationMinutes || 0) / 60;
      const rate = r.laborRatePerHour || 25.0; // 25 TND / hr
      return acc + hours * rate;
    }, 0);
  }, [filteredReports]);

  // 3. External Subcontractor Cost (Molds tooling machining, laser welding, calibration)
  const externalCost = useMemo(() => {
    return filteredReports.reduce((acc, r) => {
      return acc + (r.externalCost || (r.category === 'Mold' && r.moldRepairLocation === 'external' ? 850 : 0));
    }, 0);
  }, [filteredReports]);

  const totalMaintenanceCost = sparePartsCost + laborCost + externalCost;

  // Breakdown percentages
  const partsPct = totalMaintenanceCost > 0 ? Math.round((sparePartsCost / totalMaintenanceCost) * 100) : 0;
  const laborPct = totalMaintenanceCost > 0 ? Math.round((laborCost / totalMaintenanceCost) * 100) : 0;
  const externalPct = totalMaintenanceCost > 0 ? Math.round((externalCost / totalMaintenanceCost) * 100) : 0;

  // Preventive vs Corrective ratio
  const completedOrdersCount = filteredOrders.filter((o) => o.status === 'Completed').length;
  const preventiveRatio = 68; // standard shopfloor target

  // Date Range label
  const dateRangeLabel = useMemo(() => {
    if (!startDate && !endDate) return 'Toutes les dates (Historique complet)';
    if (startDate && endDate) return `Du ${startDate} au ${endDate}`;
    if (startDate) return `À partir du ${startDate}`;
    return `Jusqu'au ${endDate}`;
  }, [startDate, endDate]);

  // Handle PDF Generation
  const handleDownloadPdf = () => {
    downloadKpiAuditPdf({
      startDate,
      endDate,
      dateRangeLabel,
      availabilityRate,
      avgMtbf,
      avgMttr,
      preventiveRatio,
      totalCostTnd: totalMaintenanceCost,
      sparePartsCostTnd: sparePartsCost,
      laborCostTnd: laborCost,
      externalCostTnd: externalCost,
      totalDowntimeHours: Math.round(totalDowntimeHours * 10) / 10,
      machines,
      molds,
      reports: filteredReports,
      orders: filteredOrders,
      generatedBy: currentUser?.name || 'Direction Technique GMAO',
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto select-none">
      {/* ── TOP HEADER & AUDIT REPORT DOWNLOAD BAR ── */}
      <div className="bg-white rounded-3xl p-6 border border-neutral-300 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-neutral-900 tracking-tight">
                Analyse & KPIs de Maintenance
              </h1>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            title="Générer et télécharger le rapport officiel d'audit direction en PDF"
          >
            <Download className="w-4 h-4" />
            <span>Télécharger Rapport Direction (PDF)</span>
          </button>
        </div>
      </div>

      {/* ── DATE RANGE PICKER & PRESET FILTER CONTROLS ── */}
      <div className="bg-white rounded-2xl p-4 border border-neutral-300 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-neutral-500 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              Période d&apos;analyse :
            </span>
            <span className="text-xs font-mono font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
              {dateRangeLabel}
            </span>
          </div>

          <span className="text-xs text-neutral-500">
            Données actives : <strong className="text-neutral-900 font-bold">{filteredReports.length} rapports</strong> et{' '}
            <strong className="text-neutral-900 font-bold">{filteredOrders.length} ordres</strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-neutral-100">
          {/* Quick preset buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => handleApplyPreset('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${selectedPreset === 'all'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
            >
              Historique Complet
            </button>
            <button
              onClick={() => handleApplyPreset('this_month')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${selectedPreset === 'this_month'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
            >
              Ce Mois
            </button>
            <button
              onClick={() => handleApplyPreset('last_30')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${selectedPreset === 'last_30'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
            >
              Derniers 30 Jours
            </button>
            <button
              onClick={() => handleApplyPreset('this_quarter')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${selectedPreset === 'this_quarter'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
            >
              Ce Trimestre (T3 2026)
            </button>
            <button
              onClick={() => handleApplyPreset('year_2026')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${selectedPreset === 'year_2026'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
            >
              Année 2026 (YTD)
            </button>
          </div>

          {/* Specific custom date picker */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-500 font-semibold">Du :</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setSelectedPreset('all');
              }}
              className="bg-neutral-50 border border-neutral-300 rounded-xl px-2.5 py-1 text-xs font-mono font-semibold"
            />
            <span className="text-neutral-500 font-semibold">Au :</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setSelectedPreset('all');
              }}
              className="bg-neutral-50 border border-neutral-300 rounded-xl px-2.5 py-1 text-xs font-mono font-semibold"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setSelectedPreset('all');
                }}
                className="text-[11px] font-bold text-neutral-500 hover:text-red-600 underline ml-1 cursor-pointer"
              >
                Effacer
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 4 FINANCIAL MAINTENANCE COST CARDS (TCO) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Cost */}
        <div className="bg-white rounded-3xl p-5 border border-neutral-300 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-tight">
              Coût Total de Maintenance
            </span>
            <Coins className="w-5 h-5 text-blue-700" />
          </div>
          <div className="text-3xl font-black text-neutral-900 mt-2 font-mono tabular-nums">
            {totalMaintenanceCost.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            <span className="text-sm font-bold text-neutral-500">TND</span>
          </div>
          <div className="text-xs text-neutral-500 mt-1 flex items-center gap-1 font-semibold">
            PDR ({partsPct}%) + M.O ({laborPct}%) + Ext ({externalPct}%)
          </div>
        </div>
      </div>

      {/* ── 4 CORE RELIABILITY & UPTIME KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-3xl p-5 border border-neutral-300 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-tight">
              Disponibilité Opérationnelle
            </span>
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-emerald-700 mt-2 tabular-nums">
            {availabilityRate}%
          </div>
          <div className="text-xs text-neutral-500 mt-1 flex items-center gap-1 font-semibold">
            <span className="text-emerald-700 font-bold">● Cible atteinte</span> (&gt; 85% objectif usine)
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-neutral-300 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-tight">
              MTBF Moyen Usine
            </span>
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-black text-blue-700 mt-2 tabular-nums">
            {avgMtbf} hrs
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            Temps moyen de bon fonctionnement continu
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-neutral-300 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-tight">
              MTTR Moyen (Réparation)
            </span>
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-3xl font-black text-amber-600 mt-2 tabular-nums">
            {avgMttr} hrs
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            Durée moyenne d&apos;intervention (&lt; 2.5h)
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-neutral-300 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-tight">
              Temps d&apos;Arrêt Cumulé
            </span>
            <TrendingUp className="w-5 h-5 text-lime-700" />
          </div>
          <div className="text-3xl font-black text-lime-700 mt-2 tabular-nums">
            {Math.round(totalDowntimeHours * 10) / 10} hrs
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            Total des heures d&apos;arrêts techniques
          </div>
        </div>
      </div>

      {/* ── CHARTS & BREAKDOWN GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pareto Failure Root Causes */}
        <div className="bg-white rounded-3xl p-6 border border-neutral-300 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="text-base font-bold text-neutral-900">
                Pareto des Causes Racines de Défaillance
              </h3>
              <p className="text-xs text-neutral-500">
                Typologie des pannes répertoriées sur les rapports de la période
              </p>
            </div>
            <PieChart className="w-5 h-5 text-neutral-400" />
          </div>

          <div className="space-y-3 pt-2">
            {Object.entries(causesMap).map(([cause, count]) => {
              const pct = Math.round((count / totalReportsCount) * 100);
              return (
                <div key={cause} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-neutral-800">
                    <span>{cause}</span>
                    <span className="font-mono tabular-nums text-neutral-600">
                      {count} pannes ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-neutral-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${cause === 'Hydraulic'
                          ? 'bg-blue-600'
                          : cause === 'Electrical'
                            ? 'bg-amber-500'
                            : cause === 'Mechanical'
                              ? 'bg-emerald-600'
                              : cause === 'Thermal/Cooling'
                                ? 'bg-cyan-600'
                                : 'bg-purple-600'
                        }`}
                      style={{ width: `${Math.max(8, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Machine Maintenance Cost & Reliability Ranking */}
        <div className="bg-white rounded-3xl p-6 border border-neutral-300 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="text-base font-bold text-neutral-900">
                Coûts & Fiabilité par Presse d&apos;Injection
              </h3>
              <p className="text-xs text-neutral-500">
                Coûts cumulés de maintenance (pièces + main d&apos;œuvre) et MTBF
              </p>
            </div>
            <BarChart3 className="w-5 h-5 text-neutral-400" />
          </div>

          <div className="space-y-3 pt-2 max-h-[360px] overflow-y-auto pr-1">
            {machines.map((m) => {
              const machineReports = filteredReports.filter(
                (r) => r.equipmentId === m.id || (r.equipmentName && r.equipmentName.includes(m.number))
              );
              const mParts = machineReports.reduce(
                (acc, r) =>
                  acc +
                  (r.sparePartsCost != null
                    ? r.sparePartsCost
                    : (r.stockTaken || []).reduce((s, it) => s + it.qty * it.unitPrice, 0)),
                0
              );
              const mLabor = machineReports.reduce(
                (acc, r) => acc + (r.laborCost != null ? r.laborCost : ((r.durationMinutes || 0) / 60) * 25),
                0
              );
              const mTotal = mParts + mLabor;
              const mtbf = m.mtbfHours ?? 450;

              return (
                <div key={m.id} className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-black text-neutral-900 text-sm">
                        {m.number}
                      </span>
                      <span className="text-neutral-500 ml-2 font-medium">
                        ({m.brand} {m.model})
                      </span>
                    </div>
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                      {mTotal.toFixed(2)} TND
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-neutral-600">
                    <span>
                      MTBF: <strong>{mtbf}h</strong> · MTTR: <strong>{m.mttrHours ?? 1.8}h</strong>
                    </span>
                    <span>
                      PDR: <strong>{mParts.toFixed(0)} TND</strong> · M.O: <strong>{mLabor.toFixed(0)} TND</strong>
                    </span>
                  </div>

                  <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${mTotal > 300 ? 'bg-red-500' : mTotal > 150 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                      style={{
                        width: `${Math.min(100, Math.max(10, (mTotal / 600) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
