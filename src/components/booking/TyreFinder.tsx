'use client';

import { useEffect, useState } from 'react';
import { ContactActions } from '@/components/layout/BusinessContact';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, AlertCircle, MapPin } from 'lucide-react';
import type { ServiceZone } from '@/types';

type Stage = 'postcode' | 'manual';

const WIDTHS   = [155, 165, 175, 185, 195, 205, 215, 225, 235, 245, 255, 265, 275, 285];
const PROFILES = [30, 35, 40, 45, 50, 55, 60, 65, 70, 75];
const RIMS     = [14, 15, 16, 17, 18, 19, 20, 21, 22];

export default function TyreFinder({ cataloguePath = '/tyres' }: { cataloguePath?: string }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  const [stage, setStage] = useState<Stage>('postcode');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [postcode, setPostcode] = useState('');
  const [zone, setZone] = useState<ServiceZone | null>(null);
  const [manual, setManual] = useState({ width: '', profile: '', rim: '' });
  const manualComplete = !!manual.width && !!manual.profile && !!manual.rim;

  // ── Step 1: Postcode Check ──────────────────────────────────
  async function checkPostcode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const res = await fetch('/api/postcode/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postcode }),
      });
      const json = await res.json();

      if (!json.ok || !json.covered) {
        setError(json.covered === false ? "This postcode is outside our current fitting area. Check another postcode." : "We could not check that postcode. Please try again.");
        return;
      }

      setZone(json.data.zone);
      if (json.data.postcode) setPostcode(json.data.postcode);
      // OneAuto's account adapter is unverified; do not invite a dead lookup.
      setStage('manual');
    } catch {
      setError('Could not verify postcode. Please check your connection.');
    } finally {
      setBusy(false);
    }
  }

  function goToTyres(w: number, p: number, r: number) {
    if (![w, p, r].every((value) => Number.isInteger(value) && value > 0)) return;
    const params = new URLSearchParams({
      w: String(w),
      p: String(p),
      r: String(r),
      ...(postcode && { pc: postcode }),
    });
    router.push(`${cataloguePath}?${params}`);
  }

  return (
    <div className="w-full max-w-[640px]" aria-live="polite">
      {/* ── STEP 1: POSTCODE ── */}
      {stage === 'postcode' && (
        <form onSubmit={checkPostcode} className="finder-panel">
          <div className="finder-panel-head">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-ink-1">
                <MapPin size={16} className="text-brand" /> Start your tyre search
              </div>
              <p className="mt-1 text-xs text-ink-3">
                Check the fitting area, then enter your tyre size.
              </p>
            </div>
            <span className="finder-step-pill">Step 1 of 2</span>
          </div>

          <div className="finder-panel-body">
            <label htmlFor="pc" className="label block mb-2">Fitting postcode</label>
            <div className="finder-input-row">
              <input
                id="pc"
                className="input uppercase text-base"
                placeholder="Fitting postcode"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                autoComplete="postal-code"
                inputMode="text"
                disabled={!ready}
                required
                aria-invalid={!!error}
              />
              <button type="submit" className="btn btn-primary" disabled={!ready || busy || postcode.trim().length < 3}>
                {busy ? <Loader2 size={18} className="animate-spin" /> : <>Check area <ArrowRight size={15} /></>}
              </button>
            </div>

            {error && <div className="mt-3"><ErrorMessage msg={error} /></div>}

            <div className="finder-alt-row">
              <span>Already know the sidewall size?</span>
              <button type="button" disabled={!ready} onClick={() => { setError(null); setStage('manual'); }} className="finder-alt-button">
                Enter it manually →
              </button>
            </div>

          </div>
        </form>
      )}

      {/* ── STEP 2: MANUAL SIZE SELECTOR ── */}
      {stage === 'manual' && (
        <div className="card space-y-5 border-border-brand/40 shadow-2xl animate-in fade-in">
          <div>
            <div className="label mb-1 text-brand">Manual Tyre Size Selection</div>
            <p className="text-xs text-ink-2">
              Select the width, profile and rim size stamped on your tyre sidewall.
            </p>
          </div>

          {zone && <p className="text-sm text-ok" role="status">Postcode accepted. Enter the size from your tyre sidewall.</p>}
          {error && <ErrorMessage msg={error} />}

          <div className="grid grid-cols-3 gap-2">
            {([
              ['Width',   'width',   WIDTHS],
              ['Profile', 'profile', PROFILES],
              ['Rim',     'rim',     RIMS],
            ] as const).map(([label, key, opts]) => (
              <div key={key}>
                <label htmlFor={key} className="label mb-1.5 block">{label}</label>
                <select
                  id={key}
                  className="input px-2"
                  value={manual[key]}
                  onChange={(e) => setManual({ ...manual, [key]: e.target.value })}
                >
                  <option value="">Choose {label.toLowerCase()}</option>
                  {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="border-y border-line py-3 text-center">
            <span className="text-2xl font-bold mono text-brand">
              {manualComplete ? manual.width + '/' + manual.profile + ' R' + manual.rim : 'Choose all three sizes'}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={!manualComplete}
            onClick={() => { if (manualComplete) goToTyres(Number(manual.width), Number(manual.profile), Number(manual.rim)); }}
          >
            Show Available Tyres <ArrowRight size={16} />
          </button>

          <button
            type="button"
            onClick={() => setStage('postcode')}
            className="min-h-11 w-full text-xs text-ink-3 underline hover:text-ink-2 block text-center"
          >
            &larr; Start over
          </button>
        </div>
      )}
    </div>
  );
}

function ErrorMessage({ msg }: { msg: string }) {
  return (
    <div className="space-y-3">
      <div className="p-3 bg-danger/10 border border-danger/30 rounded text-xs text-danger flex items-start gap-2" role="alert">
        <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>{msg}</span>
      </div>
      <ContactActions />
    </div>
  );
}
