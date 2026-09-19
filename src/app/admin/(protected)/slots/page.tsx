'use client';

import { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  Truck,
  Check,
  AlertCircle,
  Plus,
  Minus,
  Ban,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronRight,
} from 'lucide-react';
import AdminNav from '@/components/admin/AdminNav';
import MStripe from '@/components/ui/MStripe';
import { localStore, MOCK_FITTERS } from '@/lib/mockData';
import { isMockDataEnabled } from '@/lib/mock-mode';
import AdminDataPending from '@/components/admin/AdminDataPending';
import { formatSlotTime } from '@/lib/utils';
import type { SlotWithAvailability } from '@/types';

const TIME_WINDOWS = [
  { start: '09:00', end: '11:00', label: '09:00 – 11:00 (Morning 1)' },
  { start: '11:00', end: '13:00', label: '11:00 – 13:00 (Midday)' },
  { start: '13:00', end: '15:00', label: '13:00 – 15:00 (Afternoon 1)' },
  { start: '15:00', end: '17:00', label: '15:00 – 17:00 (Afternoon 2)' },
];

const DAYS_OF_WEEK = [
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
  { id: 0, label: 'Sun' },
];

export default function AdminSlotsPage() {
  const mockMode = isMockDataEnabled();
  const [slots, setSlots] = useState<SlotWithAvailability[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showGenerator, setShowGenerator] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Generator form state
  const [genWeeks, setGenWeeks] = useState(8);
  const [genCapacity, setGenCapacity] = useState(2);
  const [genDays, setGenDays] = useState<number[]>([1, 2, 3, 4, 5, 6]); // Mon-Sat
  const [genWindows, setGenWindows] = useState<string[]>(['09:00', '11:00', '13:00', '15:00']);
  const [isGenerating, setIsGenerating] = useState(false);

  // Block date reason
  const [blockReason, setBlockReason] = useState('Staff unavailable');

  async function reloadSlots() {
    try {
      const res = await fetch('/api/slots');
      const json = await res.json();
      if (json.ok && json.data && json.data.length > 0) {
        setSlots(json.data);
        if (!selectedDate) {
          setSelectedDate(json.data[0].slot_date);
        }
      } else {
        const all = localStore.getSlots();
        setSlots(all);
        if (!selectedDate && all.length > 0) {
          setSelectedDate(all[0].slot_date);
        }
      }
    } catch {
      const all = localStore.getSlots();
      setSlots(all);
      if (!selectedDate && all.length > 0) {
        setSelectedDate(all[0].slot_date);
      }
    }
  }

  useEffect(() => {
    reloadSlots();
  }, []);

  const dates = Array.from(new Set(slots.map((s) => s.slot_date))).slice(0, 21);
  const slotsForDate = slots.filter((s) => s.slot_date === selectedDate);
  const isDateAllBlocked = slotsForDate.length > 0 && slotsForDate.every((s) => !s.active);

  async function handleCapacityChange(slotId: string, delta: number) {
    const s = slots.find((item) => item.id === slotId);
    if (!s) return;
    const newCap = Math.max(1, s.max_bookings + delta);

    await fetch('/api/admin/slots/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_capacity', slotId, capacity: newCap }),
    });

    s.max_bookings = newCap;
    reloadSlots();
  }

  async function handleToggleSlot(slotId: string) {
    await fetch('/api/admin/slots/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_active', slotId }),
    });
    reloadSlots();
  }

  async function handleBlockDay() {
    await fetch('/api/admin/slots/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'block_date', date: selectedDate, reason: blockReason }),
    });
    setFeedback(`Blocked entire day (${selectedDate}) due to: ${blockReason}`);
    reloadSlots();
  }

  async function handleUnblockDay() {
    await fetch('/api/admin/slots/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unblock_date', date: selectedDate }),
    });
    setFeedback(`Re-opened all appointments for ${selectedDate}`);
    reloadSlots();
  }

  async function handleGenerateSlots(e: React.FormEvent) {
    e.preventDefault();
    setIsGenerating(true);
    setFeedback(null);

    try {
      const selectedTW = TIME_WINDOWS.filter((tw) => genWindows.includes(tw.start));
      const res = await fetch('/api/admin/slots/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: selectedDate || new Date().toISOString().split('T')[0],
          weeks: genWeeks,
          days: genDays,
          timeWindows: selectedTW,
          capacity: genCapacity,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setFeedback(data.data.message);
        setShowGenerator(false);
        reloadSlots();
      }
    } catch (err) {
      setFeedback('Error generating recurring slots.');
    } finally {
      setIsGenerating(false);
    }
  }

  function toggleGenDay(dayId: number) {
    setGenDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]
    );
  }

  function toggleGenWindow(start: string) {
    setGenWindows((prev) =>
      prev.includes(start) ? prev.filter((w) => w !== start) : [...prev, start]
    );
  }

  return (
    <div className="container-g section">
      <MStripe className="mb-6" />
      <AdminNav />

      {/* Header & Fleet Capacity */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="display-2 leading-none">SLOT SCHEDULE &amp; CAPACITY</h1>
          <p className="text-xs text-ink-3 mt-1">
            Development controls for recurring slots, van capacity, and blocked dates
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowGenerator(!showGenerator)}
            className="btn btn-primary btn-sm flex items-center gap-1.5"
          >
            <Layers size={15} /> Create Recurring Slots &rarr;
          </button>
        </div>
      </div>

      {feedback && (
        <div className="mb-6 p-3 bg-brand/10 border border-brand/30 rounded text-xs text-ink-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check size={16} className="text-brand shrink-0" />
            <span>{feedback}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="text-ink-3 hover:text-ink-1">
            ✕
          </button>
        </div>
      )}

      {/* RECURRING SLOTS GENERATOR PANEL */}
      {showGenerator && (
        <div className="card mb-8 border-border-brand/40 bg-surface-2 shadow-2xl space-y-5 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-brand" />
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Automated Recurring Slot Generator
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowGenerator(false)}
              className="text-xs text-ink-3 hover:text-ink-1 font-bold"
            >
              ✕ Close
            </button>
          </div>

          <form onSubmit={handleGenerateSlots} className="space-y-4 text-xs">
            {/* Days of Week */}
            <div>
              <label className="label mb-2 block">Days of the Week</label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((d) => {
                  const isChecked = genDays.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleGenDay(d.id)}
                      className={`px-3 py-2 rounded font-bold uppercase transition-colors ${
                        isChecked
                          ? 'bg-brand text-ink-inverse shadow-sm'
                          : 'bg-surface-3 text-ink-3 hover:text-ink-1 border border-line'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Windows */}
            <div>
              <label className="label mb-2 block">Daily 2-Hour Fitting Windows</label>
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-2">
                {TIME_WINDOWS.map((tw) => {
                  const isChecked = genWindows.includes(tw.start);
                  return (
                    <button
                      key={tw.start}
                      type="button"
                      onClick={() => toggleGenWindow(tw.start)}
                      className={`p-2.5 rounded border text-left transition-colors ${
                        isChecked
                          ? 'bg-brand/10 border-brand text-ink-1 font-bold'
                          : 'bg-surface-3 border-line text-ink-3'
                      }`}
                    >
                      <div className="text-xs">{tw.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Duration & Capacity */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label mb-1.5 block">Generate For Next</label>
                <select
                  className="input"
                  value={genWeeks}
                  onChange={(e) => setGenWeeks(Number(e.target.value))}
                >
                  <option value={2}>2 Weeks Ahead</option>
                  <option value={4}>4 Weeks Ahead</option>
                  <option value={8}>8 Weeks Ahead (Recommended)</option>
                  <option value={12}>12 Weeks Ahead</option>
                </select>
              </div>

              <div>
                <label className="label mb-1.5 block">Default Van Capacity per Window</label>
                <select
                  className="input"
                  value={genCapacity}
                  onChange={(e) => setGenCapacity(Number(e.target.value))}
                >
                  <option value={1}>1 Van / Booking per Window</option>
                  <option value={2}>2 Vans / Bookings per Window (Standard)</option>
                  <option value={3}>3 Vans / Bookings per Window (High Volume)</option>
                  <option value={4}>4 Vans / Bookings per Window</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-line flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowGenerator(false)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isGenerating || genDays.length === 0 || genWindows.length === 0}
                className="btn btn-primary btn-sm flex items-center gap-1.5"
              >
                {isGenerating ? 'Generating...' : '⚡ Generate & Insert All Slots'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Date Selector */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <label className="label block flex items-center gap-2">
            <Calendar size={14} className="text-brand" /> Select Date Schedule
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {dates.map((d) => {
            const isSelected = selectedDate === d;
            const dateObj = new Date(d);
            const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'short' });
            const dayNum = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

            const daySlots = slots.filter((s) => s.slot_date === d);
            const isBlocked = daySlots.length > 0 && daySlots.every((s) => !s.active);

            return (
              <button
                key={d}
                onClick={() => setSelectedDate(d)}
                className={`py-2 px-3.5 rounded border text-center transition-all ${
                  isSelected
                    ? 'bg-brand text-ink-inverse border-brand font-bold shadow-md'
                    : isBlocked
                    ? 'bg-surface-3/40 border-danger/40 text-ink-3 opacity-60'
                    : 'bg-surface-3 border-line text-ink-2 hover:border-border-2 hover:text-ink-1'
                }`}
              >
                <div className="text-[10px] uppercase font-semibold">{dayName}</div>
                <div className="text-xs font-bold">{dayNum}</div>
                {isBlocked && <span className="text-[9px] text-danger block font-bold">BLOCKED</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Daily Schedule Operations Card */}
      <div className="card space-y-6 border-line">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <h3 className="text-base font-bold uppercase tracking-wider">
              {new Date(selectedDate || Date.now()).toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </h3>
            <span className="text-xs text-ink-3">
              {isDateAllBlocked ? 'This day is currently completely blocked from customer booking.' : 'Active customer booking slots'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isDateAllBlocked ? (
              <button
                type="button"
                onClick={handleUnblockDay}
                className="btn btn-secondary btn-sm text-xs flex items-center gap-1.5 text-ok border-ok/30"
              >
                <RotateCcw size={14} /> Re-Open Entire Day
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  className="input text-xs py-1 px-2 h-8"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                >
                  <option value="Staff unavailable">Staff unavailable</option>
                  <option value="Van maintenance">Van maintenance</option>
                  <option value="Holiday / Bank Holiday">Holiday / Bank Holiday</option>
                  <option value="Fully booked manually">Fully booked manually</option>
                </select>
                <button
                  type="button"
                  onClick={handleBlockDay}
                  className="btn btn-danger btn-sm text-xs flex items-center gap-1.5"
                >
                  <Ban size={14} /> Block Entire Day
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Windows Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {slotsForDate.map((s) => {
            const isFull = s.remaining === 0;

            return (
              <div
                key={s.id}
                className={`p-4 rounded border transition-all ${
                  !s.active
                    ? 'bg-surface-3/30 border-danger/30 opacity-70'
                    : isFull
                    ? 'bg-surface-3 border-danger/30'
                    : 'bg-surface-3 border-line'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-ink-1">
                    <Clock size={16} className="text-brand" />
                    {formatSlotTime(s.start_time)} – {formatSlotTime(s.end_time)}
                  </div>
                  <span
                    className={`badge badge-${s.active ? (isFull ? 'danger' : 'success') : 'danger'}`}
                  >
                    {!s.active ? 'BLOCKED' : isFull ? 'FULL' : 'ACTIVE'}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  {/* Capacity Editor */}
                  <div className="flex items-center justify-between text-ink-2 bg-surface-2 p-2 rounded border border-line">
                    <span>Van Capacity:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCapacityChange(s.id, -1)}
                        className="btn btn-secondary btn-sm h-6 w-6 p-0 flex items-center justify-center text-xs"
                      >
                        <Minus size={11} />
                      </button>
                      <strong className="text-ink-1 mono font-bold w-4 text-center">{s.max_bookings}</strong>
                      <button
                        type="button"
                        onClick={() => handleCapacityChange(s.id, 1)}
                        className="btn btn-secondary btn-sm h-6 w-6 p-0 flex items-center justify-center text-xs"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <span>Availability:</span>
                    <strong className={`mono ${s.remaining === 0 ? 'text-danger' : 'text-ok'}`}>
                      {s.remaining} remaining
                    </strong>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-line/60">
                  <button
                    type="button"
                    onClick={() => handleToggleSlot(s.id)}
                    className={`btn btn-sm w-full text-[11px] py-1 h-8 ${
                      s.active ? 'btn-secondary text-danger hover:bg-danger/10' : 'btn-primary'
                    }`}
                  >
                    {s.active ? 'Block This Slot' : 'Unblock Slot'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
