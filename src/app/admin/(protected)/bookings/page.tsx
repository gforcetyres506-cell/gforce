'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Filter,
  Car,
  Clock,
  MapPin,
  Phone,
  User,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Truck,
  ExternalLink,
  Ban,
  RotateCcw,
  Check,
  Calendar,
} from 'lucide-react';
import AdminNav from '@/components/admin/AdminNav';
import MStripe from '@/components/ui/MStripe';
import { localStore, MOCK_FITTERS } from '@/lib/mockData';
import { isMockDataEnabled } from '@/lib/mock-mode';
import AdminDataPending from '@/components/admin/AdminDataPending';
import { formatPrice, formatSlotTime, formatReg } from '@/lib/utils';
import type { BookingWithDetails, BookingStatus } from '@/types';

export default function AdminBookingsPage() {
  const mockMode = isMockDataEnabled();
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [feedback, setFeedback] = useState<string | null>(null);

  async function reloadBookings() {
    try {
      const res = await fetch('/api/admin/bookings');
      const json = await res.json();
      if (json.ok && json.data) {
        setBookings(json.data);
      } else {
        setBookings(localStore.getAllBookings());
      }
    } catch {
      setBookings(localStore.getAllBookings());
    }
  }

  useEffect(() => {
    reloadBookings();
  }, []);

  async function handleUpdateStatus(id: string, newStatus: BookingStatus, fitterId?: string) {
    try {
      const res = await fetch('/api/admin/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus, fitterId }),
      });
      const json = await res.json();
      if (json.ok) {
        setFeedback(`Updated booking status to: ${newStatus.replace('_', ' ').toUpperCase()}`);
        reloadBookings();
      } else {
        setFeedback(json.message ?? 'Update failed');
      }
    } catch {
      localStore.updateBookingStatus(id, newStatus, fitterId);
      reloadBookings();
      setFeedback(`Updated booking status to: ${newStatus.replace('_', ' ').toUpperCase()}`);
    }
  }

  // Summary Metrics
  const totalCount = bookings.length;
  const confirmedCount = bookings.filter((b) => b.status === 'confirmed' || b.status === 'tyres_reserved' || b.status === 'fitter_assigned').length;
  const enRouteCount = bookings.filter((b) => b.status === 'en_route').length;
  const completedCount = bookings.filter((b) => b.status === 'completed').length;

  // Filter & Search
  const filteredBookings = bookings.filter((b) => {
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRef = b.booking_ref.toLowerCase().includes(q);
      const matchReg = b.vehicle_reg?.toLowerCase().includes(q);
      const matchName = b.customer?.name?.toLowerCase().includes(q);
      const matchEmail = b.customer?.email?.toLowerCase().includes(q);
      const matchPostcode = b.fitting_postcode?.toLowerCase().includes(q);
      return matchRef || matchReg || matchName || matchEmail || matchPostcode;
    }
    return true;
  });

  return (
    <div className="container-g section">
      <MStripe className="mb-6" />
      <AdminNav />

      {/* Header & Metrics Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="display-2 leading-none">TODAY&apos;S DISPATCH QUEUE</h1>
          <p className="text-xs text-ink-3 mt-1">Development workflow for technician dispatch and status transitions</p>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="card py-2 px-3 bg-surface-3/80 border-line">
            <div className="mono text-base font-bold text-ink-1">{totalCount}</div>
            <div className="text-[10px] uppercase text-ink-3 font-semibold">Total</div>
          </div>
          <div className="card py-2 px-3 bg-surface-3/80 border-line">
            <div className="mono text-base font-bold text-brand">{confirmedCount}</div>
            <div className="text-[10px] uppercase text-brand font-semibold">Ready</div>
          </div>
          <div className="card py-2 px-3 bg-surface-3/80 border-line">
            <div className="mono text-base font-bold text-warning">{enRouteCount}</div>
            <div className="text-[10px] uppercase text-warning font-semibold">En Route</div>
          </div>
          <div className="card py-2 px-3 bg-surface-3/80 border-line">
            <div className="mono text-base font-bold text-ok">{completedCount}</div>
            <div className="text-[10px] uppercase text-ok font-semibold">Done</div>
          </div>
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

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'all', label: `All (${bookings.length})` },
            { id: 'confirmed', label: 'Confirmed' },
            { id: 'tyres_reserved', label: 'Tyres Reserved' },
            { id: 'fitter_assigned', label: 'Fitter Assigned' },
            { id: 'en_route', label: 'En Route' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors ${
                filterStatus === tab.id
                  ? 'bg-brand text-ink-inverse shadow-sm'
                  : 'bg-surface-3 text-ink-2 hover:text-ink-1'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
          <input
            className="input pl-9 text-xs"
            placeholder="Search reg, ref, name, postcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Bookings Queue */}
      {filteredBookings.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-ink-3 text-sm">No bookings found in this view.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((b) => {
            const when = b.slot
              ? `${new Date(b.slot.slot_date).toLocaleDateString('en-GB', {
                  weekday: 'short', day: 'numeric', month: 'short',
                })}, ${formatSlotTime(b.slot.start_time)}–${formatSlotTime(b.slot.end_time)}`
              : 'Unassigned';

            const assignedFitter = MOCK_FITTERS.find((f) => f.id === b.fitter_id);

            return (
              <div
                key={b.id}
                className="card card-hover flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-5 border-line"
              >
                {/* Reference & Vehicle */}
                <div className="space-y-2 lg:min-w-[240px]">
                  <div className="flex items-center gap-2">
                    <span className="mono text-base font-bold text-brand">{b.booking_ref}</span>
                    <span className={`badge badge-${b.status === 'completed' ? 'success' : b.status === 'cancelled' || b.status === 'payment_failed' ? 'danger' : 'info'}`}>
                      {b.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm font-bold text-ink-1">
                    <Car size={16} className="text-brand shrink-0" />
                    <span>{formatReg(b.vehicle_reg || 'N/A')}</span>
                    <span className="text-ink-2 font-normal">
                      · {[b.vehicle_make, b.vehicle_model].filter(Boolean).join(' ')}
                    </span>
                  </div>

                  <div className="text-xs text-ink-3 flex items-center gap-1.5">
                    <Clock size={13} className="text-brand" /> {when}
                  </div>
                </div>

                {/* Customer & Fitting Address */}
                <div className="space-y-1 text-xs lg:min-w-[260px]">
                  <div className="font-semibold text-ink-1 flex items-center gap-1.5">
                    <User size={14} className="text-brand" /> {b.customer?.name || 'Customer'}
                  </div>
                  <div className="text-ink-2 flex items-center gap-1.5">
                    <Phone size={14} className="text-brand" /> {b.customer?.phone || 'N/A'} · {b.customer?.email}
                  </div>
                  <div className="text-ink-3 flex items-center gap-1.5">
                    <MapPin size={14} className="text-brand" /> {b.fitting_address}, {b.fitting_postcode}
                  </div>
                  {b.customer_notes && (
                    <div className="text-[11px] text-ink-2 italic bg-surface-2 p-1.5 rounded mt-1">
                      &ldquo;{b.customer_notes}&rdquo;
                    </div>
                  )}
                </div>

                {/* Ordered Items & Balance */}
                <div className="space-y-1 text-xs lg:text-right lg:min-w-[180px]">
                  <div className="font-bold text-ink-1">
                    {b.items.map((i) => `${i.quantity}× ${i.tyre_label}`).join(', ')}
                  </div>
                  <div className="text-ok font-semibold">
                    Deposit Paid: {formatPrice(b.deposit_amount)}
                  </div>
                  <div className="text-ink-2">
                    Balance Due on Arrival: <strong className="text-ink-1 font-bold">{formatPrice(b.balance_due)}</strong>
                  </div>
                  {assignedFitter && (
                    <div className="text-brand font-semibold pt-1">
                      Fitter: {assignedFitter.name} ({assignedFitter.van_reg})
                    </div>
                  )}
                </div>

                {/* Operating Workflow Actions */}
                <div className="flex flex-wrap lg:flex-col gap-2 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-line">
                  {b.status === 'confirmed' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(b.id, 'tyres_reserved')}
                      className="btn btn-secondary btn-sm text-[11px] flex items-center gap-1"
                    >
                      <Check size={13} /> Reserve Tyres &rarr;
                    </button>
                  )}

                  {b.status === 'tyres_reserved' && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase font-bold text-ink-3">Assign Technician:</label>
                      <select
                        className="input text-xs py-1 px-2 h-8"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleUpdateStatus(b.id, 'fitter_assigned', e.target.value);
                          }
                        }}
                      >
                        <option value="">Select Technician...</option>
                        {MOCK_FITTERS.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name} ({f.van_reg})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {b.status === 'fitter_assigned' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(b.id, 'en_route', b.fitter_id || 'fitter-1')}
                      className="btn btn-primary btn-sm text-[11px] flex items-center gap-1.5 shadow-md"
                    >
                      <Truck size={14} /> Dispatch Van (Mark En Route)
                    </button>
                  )}

                  {b.status === 'en_route' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(b.id, 'completed')}
                      className="btn btn-primary btn-sm text-[11px] flex items-center gap-1.5 bg-ok border-ok text-ink-inverse"
                    >
                      <CheckCircle2 size={14} /> Mark Fitting Completed
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/manage/${b.manage_token}`}
                      target="_blank"
                      className="btn btn-ghost btn-sm text-[11px] flex items-center gap-1"
                    >
                      Customer View <ExternalLink size={12} />
                    </Link>

                    {b.status !== 'cancelled' && b.status !== 'completed' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(b.id, 'cancelled')}
                        className="text-[11px] text-danger hover:underline font-semibold px-2 py-1"
                        title="Cancel booking and refund deposit"
                      >
                        Cancel / Refund
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
