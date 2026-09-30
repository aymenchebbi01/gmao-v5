import React from 'react';
import { Search, Calendar, X } from 'lucide-react';
import { MaintenanceCategory } from '../types/gmao';

interface StatBox {
  label: string;
  value: number | string;
  color?: string;
}

interface GmaoToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (date: string) => void;
  onEndDateChange?: (date: string) => void;
  onClearDates?: () => void;
  selectedCategory?: MaintenanceCategory | 'All';
  onCategoryChange?: (category: MaintenanceCategory | 'All') => void;
  showCategoryFilter?: boolean;
  statBoxes: StatBox[];
}

export const GmaoToolbar: React.FC<GmaoToolbarProps> = ({
  searchQuery,
  onSearchChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClearDates,
  selectedCategory,
  onCategoryChange,
  showCategoryFilter = false,
  statBoxes,
}) => {
  return (
    <div className="space-y-4">
      {/* Search & Date/Category Filters Row */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
        {/* Search Bar - rounded capsule matching screenshots */}
        <div className="relative w-full max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search"
            className="w-full pl-10 pr-9 py-2 bg-white rounded-xl text-sm font-medium border border-neutral-300/80 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs placeholder-neutral-400"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Right Filter Controls: Date and Category */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-neutral-800">
          {/* Date Filter */}
          <div className="flex items-center gap-3 bg-white/60 px-3 py-1.5 rounded-xl border border-neutral-300/60">
            <span className="font-bold">Filter by date :</span>
            <div className="flex items-center gap-1.5">
              <span>Start :</span>
              <div className="relative flex items-center">
                <input
                  type="date"
                  value={startDate || ''}
                  onChange={(e) => onStartDateChange?.(e.target.value)}
                  className="bg-white border border-neutral-300 rounded-md px-2 py-0.5 text-xs text-neutral-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span>End :</span>
              <div className="relative flex items-center">
                <input
                  type="date"
                  value={endDate || ''}
                  onChange={(e) => onEndDateChange?.(e.target.value)}
                  className="bg-white border border-neutral-300 rounded-md px-2 py-0.5 text-xs text-neutral-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                />
              </div>
            </div>
            {(startDate || endDate) && onClearDates && (
              <button
                onClick={onClearDates}
                className="text-neutral-500 hover:text-red-600 transition-colors p-0.5"
                title="Clear date filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter - Segmented buttons matching screenshots */}
          {showCategoryFilter && onCategoryChange && (
            <div className="flex items-center gap-2">
              <span className="font-bold">Filter by Category :</span>
              <div className="inline-flex rounded-xl bg-neutral-200/80 p-0.5 border border-neutral-300/60">
                {(['All', 'Machine', 'Mold', 'Other'] as const).map((cat) => {
                  const isActive = (selectedCategory || 'All') === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => onCategoryChange(cat)}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                        isActive
                          ? 'bg-white text-neutral-900 shadow-xs'
                          : 'text-neutral-600 hover:text-neutral-950'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stat Boxes Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {statBoxes.map((box, index) => (
          <div
            key={index}
            className="flex items-center justify-between px-4 py-3 bg-[#e8ecea] border border-neutral-400/50 rounded-xl shadow-xs"
          >
            <span className="text-xs font-bold text-neutral-800 tracking-tight">
              {box.label}
            </span>
            <span
              className={`text-base font-black tabular-nums ${
                box.color || 'text-neutral-900'
              }`}
            >
              {box.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
