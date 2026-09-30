import React from 'react';
import { ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationBarProps {
  totalItems: number;
  currentPage: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  totalItems,
  currentPage,
  pageSize = 8,
  onPageChange,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-neutral-300 text-xs font-bold text-neutral-800 bg-white/40 rounded-b-3xl">
      <div className="flex items-center gap-1">
        <span>Total Items :</span>
        <span className="font-mono tabular-nums text-neutral-900">{totalItems}</span>
      </div>

      <div className="flex items-center gap-1">
        <span>Page :</span>
        <span className="font-mono tabular-nums text-neutral-900">
          {currentPage} / {totalPages}
        </span>
      </div>

      <div className="flex items-center gap-1 text-neutral-900">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          className="p-1 hover:bg-black/10 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="First Page"
        >
          <ChevronsLeft className="w-5 h-5 fill-current" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="p-1 hover:bg-black/10 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Previous Page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="p-1 hover:bg-black/10 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Next Page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          className="p-1 hover:bg-black/10 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Last Page"
        >
          <ChevronsRight className="w-5 h-5 fill-current" />
        </button>
      </div>
    </div>
  );
};
