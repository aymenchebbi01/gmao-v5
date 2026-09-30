import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface TableFooterProps {
  totalItems: number;
  pageSize: number;
  currentPage: number;
  totalPages?: number;
  onPageSizeChange: (size: number) => void;
  onPageChange: (page: number) => void;
}

export const TableFooter: React.FC<TableFooterProps> = ({
  totalItems,
  pageSize,
  currentPage,
  totalPages: providedTotalPages,
  onPageSizeChange,
  onPageChange,
}) => {
  const totalPages = providedTotalPages ?? Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-100 bg-white text-xs font-semibold text-gray-500 gap-3">
      <div className="flex items-center gap-2">
        <span>Afficher</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-bold text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
        >
          <option value={8}>8</option>
          <option value={10}>10</option>
          <option value={13}>13</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
        <span>lignes par page · Total : <b className="text-gray-900">{totalItems}</b> éléments</span>
      </div>

      <div className="flex items-center gap-3">
        <span>
          Page <b className="text-gray-900">{currentPage}</b> sur <b className="text-gray-900">{totalPages}</b> ({startItem}-{endItem})
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Page précédente"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Page suivante"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TableFooter;
