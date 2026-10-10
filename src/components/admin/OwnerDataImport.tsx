'use client';
import { useState } from 'react';
import { ownerImportSchema } from '@/lib/owner-data';

export default function OwnerDataImport() {
  const [kind, setKind] = useState<'zones' | 'catalogue'>('zones');
  const [text, setText] = useState('');
  const [review, setReview] = useState<ReturnType<typeof ownerImportSchema.parse> | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  function validate() {
    try {
      const result = ownerImportSchema.safeParse({ kind, rows: JSON.parse(text) });
      if (!result.success) { setMessage(result.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; ')); return; }
      setReview(result.data); setMessage('');
    } catch { setMessage('Enter a JSON array containing your approved records.'); }
  }
  async function save() {
    if (!review || busy) return;
    setBusy(true);
    try {
      const response = await fetch('/api/admin/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(review) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || 'Import could not be confirmed.');
      setMessage('Saved ' + result.data.saved + ' approved records.'); setReview(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Import failed.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5 min-w-0">
    <p className="text-sm text-ink-2">Supply approved business records only. Matching outward postcodes or SKUs are updated; other records are retained. Prices are integer pence. Reserved stock must match its current database value.</p>
    <p className="text-sm text-ink-2">Required fields and the read endpoint are documented in docs/production/03_GATE1_REAL_DATA.md. Empty input creates no records.</p>
    <label className="label block" htmlFor="import-kind">Record type</label>
    <select id="import-kind" className="input" value={kind} disabled={busy} onChange={(e) => { setKind(e.target.value as typeof kind); setReview(null); }}>
      <option value="zones">Service zones</option><option value="catalogue">Products and inventory</option>
    </select>
    <label className="label block" htmlFor="owner-rows">Owner-approved records (JSON array)</label>
    <textarea id="owner-rows" className="input mono w-full min-h-64" value={text} disabled={busy} onChange={(e) => { setText(e.target.value); setReview(null); }} />
    <button className="btn btn-secondary" onClick={validate} disabled={busy || !text.trim()}>Validate and review</button>
    {review && <div className="space-y-3">
      <p className="text-sm">Review {review.rows.length} records before saving:</p>
      <pre className="text-xs whitespace-pre-wrap break-all max-h-96 overflow-auto p-4 bg-surface-3">{JSON.stringify(review.rows, null, 2)}</pre>
      <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save approved records'}</button>
    </div>}
    {message && <p role="status" className="text-sm break-words">{message}</p>}
  </div>;
}
