'use client';

import { useState } from 'react';
import { ContactActions } from '@/components/layout/BusinessContact';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Check, AlertCircle, Car, MapPin } from 'lucide-react';
import { formatReg } from '@/lib/utils';
import { isMockDataEnabled } from '@/lib/mock-mode';
import type { VRMResult, ServiceZone } from '@/types';

type Stage = 'postcode' | 'vehicle' | 'result' | 'manual';

const WIDTHS   = [155, 165, 175, 185, 195, 205, 215, 225, 235, 245, 255, 265, 275, 285];
const PROFILES = [30, 35, 40, 45, 50, 55, 60, 65, 70, 75];
const RIMS     = [14, 15, 16, 17, 18, 19, 20, 21, 22];

export default function TyreFinder() {
  const router = useRouter();
  const mockMode = isMockDataEnabled();

  const [stage, setStage] = useState<Stage>('postcode');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [postcode, setPostcode] = useState('');
  const [zone, setZone] = useState<ServiceZone | null>(null);
  const [reg, setReg] = useState('');
  const [vehicle, setVehicle] = useState<VRMResult | null>(null);
  const [axle, setAxle] = useState<'front' | 'rear'>('front');

  const [manual, setManual] = useState({ width: 225, profile: 45, rim: 18 });

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
      setStage('vehicle');
    } catch {
      setError('Could not verify postcode. Please check your connection.');
    } finally {
      setBusy(false);
    }
  }

  // ── Step 2: Vehicle Lookup ──────────────────────────────────
  async function lookupVehicle(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const res = await fetch('/api/vrm/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration: reg, postcode }),
      });
      const json = await res.json();

      if (!json.ok) {
        setError(json.message || 'We could not match that registration. Enter the tyre size instead.');
        setStage('manual');
        return;
      }

      setVehicle(json.data.vehicle);
      setZone(json.data.zone ?? zone);
      setStage('result');
    } catch {
      setError('Vehicle lookup is unavailable. Enter the tyre size from the sidewall instead.');
      setStage('manual');
    } finally {
      setBusy(false);
    }
  }

  function goToTyres(w: number, p: number, r: number) {
    const params = new URLSearchParams({
      w: String(w),
      p: String(p),
      r: String(r),
      ...(postcode && { pc: postcode }),
      ...(reg && { reg }),
      ...(vehicle?.make && { make: vehicle.make }),
      ...(vehicle?.model && { model: vehicle.model }),
    });
    router.push(`/tyres?${params}`);
  }

  const spec = vehicle ? (axle === 'rear' && vehicle.rear ? vehicle.rear : vehicle.front) : null;

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
                Check the fitting area, then search by registration or tyre size.
              </p>
            </div>
            <span className="finder-step-pill">Step 1 of 3</span>
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
                required
                aria-invalid={!!error}
              />
              <button type="submit" className="btn btn-primary" disabled={busy || postcode.trim().length < 3}>
                {busy ? <Loader2 size={18} className="animate-spin" /> : <>Check area <ArrowRight size={15} /></>}
              </button>
            </div>

            {error && <div className="mt-3"><ErrorMessage msg={error} /></div>}

            <div className="finder-alt-row">
              <span>Already know the sidewall size?</span>
              <button type="button" onClick={() => { setError(null); setStage('manual'); }} className="finder-alt-button">
                Enter it manually →
              </button>
            </div>

            {mockMode && (
              <p className="mt-3 border-t border-line pt-3 text-xs text-ink-3">
                Local preview: try <strong className="text-ink-2">E14 8PX</strong>, then <strong className="text-ink-2">AB21 ABC</strong>.
              </p>
            )}
          </div>
        </form>
      )}

      {/* ── STEP 2: REGISTRATION ── */}
      {stage === 'vehicle' && (
        <form onSubmit={lookupVehicle} className="space-y-4 finder-panel p-5 animate-in fade-in">
          {zone && (
            <div className="p-3 bg-ok/10 border border-ok/30 rounded flex items-start gap-2 text-xs text-ink-1">
              <Check size={16} className="text-ok shrink-0 mt-0.5" />
              <div>
                <strong className="text-ok block font-bold">Postcode accepted</strong>
                <span>Continue with the vehicle registration, or switch to manual size entry.</span>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="reg" className="label mb-2 block flex items-center gap-1.5">
              <Car size={14} className="text-brand" /> Enter the vehicle registration
            </label>
            <p className="text-xs text-ink-3 mb-3">
              We will return a fitment for you to check against the tyre sidewall.
            </p>
            <input
              id="reg"
              className="input-vrm uppercase text-center font-bold tracking-widest text-lg"
              placeholder="e.g. AB21 ABC"
              value={reg}
              onChange={(e) => setReg(e.target.value.toUpperCase())}
              maxLength={10}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={busy || reg.trim().length < 2}>
              {busy ? <><Loader2 size={18} className="animate-spin" /> Checking fitment...</> : <>Find matching size <ArrowRight size={16} /></>}
          </button>

          {error && <ErrorMessage msg={error} />}

          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={() => setStage('postcode')}
              className="min-h-11 text-ink-3 hover:text-ink-1"
            >
              &larr; Change Postcode
            </button>
            <button
              type="button"
              onClick={() => setStage('manual')}
              className="min-h-11 text-brand hover:underline font-semibold"
            >
              I know my tyre size &rarr;
            </button>
          </div>
        </form>
      )}

      {/* ── STEP 3: VEHICLE & TYRE SIZE CONFIRMATION ── */}
      {stage === 'result' && vehicle && spec && (
        <div className="card space-y-5 border-border-brand/40 shadow-2xl animate-in fade-in">
          <div>
            <div className="label mb-1 text-brand">
              {mockMode ? 'Local fitment preview' : 'Vehicle fitment found'}
            </div>
            <div className="text-xl font-bold text-ink-1">
              {vehicle.make} {vehicle.model}
            </div>
            {(vehicle.derivative || vehicle.year) && (
              <div className="text-xs text-ink-2 mt-0.5">
                {[vehicle.derivative, vehicle.year].filter(Boolean).join(' · ')}
              </div>
            )}
            <div className="mono mt-2 text-xs font-bold bg-surface-3 py-1 px-2.5 rounded inline-block text-ink-1">
              {formatReg(vehicle.registration)}
            </div>
          </div>

          {vehicle.isStaggered && vehicle.rear && (
            <div className="p-3 bg-surface-3 rounded border border-line">
              <div className="text-xs font-semibold text-ink-1 mb-2">
                This vehicle runs staggered front &amp; rear tyre sizes:
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['front', 'rear'] as const).map((a) => {
                  const isSelected = axle === a;
                  const s = a === 'front' ? vehicle.front : vehicle.rear!;
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAxle(a)}
                      className={`p-2 rounded border text-left transition-colors ${
                        isSelected
                          ? 'bg-brand/10 border-brand text-ink-1 font-bold'
                          : 'bg-surface-2 border-line text-ink-3'
                      }`}
                    >
                      <span className="text-xs uppercase font-bold block">{a} Axle</span>
                      <span className="mono text-xs">{s.width}/{s.profile} R{s.rim}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-y border-line py-4 text-center">
            <div className="text-xs uppercase tracking-wider text-ink-3 mb-1">
              Detected {axle.toUpperCase()} Size
            </div>
            <div className="text-3xl font-bold text-brand mono tracking-tight">
              {spec.width}/{spec.profile} R{spec.rim}
            </div>
            <div className="mt-1 text-xs text-ink-3">
              Load: {spec.load_index ?? '95'} · Speed: {spec.speed_rating ?? 'Y'}
            </div>
          </div>

          {/* Customer Confirmation Callout */}
          <div className="p-3 bg-surface-2 rounded border border-line text-center text-xs">
            <strong className="text-ink-1 block mb-1">Do these match the numbers on your tyres?</strong>
            <span className="text-ink-3">Check the numbers embossed on your physical tyre sidewall.</span>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={() => goToTyres(spec.width, spec.profile, spec.rim)}
            >
              YES, THESE MATCH — VIEW TYRES <ArrowRight size={16} />
            </button>

            <button
              type="button"
              onClick={() => setStage('manual')}
              className="btn btn-secondary w-full btn-sm text-xs"
            >
              MY TYRE SIZE IS DIFFERENT
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: MANUAL SIZE SELECTOR ── */}
      {stage === 'manual' && (
        <div className="card space-y-5 border-border-brand/40 shadow-2xl animate-in fade-in">
          <div>
            <div className="label mb-1 text-brand">Manual Tyre Size Selection</div>
            <p className="text-xs text-ink-2">
              Select the 3 numbers stamped on your tyre sidewall, e.g. <span className="mono text-ink-1 font-bold">225/45 R18</span>.
            </p>
          </div>

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
                  onChange={(e) => setManual({ ...manual, [key]: Number(e.target.value) })}
                >
                  {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="border-y border-line py-3 text-center">
            <span className="text-2xl font-bold mono text-brand">
              {manual.width}/{manual.profile} R{manual.rim}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-primary w-full"
            onClick={() => goToTyres(manual.width, manual.profile, manual.rim)}
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
