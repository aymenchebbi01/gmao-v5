import React from 'react';
import { ThermoplasticsLogo } from '../components/ThermoplasticsLogo';
import { PieChartComponent, PieSlice } from '../components/PieChartComponent';
import {
  InterventionRequest,
  MaintenanceOrder,
  Machine,
  Mold,
  StockItem,
} from '../types/gmao';
import {
  ArrowUpRight,
  Wrench,
  Clock,
  AlertTriangle,
  AlertCircle,
  Boxes,
  TrendingDown,
  CheckCircle2,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ViewKey } from '../components/Sidebar';

interface DashboardViewProps {
  requests: InterventionRequest[];
  orders: MaintenanceOrder[];
  machines: Machine[];
  molds: Mold[];
  stock?: StockItem[];
  onNavigate: (view: ViewKey) => void;
  onOpenReportModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  requests,
  orders,
  machines,
  molds,
  stock = [],
  onNavigate,
}) => {
  // 1. Intervention Requests Pie Data
  const waitingRequests = requests.filter((r) => r.status === 'Waiting').length;
  const validatedRequests = requests.filter((r) => r.status === 'Validated').length;
  const rejectedRequests = requests.filter((r) => r.status === 'Rejected').length;
  const inProgressRequests = requests.filter((r) => r.status === 'In Progress').length;

  const requestPieData: PieSlice[] = [
    { label: 'Validated', value: validatedRequests, color: '#10b981' }, // emerald
    { label: 'Waiting', value: waitingRequests, color: '#f59e0b' }, // amber
    { label: 'In Progress', value: inProgressRequests, color: '#3b82f6' }, // blue
    { label: 'Rejected', value: rejectedRequests, color: '#ef4444' }, // red
  ].filter((s) => s.value > 0 || requests.length === 0);

  // 2. Maintenance Orders Pie Data
  const completedOrders = orders.filter((o) => o.status === 'Completed' || o.status === 'Validated').length;
  const inProgressOrders = orders.filter((o) => o.status === 'In Progress').length;
  const waitingOrders = orders.filter((o) => o.status === 'Waiting').length;
  const rejectedOrders = orders.filter((o) => o.status === 'Rejected').length;

  const orderPieData: PieSlice[] = [
    { label: 'Completed', value: completedOrders, color: '#10b981' },
    { label: 'In Progress', value: inProgressOrders, color: '#3b82f6' },
    { label: 'Waiting', value: waitingOrders, color: '#f59e0b' },
    { label: 'Rejected', value: rejectedOrders, color: '#ef4444' },
  ].filter((s) => s.value > 0 || orders.length === 0);

  // 3. Machine Status Pie Data
  const runningMachines = machines.filter((m) => m.status === 'Running').length;
  const maintenanceMachines = machines.filter((m) => m.status === 'Under Maintenance').length;
  const stoppedMachines = machines.filter((m) => m.status === 'Stopped').length;
  const setupMachines = machines.filter((m) => m.status === 'Setup').length;

  const machinePieData: PieSlice[] = [
    { label: 'Running', value: runningMachines, color: '#10b981' },
    { label: 'Under Maintenance', value: maintenanceMachines, color: '#f59e0b' },
    { label: 'Stopped', value: stoppedMachines, color: '#ef4444' },
    { label: 'Setup / Tool Change', value: setupMachines, color: '#3b82f6' },
  ].filter((s) => s.value > 0 || machines.length === 0);

  // 4. Mold Status Pie Data
  const moldsInProd = molds.filter((m) => m.status === 'In Production').length;
  const moldsInToolroom = molds.filter((m) => m.status === 'In Toolroom').length;
  const moldsReady = molds.filter((m) => m.status === 'Ready in Rack').length;
  const moldsRepair = molds.filter((m) => m.status === 'Requires Repair').length;

  const moldPieData: PieSlice[] = [
    { label: 'In Production', value: moldsInProd, color: '#84cc16' }, // lime
    { label: 'Ready in Rack', value: moldsReady, color: '#3b82f6' }, // blue
    { label: 'In Toolroom', value: moldsInToolroom, color: '#f59e0b' }, // amber
    { label: 'Requires Repair', value: moldsRepair, color: '#ef4444' }, // red
  ].filter((s) => s.value > 0 || molds.length === 0);

  // --- Executive Visual Summary Card 1: Machines Currently In Maintenance ---
  const machinesInMaintList = machines.filter(
    (m) => m.status === 'Under Maintenance' || m.status === 'Stopped'
  );
  const fleetAvailabilityPercent = machines.length > 0
    ? Math.round(((runningMachines + setupMachines) / machines.length) * 100)
    : 100;

  const maintBreakdownPie: PieSlice[] = [
    { label: 'Under Maint.', value: maintenanceMachines, color: '#f59e0b' },
    { label: 'Stopped', value: stoppedMachines, color: '#ef4444' },
    { label: 'Operational', value: runningMachines + setupMachines, color: '#10b981' },
  ].filter((s) => s.value > 0);

  // --- Executive Visual Summary Card 2: Pending Intervention Requests ---
  const pendingRequestsList = requests.filter((r) => r.status === 'Waiting');
  const pendingUrgentCount = pendingRequestsList.filter((r) => r.priority === 'Urgent').length;
  const pendingHighCount = pendingRequestsList.filter((r) => r.priority === 'High').length;
  const pendingNormalCount = pendingRequestsList.filter(
    (r) => r.priority !== 'Urgent' && r.priority !== 'High'
  ).length;

  const pendingPriorityPie: PieSlice[] = [
    { label: 'Urgent', value: pendingUrgentCount, color: '#ef4444' },
    { label: 'High', value: pendingHighCount, color: '#f59e0b' },
    { label: 'Normal/Medium', value: pendingNormalCount, color: '#3b82f6' },
  ].filter((s) => s.value > 0 || pendingRequestsList.length === 0);

  // --- Executive Visual Summary Card 3: Low Stock Alerts ---
  const spareStock = stock;
  const outOfStockItems = spareStock.filter((s) => s.currentQty === 0);
  const belowMinItems = spareStock.filter((s) => s.currentQty > 0 && s.currentQty <= s.minQty);
  const healthyItems = spareStock.filter((s) => s.currentQty > s.minQty);
  const totalLowStockAlerts = outOfStockItems.length + belowMinItems.length;
  const stockHealthRate = spareStock.length > 0
    ? Math.round((healthyItems.length / spareStock.length) * 100)
    : 100;

  const stockHealthPie: PieSlice[] = [
    { label: 'Out of Stock (0)', value: outOfStockItems.length, color: '#ef4444' },
    { label: 'Below Min Qty', value: belowMinItems.length, color: '#f59e0b' },
    { label: 'Optimal Stock', value: healthyItems.length, color: '#10b981' },
  ].filter((s) => s.value > 0 || spareStock.length === 0);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* ========================================================================= */}
      {/* BRAND & PLANT IDENTITY: Thermoplastics Card (Top Left above the 3 cards) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-neutral-300 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <ThermoplasticsLogo size="lg" />
        </div>

        <div className="mt-5 pt-4 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
          <span>Facility: <strong className="text-neutral-800">Zone Industrielle Zaghouane 1100, Tunisia</strong></span>
          <div className="flex items-center gap-3">
            <span>System: <strong className="text-neutral-800 font-mono">GMAO TPM v1.0 Pro</strong></span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* EXECUTIVE MANAGEMENT SUMMARY CARDS (With Dedicated Interactive Charts)    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CARD 1: Machines Currently In Maintenance */}
        <div className="bg-white rounded-3xl p-6 border border-neutral-300 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-neutral-900 tracking-tight">
                    Machines In Maintenance
                  </h3>
                </div>
              </div>

            </div>

            {/* Visual Stacked Availability Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-600 mb-1">
                <span>Fleet Availability Ratio</span>
                <span className="font-mono font-bold text-emerald-700">{runningMachines + setupMachines} / {machines.length} Active</span>
              </div>
              <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden flex">
                <div style={{ width: `${(runningMachines / (machines.length || 1)) * 100}%` }} className="bg-emerald-500 h-full" title="Running" />
                <div style={{ width: `${(setupMachines / (machines.length || 1)) * 100}%` }} className="bg-blue-500 h-full" title="Setup" />
                <div style={{ width: `${(maintenanceMachines / (machines.length || 1)) * 100}%` }} className="bg-amber-500 h-full" title="Under Maintenance" />
                <div style={{ width: `${(stoppedMachines / (machines.length || 1)) * 100}%` }} className="bg-red-500 h-full" title="Stopped" />
              </div>
            </div>

            {/* Visual Donut Chart */}
            <div className="py-3 flex items-center justify-center">
              <PieChartComponent
                data={maintBreakdownPie}
                size={135}
                donut={true}
                innerRadiusRatio={0.65}
                centerLabel="Fleet Down"
                centerValue={`${machinesInMaintList.length}/${machines.length}`}
                showLegend={false}
              />
            </div>

            {/* Legend & Stats */}
            <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] p-2 bg-neutral-50 rounded-xl border border-neutral-200">
              <div>
                <span className="text-neutral-500 block">Maintenance</span>
                <span className="font-bold text-amber-700 font-mono">{maintenanceMachines}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Stopped</span>
                <span className="font-bold text-red-600 font-mono">{stoppedMachines}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Operating</span>
                <span className="font-bold text-emerald-700 font-mono">{runningMachines}</span>
              </div>
            </div>

            {/* Mini List of Affected Machines */}
            <div className="mt-3 space-y-1.5 max-h-28 overflow-y-auto pr-1">
              {machinesInMaintList.slice(0, 3).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-amber-50/60 border border-amber-200/70 text-xs"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-neutral-900">{m.number}</span>
                    <span className="text-neutral-500 truncate max-w-[120px]">({m.model})</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900">
                    {m.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CARD 2: Pending Intervention Requests */}
        <div className="bg-white rounded-3xl p-6 border border-neutral-300 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-neutral-900 tracking-tight">
                    Intervention Requests
                  </h3>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-black ${waitingRequests > 0
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
                  }`}
              >
                {waitingRequests} Tickets
              </span>
            </div>

            {/* Visual Priority Split Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-600 mb-1">
                <span>Priority Distribution</span>
                <span className="font-mono font-bold text-red-600">{pendingUrgentCount} Urgent</span>
              </div>
              <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden flex">
                <div style={{ width: `${(pendingUrgentCount / (waitingRequests || 1)) * 100}%` }} className="bg-red-500 h-full" title="Urgent" />
                <div style={{ width: `${(pendingHighCount / (waitingRequests || 1)) * 100}%` }} className="bg-amber-500 h-full" title="High" />
                <div style={{ width: `${(pendingNormalCount / (waitingRequests || 1)) * 100}%` }} className="bg-blue-500 h-full" title="Normal" />
              </div>
            </div>

            {/* Visual Donut Chart */}
            <div className="py-3 flex items-center justify-center">
              <PieChartComponent
                data={pendingPriorityPie}
                size={135}
                donut={true}
                innerRadiusRatio={0.65}
                centerLabel="Pending"
                centerValue={waitingRequests}
                showLegend={false}
              />
            </div>

            {/* Legend & Stats */}
            <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] p-2 bg-neutral-50 rounded-xl border border-neutral-200">
              <div>
                <span className="text-neutral-500 block">Urgent</span>
                <span className="font-bold text-red-600 font-mono">{pendingUrgentCount}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">High</span>
                <span className="font-bold text-amber-600 font-mono">{pendingHighCount}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Normal</span>
                <span className="font-bold text-blue-600 font-mono">{pendingNormalCount}</span>
              </div>
            </div>

            {/* Mini List of Pending Tickets */}
            <div className="mt-3 space-y-1.5 max-h-28 overflow-y-auto pr-1">
              {pendingRequestsList.slice(0, 3).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 border border-neutral-200 text-xs"
                >
                  <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                    <span className="font-mono font-bold text-blue-700">{r.refIR}</span>
                    <span className="text-neutral-600 truncate">{r.problemDescription}</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${r.priority === 'Urgent'
                      ? 'bg-red-100 text-red-800'
                      : r.priority === 'High'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-blue-100 text-blue-800'
                      }`}
                  >
                    {r.priority || 'Normal'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CARD 3: Low Stock Alerts */}
        <div className="bg-white rounded-3xl p-6 border border-neutral-300 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-neutral-900 tracking-tight">
                    Low Stock Alerts
                  </h3>
                </div>
              </div>
            </div>

            {/* Visual Stock Health Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-600 mb-1">
                <span>Catalogue Health Index</span>
                <span className="font-mono font-bold text-emerald-700">{stockHealthRate}% In Stock</span>
              </div>
              <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden flex">
                <div style={{ width: `${(healthyItems.length / (spareStock.length || 1)) * 100}%` }} className="bg-emerald-500 h-full" title="Healthy" />
                <div style={{ width: `${(belowMinItems.length / (spareStock.length || 1)) * 100}%` }} className="bg-amber-500 h-full" title="Below Min" />
                <div style={{ width: `${(outOfStockItems.length / (spareStock.length || 1)) * 100}%` }} className="bg-red-500 h-full" title="Out of Stock" />
              </div>
            </div>

            {/* Visual Donut Chart */}
            <div className="py-3 flex items-center justify-center">
              <PieChartComponent
                data={stockHealthPie}
                size={135}
                donut={true}
                innerRadiusRatio={0.65}
                centerLabel="Low Stock"
                centerValue={totalLowStockAlerts}
                showLegend={false}
              />
            </div>

            {/* Legend & Stats */}
            <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] p-2 bg-neutral-50 rounded-xl border border-neutral-200">
              <div>
                <span className="text-neutral-500 block">Rupture (0)</span>
                <span className="font-bold text-red-600 font-mono">{outOfStockItems.length}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">&lt; Min Qty</span>
                <span className="font-bold text-amber-600 font-mono">{belowMinItems.length}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Healthy</span>
                <span className="font-bold text-emerald-700 font-mono">{healthyItems.length}</span>
              </div>
            </div>

            {/* Mini List of Critical Spare Parts */}
            <div className="mt-3 space-y-1.5 max-h-28 overflow-y-auto pr-1">
              {[...outOfStockItems, ...belowMinItems].slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-red-50/50 border border-red-200/70 text-xs"
                >
                  <div className="flex items-center gap-1.5 truncate max-w-[150px]">
                    <span className="font-mono font-bold text-neutral-900">{item.partNumber}</span>
                    <span className="text-neutral-600 truncate">{item.name}</span>
                  </div>
                  <span className="font-mono font-bold text-red-700 whitespace-nowrap">
                    {item.currentQty} / {item.minQty} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* OPERATIONAL DETAIL SECTION: 2-Column Grid matching GMAO Standard Layout    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Machine Status & Total Intervention Requests */}
        <div className="space-y-6">
          {/* Top-Left: Machine Status (Pie Chart) */}
          <div className="bg-white rounded-3xl p-7 border border-neutral-300/80 shadow-xs flex flex-col justify-between min-h-[340px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
                Machine Status
              </h2>
            </div>

            {/* Machine Status Pie Chart */}
            <div className="my-auto py-2">
              <PieChartComponent
                data={machinePieData}
                size={190}
                donut={true}
                centerLabel="Presses"
                centerValue={machines.length}
              />
            </div>
          </div>

          {/* Bottom-Left: Total Intervention Requests (Pie Chart) */}
          <div className="bg-white rounded-3xl p-7 border border-neutral-300/80 shadow-xs flex flex-col justify-between min-h-[280px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
                Total Intervention Requests
              </h2>
            </div>

            {/* Requests Pie Chart */}
            <div className="my-auto py-2">
              <PieChartComponent
                data={requestPieData}
                size={180}
                donut={true}
                centerLabel="Requests"
                centerValue={requests.length}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Total Maintenance Orders, Mold Status */}
        <div className="space-y-6">
          {/* Top-Right: Total Maintenance Orders (Pie Chart) */}
          <div className="bg-white rounded-3xl p-7 border border-neutral-300/80 shadow-xs flex flex-col justify-between min-h-[340px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
                Total Maintenance Orders
              </h2>
            </div>

            {/* Maintenance Orders Pie Chart */}
            <div className="my-auto py-2">
              <PieChartComponent
                data={orderPieData}
                size={180}
                donut={true}
                centerLabel="Orders"
                centerValue={orders.length}
              />
            </div>

          </div>

          {/* Bottom-Right: Mold Status (Pie Chart) */}
          <div className="bg-white rounded-3xl p-7 border border-neutral-300/80 shadow-xs flex flex-col justify-between min-h-[280px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
                Mold Status
              </h2>
            </div>

            {/* Mold Status Pie Chart */}
            <div className="my-auto py-2">
              <PieChartComponent
                data={moldPieData}
                size={180}
                donut={true}
                centerLabel="Molds"
                centerValue={molds.length}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

