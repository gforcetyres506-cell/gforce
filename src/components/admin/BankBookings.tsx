'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import BankInstructions from '@/components/booking/BankInstructions';
import { formatPrice } from '@/lib/utils';
import type { BookingWithDetails } from '@/types';

export default function BankBookings({ canOperate }: { canOperate: boolean }) {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]), [selected, setSelected] = useState('');
  const [message, setMessage] = useState('Loading bookings…'), [busy, setBusy] = useState(false);
  const [minutes, setMinutes] = useState(''), [reason, setReason] = useState('');
  const [confirmBooking, setConfirmBooking] = useState<BookingWithDetails | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  async function load() {
    try { const response = await fetch('/api/admin/bookings', { cache: 'no-store' }), r = await response.json();
      if (!response.ok || !r.ok || !Array.isArray(r.data)) throw new Error(); setBookings(r.data); setMessage(r.data.length ? '' : 'No bookings recorded.');
    } catch { setBookings([]); setMessage('Booking service unavailable.'); }
  }
  useEffect(() => { setSelected(new URLSearchParams(window.location.search).get('selected') ?? ''); void load(); }, []);
  const b = bookings.find(v => v.id === selected);
  async function action(body: object, instructions = false) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(instructions ? '/api/admin/payments/instructions' : '/api/admin/payments',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const r = await response.json();
      if (!response.ok || !r.ok) throw new Error(r.message || 'Change not confirmed. Refresh before retrying.');
      await load(); setMessage(r.message || 'Change saved and audited.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Request not confirmed.'); }
    finally { setBusy(false); }
  }
  function askReceipt(booking: BookingWithDetails) { setConfirmBooking(booking); dialog.current?.showModal(); }
  return <div className="space-y-6 min-w-0">
    {canOperate && <Link href="/admin/bookings/phone" className="btn btn-primary min-h-11">Create phone booking</Link>}
    <p role="status" className="text-sm">{message}</p>
    <label className="block text-sm">Select booking<select className="input w-full min-h-11 mt-2" value={selected} onChange={e => setSelected(e.target.value)}>
      <option value="">Choose a booking</option>{bookings.map(v => <option key={v.id} value={v.id}>{v.booking_ref} — {v.status.replaceAll('_', ' ')}</option>)}
    </select></label>
    {b && <article className="card min-w-0 space-y-5">
      <h2 className="text-xl font-bold break-all">{b.booking_ref}</h2>
      <p className="text-sm">{b.customer?.name} · {b.booking_source ?? 'Source not recorded'} · {b.status.replaceAll('_', ' ')} · {formatPrice(b.total_amount)}</p>
      <Link href={'/manage/' + b.manage_token} className="btn btn-secondary min-h-11">Open manage link</Link>
      {b.status === 'AWAITING_BANK_PAYMENT' && <BankInstructions booking={b} />}
      {b.status === 'EXPIRED' && <p className="text-sm">Unpaid reservation expired. A new payment window requires the fitting time and stock to be available again.</p>}
      {b.bank_payment?.status === 'received' && b.bank_payment.verified && <p className="text-sm">Bank payment received and verified at {b.bank_payment.paid_at ? new Date(b.bank_payment.paid_at).toLocaleString('en-GB') : ''}.</p>}
      {canOperate && b.status === 'AWAITING_BANK_PAYMENT' && b.bank_payment?.status === 'pending' && <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy} className="btn btn-primary min-h-11" onClick={() => askReceipt(b)}>MARK PAYMENT RECEIVED</button>
        <button type="button" disabled={busy} className="btn btn-secondary min-h-11" onClick={() => action({ booking_id: b.id }, true)}>Email payment instructions</button>
      </div>}
      {canOperate && ['AWAITING_BANK_PAYMENT','EXPIRED'].includes(b.status) && b.bank_payment?.status === 'pending' && <form className="space-y-3 border-t border-line pt-4" onSubmit={e => {
        e.preventDefault(); void action({ action: 'extend', booking_id: b.id, minutes: Number(minutes), reason, expected_expires_at: b.bank_payment_expires_at });
      }}>
        <h3 className="font-bold">Extend payment window</h3>
        <label className="block text-sm">Additional minutes<input required type="number" min="1" max="10080" value={minutes} onChange={e => setMinutes(e.target.value)} className="input w-full min-h-11" /></label>
        <label className="block text-sm">Reason for extension<input required minLength={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} className="input w-full min-h-11" /></label>
        <button disabled={busy} className="btn btn-secondary min-h-11">Check availability and extend</button>
      </form>}
    </article>}
    <dialog ref={dialog} className="card bg-surface-1 text-ink-1 w-[calc(100%_-_2rem)] max-w-lg backdrop:bg-black/70" aria-labelledby="bank-receipt-question" onClose={() => setConfirmBooking(null)}>
      <h2 id="bank-receipt-question" className="text-lg font-bold">Have you confirmed {formatPrice(confirmBooking?.bank_payment?.amount_pence ?? 0)} has arrived in the G Force business bank account?</h2>
      <p className="text-sm text-ink-2 my-4">Check the actual bank account and match the booking reference before confirming.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-secondary min-h-11" onClick={() => dialog.current?.close()}>Cancel</button>
        <button type="button" disabled={busy || !confirmBooking} className="btn btn-primary min-h-11" onClick={() => {
          if (!confirmBooking?.bank_payment) return;
          const body = { action: 'verify', booking_id: confirmBooking.id, expected_amount_pence: confirmBooking.bank_payment.amount_pence, bank_receipt_confirmed: true };
          dialog.current?.close(); void action(body);
        }}>Yes, receipt verified</button>
      </div>
    </dialog>
  </div>;
}
