'use client';
import { useState } from 'react';
import { bankReservationCopy, paymentInstructions } from '@/lib/bank-payments';
import { formatPrice } from '@/lib/utils';
import type { BookingWithDetails } from '@/types';

export default function BankInstructions({ booking }: { booking: BookingWithDetails }) {
  const [message, setMessage] = useState('');
  const p = booking.bank_payment, expiry = booking.bank_payment_expires_at;
  if (!p || !expiry || p.status !== 'pending') return <p role="alert" className="text-sm">Bank payment is blocked. Payment instructions are unavailable. Please contact G Force with your booking reference.</p>;
  if (Date.parse(expiry) <= Date.now()) return <p role="status" className="text-sm">The unpaid reservation has expired. Please refresh this booking before making a transfer.</p>;
  async function copy() {
    try { await navigator.clipboard.writeText(paymentInstructions(p!, expiry!)); setMessage('Payment instructions copied.'); }
    catch { setMessage('Copy was unavailable. Please select the bank details below.'); }
  }
  return <section aria-label="Bank transfer instructions" className="card min-w-0 space-y-4">
    <h2 className="text-xl font-bold">Booking reserved</h2>
    <p className="text-sm text-ink-2">{bankReservationCopy}</p>
    <dl className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 text-sm break-words">
      {Object.entries({ Reference: p.reference, 'Amount due': formatPrice(p.amount_pence), 'Bank name': p.bank_details.bank_name,
        'Account name': p.bank_details.bank_account_name, 'Sort code': p.bank_details.sort_code.match(/.{2}/g)?.join('-'),
        'Account number': p.bank_details.account_number, 'Payment reference': p.reference,
        'Expiry time': new Date(expiry).toLocaleString('en-GB', { timeZone: 'Europe/London' }) + ' (UK time)' }).map(([label, value]) =>
        <div key={label} className="min-w-0"><dt className="text-ink-2">{label}</dt><dd className="font-semibold">{value}</dd></div>)}
    </dl>
    <button type="button" className="btn btn-secondary min-h-11" onClick={copy}>Copy payment instructions</button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
