'use client';

import { useState } from 'react';
import { ContactActions } from '@/components/layout/BusinessContact';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Check, AlertCircle, Car, MapPin } from 'lucide-react';
import { formatReg } from '@/lib/utils';
import { tyreSizeSchema } from '@/lib/validation';
import TurnstileChallenge from './TurnstileChallenge';
import type { VRMResult, ServiceZone } from '@/types';

type Stage = 'postcode' | 'vehicle' | 'result' | 'manual';

const WIDTHS   = [155, 165, 175, 185, 195, 205, 215, 225, 235, 245, 255, 265, 275, 285];
const PROFILES = [30, 35, 40, 45, 50, 55, 60, 65, 70, 75];
const RIMS     = [14, 15, 16, 17, 18, 19, 20, 21, 22];

export default function TyreFinder({ cataloguePath = '/tyres' }: { cataloguePath?: string }) {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>('postcode');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [postcode, setPostcode] = useState('');
  const [zone, setZone] = useState<ServiceZone | null>(null);
  const [reg, setReg] = useState('');
  const [vehicle, setVehicle] = useState<VRMResult | null>(null);
  const [axle, setAxle] = useState<'front' | 'rear' | 'both' | null>(null);
  const [sidewallConfirmed, setSidewallConfirmed] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');

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
      if (!turnstileToken) {
        setVehicle(null);
        setError('Registration lookup is unavailable. Enter the tyre size from your sidewall.');
        setStage('manual');
        return;
      }
      const res = await fetch('/api/vrm/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration: reg, postcode, turnstileToken }),
      });
      const json = await res.json();

      const found = json.data?.vehicle;
      if (!res.ok || !json.ok || !found?.make || !found?.model || !tyreSizeSchema.safeParse(found.front).success
        || (found.isStaggered && !tyreSizeSchema.safeParse(found.rear).success)) {
        setVehicle(null);
        setError(json.message || 'We could not match that registration. Enter the tyre size instead.');
        setStage('manual');
        return;
      }

      setVehicle(found);
      setAxle(null);
      setSidewallConfirmed(false);
      setZone(json.data.zone ?? zone);
      setStage('result');
    } catch {
      setVehicle(null);
      setError('Vehicle lookup is unavailable. Enter the tyre size from the sidewall instead.');
      setStage('manual');
    } finally {
      setBusy(false);
    }
  }

  function goToTyres(w: number, p: number, r: number) {
    if (![w, p, r].every((value) => Number.isInteger(value) && value > 0)) return;
    if (vehicle && (!sidewallConfirmed || (vehicle.isStaggered && !axle))) return;
    const params = new URLSearchParams({
      w: String(w),
      p: String(p),
      r: String(r),
      ...(postcode && { pc: postcode }),
      ...(reg && { reg }),
      ...(vehicle?.make && { make: vehicle.make }),
      ...(vehicle?.model && { model: vehicle.model }),
      ...(vehicle && { axle: axle ?? 'both', sidewall: 'confirmed' }),
      ...(vehicle?.isStaggered && axle === 'both' && vehicle.rear && {
        rw: String(vehicle.rear.width), rp: String(vehicle.rear.profile), rr: String(vehicle.rear.rim),
      }),
    });
    router.push(`${cataloguePath}?${params}`);
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
                Check the fitting area, then enter your tyre size.
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
              placeholder="Vehicle registration"
              value={reg}
              onChange={(e) => setReg(e.target.value.toUpperCase())}
              maxLength={10}
              required
            />
          </div>

          <TurnstileChallenge onToken={setTurnstileToken} />
          <button type="submit" className="btn btn-primary w-full" disabled={busy || reg.trim().length < 2 || (!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken)}>
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
              onClick={() => { setVehicle(null); setStage('manual'); }}
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
              Vehicle fitment found
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="group" aria-label="Choose tyres to replace">
                {(['front', 'rear', 'both'] as const).map((a) => {
                  const isSelected = axle === a;
                  const s = a === 'front' ? vehicle.front : vehicle.rear!;
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => { setAxle(a); setSidewallConfirmed(false); }}
                      aria-pressed={isSelected}
                      className={`min-h-11 p-2 rounded border text-left transition-colors ${
                        isSelected
                          ? 'bg-brand/10 border-brand text-ink-1 font-bold'
                          : 'bg-surface-2 border-line text-ink-3'
                      }`}
                    >
                      <span className="text-xs uppercase font-bold block">{a === 'both' ? 'Both axles' : a + ' axle'}</span>
                      <span className="mono text-xs">{a === 'both' ? 'Front and rear sizes' : s.width + '/' + s.profile + ' R' + s.rim}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-y border-line py-4 text-center">
            <div className="text-xs uppercase tracking-wider text-ink-3 mb-1">
              {axle === 'both' ? 'Front and rear sizes to confirm' : 'Detected ' + (axle ?? 'front').toUpperCase() + ' size'}
            </div>
            <div className="text-3xl font-bold text-brand mono tracking-tight">
              {spec.width}/{spec.profile} R{spec.rim}
            </div>
            {axle === 'both' && vehicle.rear && <div className="text-xl font-bold text-brand mono mt-2">Rear: {vehicle.rear.width}/{vehicle.rear.profile} R{vehicle.rear.rim}</div>}
            <div className="mt-1 text-xs text-ink-3">
              Load: {spec.load_index ?? 'Not provided'} · Speed: {spec.speed_rating ?? 'Not provided'}
            </div>
          </div>

          {/* Customer Confirmation Callout */}
          <div className="p-3 bg-surface-2 rounded border border-line text-center text-xs">
            <strong className="text-ink-1 block mb-1">Do these match the numbers on your tyres?</strong>
            <span className="text-ink-3">Check the numbers embossed on your physical tyre sidewall.</span>
          </div>

          <label className="flex items-start gap-3 text-sm min-h-11 cursor-pointer">
            <input type="checkbox" checked={sidewallConfirmed} className="mt-1 h-5 w-5 shrink-0 accent-brand"
              disabled={vehicle.isStaggered && !axle} onChange={(e) => setSidewallConfirmed(e.target.checked)} />
            I checked the physical sidewalls on every selected axle and these sizes match.
          </label>
          <div className="space-y-2.5">
            <button
              type="button"
              className="btn btn-primary w-full"
              disabled={!sidewallConfirmed || (vehicle.isStaggered && !axle)}
              onClick={() => goToTyres(spec.width, spec.profile, spec.rim)}
            >
              YES, THESE MATCH — VIEW TYRES <ArrowRight size={16} />
            </button>

            <button
              type="button"
              onClick={() => { setVehicle(null); setStage('manual'); }}
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
              Select the width, profile and rim size stamped on your tyre sidewall.
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
