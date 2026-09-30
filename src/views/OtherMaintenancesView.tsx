import React, { useState, useMemo } from 'react';
import { GmaoToolbar } from '../components/GmaoToolbar';
import { PaginationBar } from '../components/PaginationBar';
import { MaintenanceOrder, InterventionReport } from '../types/gmao';
import { Eye, FileEdit } from 'lucide-react';

interface OtherMaintenancesViewProps {
  orders: MaintenanceOrder[];
  reports: InterventionReport[];
  onOpenReportModalForOT: (order: MaintenanceOrder) => void;
  onOpenReportDetails: (report: InterventionReport) => void;
}

export const OtherMaintenancesView: React.FC<OtherMaintenancesViewProps> = ({
  orders,
  reports,
  onOpenReportModalForOT,
  onOpenReportDetails,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const otherOrders = useMemo(() => {
    return orders.filter((o) => o.category === 'Other');
  }, [orders]);

  const filteredItems = useMemo(() => {
    return otherOrders.filter((ord) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        ord.equipmentName.toLowerCase().includes(q) ||
        ord.refOT.toLowerCase().includes(q) ||
        ord.refIR.toLowerCase().includes(q) ||
        ord.assignedTo.toLowerCase().includes(q) ||
        ord.description.toLowerCase().includes(q);

      let matchDate = true;
      if (startDate && ord.date < startDate) matchDate = false;
      if (endDate && ord.date > endDate) matchDate = false;

      return matchSearch && matchDate;
    });
  }, [otherOrders, searchQuery, startDate, endDate]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const totalCount = otherOrders.length;
  const waitingCount = otherOrders.filter((o) => o.status === 'Waiting').length;
  const completedCount = otherOrders.filter((o) => o.status === 'Completed' || o.status === 'Validated').length;

  const statBoxes = [
    { label: 'Total Maintenance :', value: totalCount },
    { label: 'Waiting :', value: waitingCount, color: 'text-amber-600' },
    { label: 'Completed :', value: completedCount, color: 'text-emerald-700' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
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

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between min-h-[500px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50/60">
                <th className="py-4 px-5">Date</th>
                <th className="py-4 px-5">Facility Equipment / Utility</th>
                <th className="py-4 px-5">Ref OT</th>
                <th className="py-4 px-5">Ref IR</th>
                <th className="py-4 px-5">Intervention Report Ref</th>
                <th className="py-4 px-5">Priority</th>
                <th className="py-4 px-5">Filled By</th>
                <th className="py-4 px-5">Status</th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm font-medium text-neutral-800">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-500">
                    No auxiliary equipment maintenance orders recorded.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((ord) => {
                  const report = reports.find((r) => r.refOT === ord.refOT);
                  return (
                    <tr key={ord.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-xs tabular-nums text-neutral-700 whitespace-nowrap">
                        {ord.date}
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <div className="font-bold text-neutral-900">{ord.equipmentName}</div>
                        <div className="text-xs text-neutral-500">{ord.description}</div>
                      </td>
                      <td className="py-3.5 px-5 font-mono font-bold text-blue-700 whitespace-nowrap">
                        {ord.refOT}
                      </td>
                      <td className="py-3.5 px-5 font-mono font-semibold text-neutral-600 whitespace-nowrap">
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
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                            ord.priority === 'Urgent'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {ord.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-neutral-900 whitespace-nowrap">
                        {report?.filledBy || ord.assignedTo}
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            ord.status === 'Completed' || ord.status === 'Validated'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

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
