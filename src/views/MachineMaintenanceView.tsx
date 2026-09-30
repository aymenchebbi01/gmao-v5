import React, { useState, useMemo } from 'react';
import { GmaoToolbar } from '../components/GmaoToolbar';
import { PaginationBar } from '../components/PaginationBar';
import { MaintenanceOrder, InterventionReport, Machine } from '../types/gmao';
import { Eye, FileEdit, CheckCircle2, FileDown } from 'lucide-react';
import { downloadMiseADispositionPdf } from '../lib/miseADispositionPdf';

interface MachineMaintenanceViewProps {
  orders: MaintenanceOrder[];
  reports: InterventionReport[];
  machines: Machine[];
  onOpenReportModalForOT: (order: MaintenanceOrder) => void;
  onOpenReportDetails: (report: InterventionReport) => void;
}

export const MachineMaintenanceView: React.FC<MachineMaintenanceViewProps> = ({
  orders,
  reports,
  machines,
  onOpenReportModalForOT,
  onOpenReportDetails,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Filter only Machine category orders
  const machineOrders = useMemo(() => {
    return orders.filter((o) => o.category === 'Machine');
  }, [orders]);

  const filteredItems = useMemo(() => {
    return machineOrders.filter((ord) => {
      const machine = machines.find((m) => m.id === ord.equipmentId);
      const machineNum = machine ? machine.number : ord.equipmentName.slice(0, 6);
      const machineLoc = machine ? machine.locationNumber : 'LOC-01';

      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        machineNum.toLowerCase().includes(q) ||
        (machineLoc || '').toLowerCase().includes(q) ||
        ord.refOT.toLowerCase().includes(q) ||
        ord.refIR.toLowerCase().includes(q) ||
        ord.assignedTo.toLowerCase().includes(q) ||
        ord.status.toLowerCase().includes(q);

      let matchDate = true;
      if (startDate && ord.date < startDate) matchDate = false;
      if (endDate && ord.date > endDate) matchDate = false;

      return matchSearch && matchDate;
    });
  }, [machineOrders, machines, searchQuery, startDate, endDate]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Stat boxes matching screenshot: Total Maintenance, Waiting, Completed
  const totalMaintenance = machineOrders.length;
  const waitingCount = machineOrders.filter((o) => o.status === 'Waiting').length;
  const completedCount = machineOrders.filter((o) => o.status === 'Completed' || o.status === 'Validated').length;

  const statBoxes = [
    { label: 'Total Maintenance :', value: totalMaintenance },
    { label: 'Waiting :', value: waitingCount, color: 'text-amber-600' },
    { label: 'Completed :', value: completedCount, color: 'text-emerald-700' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Toolbar matching Machine Maintenance.png */}
      <GmaoToolbar
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={(d) => {
          setStartDate(d);
          setCurrentPage(1);
        }}
        onEndDateChange={(d) => {
          setEndDate(d);
          setCurrentPage(1);
        }}
        onClearDates={() => {
          setStartDate('');
          setEndDate('');
        }}
        statBoxes={statBoxes}
      />

      {/* Main Table Container matching MachinesView */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between min-h-[500px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50/60">
                <th className="py-4 px-4">Date</th>
                <th className="py-4 px-4">Machine Numbr</th>
                <th className="py-4 px-4">Machine Loc Numbr</th>
                <th className="py-4 px-4">Ref OT</th>
                <th className="py-4 px-4">Ref IR</th>
                <th className="py-4 px-5">Intervention Report Ref</th>
                <th className="py-4 px-4">Priority</th>
                <th className="py-4 px-5">Filled By</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm font-medium text-neutral-800">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-neutral-500">
                    No machine maintenance records found.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((ord) => {
                  const machine = machines.find((m) => m.id === ord.equipmentId);
                  const machineNum = machine ? machine.number : 'INJ-03';
                  const machineLoc = machine ? machine.locationNumber : 'LOC-A3';
                  const report = reports.find((r) => r.refOT === ord.refOT);

                  return (
                    <tr key={ord.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs tabular-nums text-neutral-700 whitespace-nowrap">
                        {ord.date}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-neutral-900 whitespace-nowrap">
                        {machineNum}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-neutral-700 whitespace-nowrap">
                        {machineLoc}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-700 whitespace-nowrap">
                        {ord.refOT}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-neutral-600 whitespace-nowrap">
                        {ord.refIR}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-xs whitespace-nowrap">
                        {report ? (
                          <span className="font-bold text-blue-800 bg-blue-100/70 px-2 py-0.5 rounded">
                            {report.refReport}
                          </span>
                        ) : (
                          <span className="text-neutral-400 italic">Pending</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                            ord.priority === 'Urgent'
                              ? 'bg-red-100 text-red-800'
                              : ord.priority === 'High'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {ord.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-neutral-900 whitespace-nowrap">
                        {report?.filledBy || ord.assignedTo.split(' ')[0]}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            ord.status === 'Completed' || ord.status === 'Validated'
                              ? 'bg-emerald-100 text-emerald-900'
                              : ord.status === 'Waiting'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-blue-100 text-blue-900'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {!!(ord.validationRespMaint?.validated && ord.validationRespProd?.validated && ord.validationQHSE?.validated) && (
                            <button
                              onClick={() => {
                                const targetMachine = machines.find(
                                  (m) => m.id === ord.equipmentId || m.id === ord.machineId || m.number === ord.machineNumber
                                );
                                downloadMiseADispositionPdf(ord, { machine: targetMachine });
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                              title="Télécharger la Fiche de Mise à Disposition (PDF)"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                              <span>MAD</span>
                            </button>
                          )}
                          {report ? (
                            <button
                              onClick={() => onOpenReportDetails(report)}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-neutral-100 text-neutral-900 rounded-lg text-xs font-bold border border-neutral-300 shadow-xs"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-600" />
                              <span>View</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => onOpenReportModalForOT(ord)}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs"
                            >
                              <FileEdit className="w-3.5 h-3.5" />
                              <span>Fill</span>
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

        {/* Bottom Pagination */}
        <PaginationBar
          totalItems={filteredItems.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
};
