import React, { useState } from 'react';
import { CalendarEvent } from '../types/gmao';
import { Calendar as CalendarIcon, CheckCircle2, Clock, Plus, ChevronLeft, ChevronRight, Wrench } from 'lucide-react';

interface CalendarViewProps {
  events: CalendarEvent[];
  onToggleEventComplete: (id: string) => void;
  onAddNewEvent: (event: CalendarEvent) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  onToggleEventComplete,
  onAddNewEvent,
}) => {
  const [currentMonth, setCurrentMonth] = useState('September 2026');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New event form state
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<CalendarEvent['type']>('Preventive');
  const [equipmentRef, setEquipmentRef] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    const newEv: CalendarEvent = {
      id: `cal-${Date.now()}`,
      title,
      date,
      type,
      equipmentRef,
      assignedTo,
      completed: false,
    };
    onAddNewEvent(newEv);
    setIsAddModalOpen(false);
    setTitle('');
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Banner & Month Selector */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white rounded-2xl p-5 border border-neutral-300 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
            Preventive Maintenance Schedule & Planned Plant Interventions
          </h2>
          <p className="text-xs text-neutral-500">
            Automated calendar for periodic lubrication, filter replacements, mold servicing, and calibrations
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-neutral-100 rounded-xl px-3 py-1.5 border border-neutral-200 text-xs font-bold">
            <button className="p-1 hover:bg-neutral-200 rounded">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono">{currentMonth}</span>
            <button className="p-1 hover:bg-neutral-200 rounded">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Task</span>
          </button>
        </div>
      </div>

      {/* Events List / Timeline Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {events.map((ev) => (
          <div
            key={ev.id}
            className={`rounded-3xl p-5 border shadow-xs flex flex-col justify-between transition-all ${
              ev.completed
                ? 'bg-neutral-100 border-neutral-300 opacity-75'
                : 'bg-white border-neutral-300 hover:shadow-md'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-neutral-500">
                  {ev.date}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    ev.type === 'Preventive'
                      ? 'bg-blue-100 text-blue-800'
                      : ev.type === 'Mold Overhaul'
                      ? 'bg-lime-100 text-lime-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {ev.type}
                </span>
              </div>

              <h4 className="text-sm font-bold text-neutral-900 mt-2 line-clamp-2">
                {ev.title}
              </h4>

              <div className="mt-4 pt-3 border-t border-neutral-100 space-y-1 text-xs text-neutral-600">
                <div className="flex justify-between">
                  <span>Target Equipment:</span>
                  <strong className="font-mono text-neutral-900">{ev.equipmentRef}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Assigned Technician:</span>
                  <strong className="text-neutral-900">{ev.assignedTo}</strong>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-neutral-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500">
                Status: {ev.completed ? 'Done' : 'Scheduled'}
              </span>
              <button
                onClick={() => onToggleEventComplete(ev.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  ev.completed
                    ? 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{ev.completed ? 'Mark Pending' : 'Mark Completed'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Task Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#ebeeed] text-neutral-900 w-full max-w-md rounded-2xl shadow-2xl border border-neutral-300 p-6 space-y-4">
            <h3 className="text-xl font-bold text-neutral-900">Schedule Preventive Maintenance</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hydraulic filter replacement & valve check"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white border border-neutral-300 rounded-xl px-3 py-2 text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-white border border-neutral-300 rounded-xl px-3 py-2 text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Task Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as CalendarEvent['type'])}
                    className="w-full bg-white border border-neutral-300 rounded-xl px-3 py-2 text-sm font-medium"
                  >
                    <option value="Preventive">Preventive</option>
                    <option value="Mold Overhaul">Mold Overhaul</option>
                    <option value="Oil Change">Oil Change</option>
                    <option value="Calibration">Calibration</option>
                    <option value="Shutdown">Shutdown</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Equipment Ref
                  </label>
                  <input
                    type="text"
                    required
                    value={equipmentRef}
                    onChange={(e) => setEquipmentRef(e.target.value)}
                    className="w-full bg-white border border-neutral-300 rounded-xl px-3 py-2 text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">
                    Technician
                  </label>
                  <input
                    type="text"
                    required
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full bg-white border border-neutral-300 rounded-xl px-3 py-2 text-sm font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-neutral-700 hover:bg-black/5 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
