'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  Car,
  MapPin,
  ShieldCheck,
  Calendar,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { ContactActions } from '@/components/layout/BusinessContact';
import { formatPrice, formatSlotTime, formatReg } from '@/lib/utils';
import MStripe from '@/components/ui/MStripe';
import type { BookingWithDetails, BookingStatus } from '@/types';
import { hasRecordedDeposit, bookingHeading } from '@/lib/booking-state';

const STATUS_STEPS: Array<{ key: BookingStatus; label: string; description: string }> = [
  { key: 'confirmed',        label: 'Deposit Recorded', description: 'Payment recorded on this booking.' },
  { key: 'tyres_reserved',   label: 'Tyres Reserved',    description: 'Tyre reservation recorded.' },
  { key: 'fitter_assigned',  label: 'Fitter Assigned',   description: 'Mobile technician assigned.' },
  { key: 'en_route',         label: 'Van En Route',      description: 'Technician driving to your location.' },
  { key: 'completed',        label: 'Fitting Complete',  description: 'Completion recorded.' },
];

export default function ManageBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const unwrappedParams = use(params);
  const token = unwrappedParams.token;

  const [booking, setBooking] = useState<BookingWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/manage/${token}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok && res.data) {
          setBooking(res.data);
        } else {
          if (res.error !== 'not_found') setLoadError('Booking service unavailable. Please try again later.');
          setBooking(null);
        }
      })
      .catch(() => { setBooking(null); setLoadError('Booking service unavailable. Please try again later.'); })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (booking?.status !== 'AWAITING_BANK_PAYMENT' || !booking.bank_payment_expires_at) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/manage/${token}`, { cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.ok || !result.data) throw new Error();
        setBooking(result.data);
      } catch {
        if (!controller.signal.aborted) { setBooking(null); setLoadError('Booking service unavailable. Please try again later.'); }
      }
    }, Math.max(0, Date.parse(booking.bank_payment_expires_at) - Date.now()) + 100);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [booking?.status, booking?.bank_payment_expires_at, token]);

  if (loading) {
    return (
      <div className="container-g section text-center py-20">
        <Loader2 size={32} className="animate-spin mx-auto text-brand" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="container-g section max-w-lg text-center">
        <MStripe className="mb-6 mx-auto" />
        <h1 className="display-2 mb-4">{loadError ? 'Booking service unavailable' : 'Booking Not Found'}</h1>
        <p className="text-sm text-ink-2 mb-8">
          {loadError ?? 'We could not locate a booking associated with that link. Please check your confirmation link.'}
        </p>
        <Link href="/" className="btn btn-primary">Return to Homepage</Link>
        <ContactActions className="justify-center mt-4" />
      </div>
    );
  }

  const b = booking;

  const when = b.slot
    ? `${new Date(b.slot.slot_date).toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long',
      })}, ${formatSlotTime(b.slot.start_time)}–${formatSlotTime(b.slot.end_time)}`
    : 'To be confirmed';

  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === b.status);
  const paid = hasRecordedDeposit(b);
  const activeIndex = paid ? currentStepIndex : -1;

  return (
    <div className="container-g section max-w-4xl">
      <MStripe className="mb-6" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <p className="label mb-1 text-brand">Customer Portal</p>
          <h1 className="display-1">MANAGE BOOKING</h1>
          <p className="mono text-sm text-ink-3">Reference: <span className="text-brand font-bold">{b.booking_ref}</span></p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/" className="btn btn-secondary btn-sm">
            <ArrowLeft size={14} /> Back to Site
          </Link>
        </div>
      </div>

      {actionMessage && (
        <div className="mb-6 p-4 bg-brand/10 border border-brand/30 rounded text-ink-1 text-sm flex items-center gap-2">
          <CheckCircle2 size={18} className="text-brand shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Live Status Pipeline Tracker */}
      <div className="card mb-8 border-border-brand/40 shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider">Live Fitting Status</h3>
          <span className="badge badge-info">{b.status.replaceAll('_', ' ').toUpperCase()}</span>
        </div>

        <p className="text-sm font-semibold" role="status">{bookingHeading(b)}</p>
        {b.status === 'AWAITING_BANK_PAYMENT' && b.bank_payment_expires_at && (
          <p className="text-sm text-ink-2">
            Your time and tyres are reserved until {new Date(b.bank_payment_expires_at).toLocaleString('en-GB')}.
            Bank payment has not been recorded. Contact us with your reference for payment instructions.
          </p>
        )}
        {b.status === 'EXPIRED' && <p className="text-sm text-ink-2">The unpaid reservation has expired. Its fitting time and tyres have been released. Please start a new search.</p>}
        <div className="grid sm:grid-cols-5 gap-3 pt-2">
          {STATUS_STEPS.map((s, idx) => {
            const isCompleted = idx <= activeIndex;
            const isCurrent = idx === activeIndex;
            return (
              <div
                key={s.key}
                className={`p-3 rounded border transition-all ${
                  isCurrent
                    ? 'bg-brand/10 border-brand text-ink-1 ring-1 ring-brand'
                    : isCompleted
                    ? 'bg-surface-3 border-ok/30 text-ink-1'
                    : 'bg-surface-3/40 border-line/40 text-ink-4'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="mono text-xs font-bold">0{idx + 1}</span>
                  {isCompleted ? (
                    <CheckCircle2 size={14} className={isCurrent ? 'text-brand' : 'text-ok'} />
                  ) : (
                    <Clock size={14} className="text-ink-4" />
                  )}
                </div>
                <div className="text-xs font-bold leading-tight">{s.label}</div>
                <div className="text-xs text-ink-3 mt-1 leading-snug">{s.description}</div>
              </div>
            );
          })}
        </div>

        <p className="text-sm text-ink-2">{b.fitter_id ? 'Fitter assignment recorded' : 'Fitter not assigned yet'}</p>
        <ContactActions />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-8 items-start">
        {/* Booking Details */}
        <div className="card space-y-5">
          <h3 className="text-sm font-bold uppercase tracking-wider border-b border-line pb-3">
            Appointment Information
          </h3>

          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <Calendar size={18} className="text-brand shrink-0 mt-0.5" />
              <div>
                <span className="text-xs uppercase text-ink-3 block font-semibold">Date &amp; Arrival Window</span>
                <span className="font-bold text-ink-1">{when}</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin size={18} className="text-brand shrink-0 mt-0.5" />
              <div>
                <span className="text-xs uppercase text-ink-3 block font-semibold">Fitting Address</span>
                <span className="font-bold text-ink-1">{b.fitting_address}</span>
                {b.fitting_postcode && <span className="text-xs text-ink-3 block">{b.fitting_postcode}</span>}
              </div>
            </div>

            {b.vehicle_reg && (
              <div className="flex items-start gap-3">
                <Car size={18} className="text-brand shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs uppercase text-ink-3 block font-semibold">Vehicle</span>
                  <span className="font-bold text-ink-1">
                    {formatReg(b.vehicle_reg)} · {[b.vehicle_make, b.vehicle_model].filter(Boolean).join(' ')}
                  </span>
                </div>
              </div>
            )}

            {b.customer_notes && (
              <div className="p-3 bg-surface-3 rounded border border-line text-xs">
                <span className="text-ink-3 block font-semibold mb-1">Access / Fitting Notes:</span>
                <span className="text-ink-1 italic">&ldquo;{b.customer_notes}&rdquo;</span>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="border-t border-line pt-4 space-y-2">
            <span className="text-xs uppercase text-ink-3 block font-semibold mb-1">Ordered Tyres</span>
            {b.items.map((i) => (
              <div key={i.id} className="flex justify-between text-xs py-1">
                <span>{i.quantity} × {i.tyre_label}</span>
                <span className="mono font-semibold">{formatPrice(i.line_total)}</span>
              </div>
            ))}
          </div>

          {/* Money Breakdown */}
          <div className="border-t border-line pt-4 space-y-1.5 text-xs">
            <div className="flex justify-between text-ink-2">
              <span>Total Price</span>
              <span className="mono">{formatPrice(b.total_amount)}</span>
            </div>
            <div className="flex justify-between text-ok font-semibold">
              <span>{paid ? 'Deposit recorded' : 'Deposit required'}</span>
              <span className="mono">{formatPrice(b.deposit_amount)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-ink-1 pt-2 border-t border-line/40">
              <span>{paid ? 'Balance Due on Arrival' : 'Balance after deposit'}</span>
              <span className="mono text-brand">{formatPrice(b.balance_due)}</span>
            </div>
          </div>
        </div>

        {/* Self-Service Actions */}
        <div className="space-y-6">
          <div className="card space-y-4 border-border-brand/30">
            <h3 className="text-sm font-bold uppercase tracking-wider border-b border-line pb-3">
              Need to Make Changes?
            </h3>

            <p className="text-xs text-ink-2">
              Online booking changes are currently unavailable. Contact us with your booking reference to discuss a change.
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                className="btn btn-secondary w-full btn-sm text-xs font-semibold"
                onClick={() => setActionMessage('For help with rescheduling, use a configured contact option below or reply to your booking confirmation. Include reference ' + b.booking_ref + '.')}
              >
                Request Reschedule Window
              </button>

              <button
                type="button"
                className="btn btn-danger w-full btn-sm text-xs font-semibold"
                onClick={async () => {
                  if (confirm('Are you sure you want to cancel this booking?')) {
                    try {
                      const res = await fetch(`/api/manage/${token}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'cancel' }),
                      });
                      const json = await res.json();
                      if (json.ok && json.data) {
                        setBooking(json.data);
                        setActionMessage(json.data.status === 'cancelled' ? 'Cancellation recorded. Contact us about any refund.' : 'Cancellation could not be confirmed.');
                      } else {
                        setActionMessage(json.message ?? 'Could not cancel booking.');
                      }
                    } catch {
                      setActionMessage('Failed to submit cancellation request.');
                    }
                  }
                }}
              >
                Cancel Booking
              </button>
            </div>
            <ContactActions />
          </div>

          <div className="card bg-surface-2 space-y-3 text-xs text-ink-2">
            <div className="flex items-start gap-2">
              <ShieldCheck size={16} className="text-brand shrink-0 mt-0.5" />
              <div>
                <strong className="text-ink-1 block">Fitting Day Checklist</strong>
                Please ensure your vehicle is parked in an accessible area with 1m clearance around all 4 wheels, and have your wheel lock nut key ready.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
