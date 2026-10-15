'use client';
import { useEffect, useState } from 'react';
import { bankSettingsSchema } from '@/lib/bank-payments';

export default function BankSettings() {
  const [values, setValues] = useState({ bank_account_name: '', bank_name: '', sort_code: '', account_number: '', bank_payment_window_minutes: '' });
  const [message, setMessage] = useState('Loading bank settings…'), [busy, setBusy] = useState(true);
  const [configured, setConfigured] = useState(false);
  useEffect(() => { fetch('/api/admin/bank-settings', { cache: 'no-store' }).then(r => r.json()).then(r => {
    if (!r.ok || !r.data) throw new Error();
    setValues(v => Object.fromEntries(Object.keys(v).map(k => [k, r.data[k] == null ? '' : String(r.data[k])])) as typeof v);
    setConfigured(r.configured); setMessage(r.configured ? 'Bank details configured. New bookings collect the full total.' : 'Configuration required. Bank payment is blocked.');
  }).catch(() => setMessage('Bank settings unavailable.')).finally(() => setBusy(false)); }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault(); const input = bankSettingsSchema.safeParse({ ...values,
      sort_code: values.sort_code.replace(/[ -]/g, ''), bank_payment_window_minutes: Number(values.bank_payment_window_minutes) });
    if (!input.success) { setMessage('Enter real bank details: a six digit sort code, eight digit account number and payment window from 1 to 10,080 minutes.'); return; }
    setBusy(true);
    try { const r = await fetch('/api/admin/bank-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input.data) });
      if (!r.ok || !(await r.json()).ok) throw new Error(); setConfigured(true); setMessage('Bank settings saved and audited. Existing payment instructions keep their original details.');
    } catch { setMessage('Bank settings could not be saved. Reload before retrying.'); } finally { setBusy(false); }
  }
  return <form onSubmit={save} className="card space-y-4 min-w-0">
    <h2 className="text-xl font-bold">Bank transfer settings</h2>
    <p role="status" className="text-sm">{message}</p>
    {!configured && <p className="text-sm text-danger">Bookings require owner configured bank details.</p>}
    {Object.entries({ bank_account_name: 'Account name', bank_name: 'Bank name', sort_code: 'Sort code', account_number: 'Account number', bank_payment_window_minutes: 'Payment window (minutes)' }).map(([key, label]) =>
      <label key={key} className="block text-sm">{label}<input required className="input w-full min-h-11 mt-1" value={values[key as keyof typeof values]}
        inputMode={['sort_code','account_number','bank_payment_window_minutes'].includes(key) ? 'numeric' : 'text'}
        onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))} /></label>)}
    <button disabled={busy} className="btn btn-primary min-h-11">Save bank settings</button>
  </form>;
}
