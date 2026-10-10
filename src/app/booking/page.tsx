'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Minus,
  Check,
} from 'lucide-react';
import MStripe from '@/components/ui/MStripe';
import TierBadge from '@/components/ui/TierBadge';
import { ContactActions } from '@/components/layout/BusinessContact';
import { formatPrice, formatTyreSize, formatSlotTime, makeSessionToken } from '@/lib/utils';
import { validBookingEntry, quoteSchema } from '@/lib/journey';
import { tyreSizeSchema } from '@/lib/validation';
import { reservationSchema } from '@/lib/checkout-result';
import type { Tyre, SlotWithAvailability, ServiceZone, PriceBreakdown } from '@/types';

function BookingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramTyreId = searchParams.get('tyre');
  const paramWidth = Number(searchParams.get('w'));
  const paramProfile = Number(searchParams.get('p'));
  const paramRim = Number(searchParams.get('r'));
  const paramQty = searchParams.has('qty') ? Number(searchParams.get('qty')) : 1;
  const paramPostcode = searchParams.get('pc') ?? '';
  const bothAxles = searchParams.get('axle') === 'both' && searchParams.has('rw');
  const rearWidth = Number(searchParams.get('rw'));
  const rearProfile = Number(searchParams.get('rp'));
  const rearRim = Number(searchParams.get('rr'));
  const validEntry = validBookingEntry(paramTyreId, searchParams.get('w'), searchParams.get('p'), searchParams.get('r'))
    && Number.isInteger(paramQty) && paramQty >= 1 && paramQty <= 8
    && (!bothAxles || tyreSizeSchema.safeParse({ width: rearWidth, profile: rearProfile, rim: rearRim }).success);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [sessionToken] = useState(() => makeSessionToken());
  const [allTyres, setAllTyres] = useState<Tyre[]>([]);
  const [selectedTyre, setSelectedTyre] = useState<Tyre | null>(null);
  const [journeyError, setJourneyError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(paramQty);
  const [hasRearTyre, setHasRearTyre] = useState(bothAxles);
  const [rearTyre, setRearTyre] = useState<Tyre | null>(null);
  const [rearQuantity, setRearQuantity] = useState(1);
  const [postcode, setPostcode] = useState(paramPostcode);
  const [zone, setZone] = useState<ServiceZone | null>(null);
  const [validatedPostcode, setValidatedPostcode] = useState('');
  const [isCheckingPostcode, setIsCheckingPostcode] = useState(false);
  const [postcodeError, setPostcodeError] = useState<string | null>(null);
  const [registration, setRegistration] = useState(searchParams.get('reg') ?? '');
  const [vehicleMake, setVehicleMake] = useState(searchParams.get('make') ?? '');
  const [vehicleModel, setVehicleModel] = useState(searchParams.get('model') ?? '');
  const [slots, setSlots] = useState<SlotWithAvailability[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<SlotWithAvailability | null>(null);
  const postcodeRequest = useRef(0);
  const [quote, setQuote] = useState<PriceBreakdown | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [fittingNotes, setFittingNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const tyresReady = !!selectedTyre && quantity <= selectedTyre.stock
    && (!hasRearTyre || (!!rearTyre && rearQuantity <= rearTyre.stock));
  const locationReady = !!zone && validatedPostcode === postcode.trim().toUpperCase();
  const slotReady = !!selectedSlot;

  useEffect(() => {
    if (!validEntry) { router.replace('/#tyre-finder'); return; }
    const controller = new AbortController();
    setSelectedTyre(null); setJourneyError(null);
    fetch('/api/tyres?w=' + paramWidth + '&p=' + paramProfile + '&r=' + paramRim, { signal: controller.signal })
      .then((response) => response.json())
      .then((response) => {
        if (!response.ok || !Array.isArray(response.data)) throw new Error('Inventory unavailable. Please return to search.');
        const match: Tyre | undefined = response.data.find((tyre: Tyre) => tyre.id === paramTyreId
          && tyre.width === paramWidth && tyre.profile === paramProfile && tyre.rim === paramRim);
        if (!match || !match.active || !Number.isSafeInteger(match.stock) || match.stock < paramQty
          || !Number.isSafeInteger(match.sell_price) || match.sell_price <= 0) {
          throw new Error('That tyre is unavailable. Please return to search.');
        }
        setSelectedTyre(match); setQuantity(paramQty);
      })
      .catch((error) => { if (!controller.signal.aborted) setJourneyError(error instanceof Error ? error.message : 'Inventory unavailable.'); });
    return () => controller.abort();
  }, [validEntry, paramTyreId, paramWidth, paramProfile, paramRim, paramQty, router]);

  useEffect(() => {
    if (validEntry && paramPostcode) void validateLocation(paramPostcode);
  }, [validEntry, paramPostcode]);

  useEffect(() => {
    if (!validEntry) return;
    const controller = new AbortController();
    setIsLoadingSlots(true);
    fetch('/api/slots', { signal: controller.signal })
      .then((response) => response.json())
      .then((response) => {
        if (!response.ok || !Array.isArray(response.data)) throw new Error();
        setSlots(response.data);
        setSelectedDate(response.data.find((slot: SlotWithAvailability) => slot.available)?.slot_date ?? '');
      })
      .catch(() => { if (!controller.signal.aborted) { setSlots([]); setSlotsError('Fitting availability unavailable. Please try again later.'); } })
      .finally(() => { if (!controller.signal.aborted) setIsLoadingSlots(false); });
    return () => controller.abort();
  }, [validEntry]);

  useEffect(() => {
    setRearTyre(null);
    if (!hasRearTyre) return;
    const controller = new AbortController();
    setAllTyres([]);
    fetch('/api/tyres' + (bothAxles ? '?w=' + rearWidth + '&p=' + rearProfile + '&r=' + rearRim : ''), { signal: controller.signal })
      .then((response) => response.json())
      .then((response) => {
        if (!response.ok || !Array.isArray(response.data)) throw new Error();
        setAllTyres(response.data.filter((tyre: Tyre) => tyre.active && tyre.stock > 0 && tyre.sell_price > 0
          && (!bothAxles || (tyre.width === rearWidth && tyre.profile === rearProfile && tyre.rim === rearRim))
          && (tyre.width !== paramWidth || tyre.profile !== paramProfile || tyre.rim !== paramRim)));
      })
      .catch(() => { if (!controller.signal.aborted) setAllTyres([]); });
    return () => controller.abort();
  }, [hasRearTyre, paramWidth, paramProfile, paramRim, bothAxles, rearWidth, rearProfile, rearRim]);

  useEffect(() => {
    setQuote(null); setQuoteError(null);
    if (!tyresReady || !locationReady || !selectedTyre) { setQuoteLoading(false); return; }
    const controller = new AbortController();
    const items = [{ tyre_id: selectedTyre.id, quantity }];
    if (hasRearTyre && rearTyre) items.push({ tyre_id: rearTyre.id, quantity: rearQuantity });
    setQuoteLoading(true);
    fetch('/api/checkout/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, postcode: validatedPostcode }), signal: controller.signal })
      .then((response) => response.json())
      .then((response) => {
        const parsed = quoteSchema.safeParse(response.data);
        if (!response.ok || !parsed.success || parsed.data.lines.length !== items.length
          || !items.every((item) => parsed.data.lines.some((line) => line.tyre_id === item.tyre_id && line.quantity === item.quantity))) throw new Error();
        setQuote(parsed.data);
      })
      .catch(() => { if (!controller.signal.aborted) setQuoteError('Pricing unavailable. Cannot continue. Please try again later.'); })
      .finally(() => { if (!controller.signal.aborted) setQuoteLoading(false); });
    return () => controller.abort();
  }, [selectedTyre, quantity, hasRearTyre, rearTyre, rearQuantity, tyresReady, locationReady, validatedPostcode]);

  async function validateLocation(pc: string) {
    const request = ++postcodeRequest.current;
    setZone(null); setValidatedPostcode(''); setPostcodeError(null);
    if (pc.trim().length < 4) return;
    setIsCheckingPostcode(true);
    try {
      const response = await fetch('/api/postcode/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postcode: pc }) });
      const data = await response.json();
      if (request !== postcodeRequest.current) return;
      if (!response.ok || !data.ok || !data.covered || !data.data?.zone) throw new Error(data.message || 'We could not verify this fitting area.');
      setZone(data.data.zone); setValidatedPostcode(pc.trim().toUpperCase());
    } catch (error) {
      if (request === postcodeRequest.current) setPostcodeError(error instanceof Error ? error.message : 'Fitting area verification unavailable. Please try again.');
    } finally {
      if (request === postcodeRequest.current) setIsCheckingPostcode(false);
    }
  }

  function handleSelectSlot(slot: SlotWithAvailability) {
    setSelectedSlot(slot);
  }

  const availableDates = Array.from(new Set(slots.map((slot) => slot.slot_date))).slice(0, 10);
  const slotsForSelectedDate = slots.filter((slot) => slot.slot_date === selectedDate);
  const frontTotal = selectedTyre ? selectedTyre.sell_price * quantity : undefined;
  const rearTotal = rearTyre ? rearTyre.sell_price * rearQuantity : undefined;
  const price = (value: number | undefined) => value === undefined ? 'Unavailable' : formatPrice(value);

  async function handleProceedToPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!tyresReady || !locationReady || !slotReady || !quote) {
      setFormError('Confirm the tyres, price, fitting area and selected time before continuing.'); return;
    }
    if (!fullName || !email || !phone || !addressLine1) {
      setFormError('Please fill in all required contact and fitting address fields.'); return;
    }
    setIsSubmitting(true); setFormError(null);
    try {
      const response = await fetch('/api/checkout/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_id: selectedSlot!.id, session_token: sessionToken,
          customer: { name: fullName, email, phone, address_line1: addressLine1,
            address_line2: addressLine2, city, postcode: validatedPostcode },
          vehicle: { reg: registration.trim().toUpperCase() || undefined, make: vehicleMake.trim() || undefined, model: vehicleModel.trim() || undefined },
          items: [{ tyre_id: selectedTyre!.id, quantity }, ...(hasRearTyre && rearTyre ? [{ tyre_id: rearTyre.id, quantity: rearQuantity }] : [])],
          notes: fittingNotes }),
      });
      const data = await response.json();
      const reservation = reservationSchema.safeParse(data.data);
      if (response.ok && data.ok && reservation.success) {
        router.push('/manage/' + reservation.data.manage_token); return;
      }
      setFormError(data.message || 'Your reservation could not be verified. Retry this checkout to check the same booking.');
    } catch {
      setFormError('Your reservation could not be verified. Retry this checkout to check the same booking.');
    } finally { setIsSubmitting(false); }
  }
  if (!validEntry) return <div className="container-g section" role="status">Returning to tyre finder…</div>;

  return (
    <div className="container-g section">
      <MStripe className="mb-6" />

      {/* Step Header */}
      <div className="mb-8">
        <p className="label mb-2">Mobile Tyre Fitting</p>
        <h1 className="display-1">BOOK YOUR FITTING</h1>
      </div>

      {/* Progress Tracker */}
      <div className="grid grid-cols-4 gap-2 mb-10 pb-4 border-b border-line" role="group" aria-label="Booking progress">
        {[
          { num: 1, title: 'Tyres & Qty' },
          { num: 2, title: 'Location & Van' },
          { num: 3, title: 'Choose Slot' },
          { num: 4, title: 'Contact & Reserve' },
        ].map((s) => {
          const isActive = step === s.num;
          const isDone = step > s.num;
          return (
            <button
              key={s.num}
              type="button"
              aria-label={"Step " + s.num + ": " + s.title}
              aria-current={isActive ? 'step' : undefined}
              onClick={() => {
                if (s.num === 1 || (s.num === 2 && tyresReady) || (s.num === 3 && tyresReady && locationReady && quote) || (s.num === 4 && tyresReady && locationReady && quote && slotReady)) {
                  setStep(s.num as 1 | 2 | 3 | 4);
                }
              }}
              className="min-w-0 min-h-11 flex flex-col sm:flex-row items-center sm:items-start gap-2 text-center sm:text-left"
            >
              <div
                className={`step-num ${
                  isActive ? 'step-num-active' : isDone ? 'step-num-complete' : ''
                }`}
              >
                {isDone ? <Check size={16} /> : s.num}
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase font-bold tracking-wider text-ink-3">Step 0{s.num}</div>
                <div className={`text-xs font-semibold ${isActive ? 'text-brand' : 'text-ink-2'}`}>
                  {s.title}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-6 lg:gap-10 items-start">
        {/* Left Column: Interactive Wizard Steps */}
        <div>
          {/* ════════ STEP 1: TYRES & QUANTITY ════════ */}
          {step === 1 && (
            <div className="card space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
                <div>
                  <h2 className="text-xl font-bold">1. Select Your Tyres</h2>
                  <p className="text-sm text-ink-2">Pick tyre model and how many you need fitted.</p>
                </div>
                <Link href="/tyres" className="btn btn-secondary btn-sm text-xs">
                  Browse All Tyres
                </Link>
              </div>

              {selectedTyre ? (
                <div className="bg-surface-3 p-5 rounded border border-line space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-brand font-bold">
                        {selectedTyre.brand} <TierBadge tier={selectedTyre.tier} />
                      </div>
                      <h3 className="text-lg font-bold">{selectedTyre.model}</h3>
                      <div className="mono text-sm text-ink-2">{formatTyreSize(selectedTyre)}</div>
                    </div>
                    <div className="text-right">
                      <div className="price-display text-2xl text-ink-1">
                        {formatPrice(selectedTyre.sell_price)}
                      </div>
                      <div className="text-xs text-ink-3">per tyre</div>
                    </div>
                  </div>

                  {/* Quantity selector */}
                  <div className="flex items-center justify-between pt-4 border-t border-line/60">
                    <span className="text-sm font-semibold">Quantity:</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        aria-label="Decrease tyre quantity"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        disabled={quantity <= 1}
                        className="btn btn-secondary btn-sm h-11 w-11 p-0 flex items-center justify-center"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="mono text-lg font-bold w-6 text-center">{quantity}</span>
                      <button
                        type="button"
                        aria-label="Increase tyre quantity"
                        onClick={() => setQuantity((q) => Math.min(selectedTyre.stock, q + 1))}
                        disabled={quantity >= selectedTyre.stock}
                        className="btn btn-secondary btn-sm h-11 w-11 p-0 flex items-center justify-center"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-ink-2 mb-4" role="alert">{journeyError ?? 'Checking selected tyre…'}</p>
                  <ContactActions className="justify-center mb-4" />
                  <Link href="/tyres" className="btn btn-primary">Select Tyre from Catalogue</Link>
                </div>
              )}

              {/* Staggered rear toggle */}
              <div className="border border-line/70 p-4 rounded bg-surface-3/50">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasRearTyre}
                    onChange={(e) => {
                      setHasRearTyre(e.target.checked);
                      setRearTyre(null);
                    }}
                    className="mt-1 h-4 w-4 accent-brand"
                  />
                  <div>
                    <span className="text-sm font-bold block">My vehicle uses a different rear tyre size</span>
                    <span className="text-xs text-ink-3">Check this if your rear tyres are wider than the fronts.</span>
                  </div>
                </label>

                {hasRearTyre && (
                  <div className="mt-4 pt-4 border-t border-line space-y-3">
                    <label htmlFor="rear-tyre" className="label block">Select Rear Tyre Model</label>
                    <select
                      id="rear-tyre"
                      className="input"
                      value={rearTyre?.id ?? ''}
                      onChange={(e) => {
                        const found = allTyres.find((t) => t.id === e.target.value);
                        setRearTyre(found ?? null);
                      }}
                    >
                      <option value="">Choose a rear tyre matching your sidewall</option>
                      {allTyres.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.brand} {t.model} ({formatTyreSize(t)}) — {formatPrice(t.sell_price)} each
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-ink-2">Rear Quantity:</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label="Decrease rear tyre quantity"
                        onClick={() => setRearQuantity((q) => Math.max(1, q - 1))}
                          className="btn btn-secondary btn-sm h-11 w-11 p-0"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="mono font-bold px-2">{rearQuantity}</span>
                        <button
                          type="button"
                          aria-label="Increase rear tyre quantity"
                        onClick={() => setRearQuantity((q) => Math.min(4, q + 1))}
                          className="btn btn-secondary btn-sm h-11 w-11 p-0"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!tyresReady}
                className="btn btn-primary w-full"
              >
                Continue to Location &amp; Vehicle <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* ════════ STEP 2: LOCATION & VEHICLE ════════ */}
          {step === 2 && (
            <div className="card space-y-6">
              <div className="border-b border-line pb-4">
                <h2 className="text-xl font-bold">2. Service Location &amp; Vehicle</h2>
                <p className="text-sm text-ink-2">Where would you like our mobile workshop to meet you?</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="postcode" className="label mb-2 block">London Postcode *</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      id="postcode"
                      autoComplete="postal-code"
                      className="input uppercase min-w-0 flex-1"
                      placeholder="e.g. E14 5AB"
                      value={postcode}
                      onChange={(e) => { ++postcodeRequest.current; setPostcode(e.target.value); setZone(null); setValidatedPostcode(''); setIsCheckingPostcode(false); }}
                    />
                    <button
                      type="button"
                      onClick={() => validateLocation(postcode)}
                      disabled={isCheckingPostcode || postcode.length < 4}
                      className="btn btn-secondary btn-sm"
                    >
                      {isCheckingPostcode ? <Loader2 size={16} className="animate-spin" /> : 'Check Zone'}
                    </button>
                  </div>
                  {postcodeError && (
                    <div className="text-danger text-xs flex items-center gap-1.5 mt-2" role="alert">
                      <AlertCircle size={14} /> {postcodeError}
                    </div>
                  )}
                  {postcodeError && <ContactActions className="mt-3" />}
                  {zone && (
                    <div className="text-ok text-xs flex items-center gap-1.5 mt-2 font-semibold">
                      <CheckCircle2 size={14} /> Postcode accepted. Any applicable location charge will be shown before payment.
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-line">
                  <label htmlFor="vrm" className="label mb-2 block">Vehicle Registration</label>
                  <input
                    id="vrm"
                    className="input-vrm uppercase mb-3 max-w-sm"
                    placeholder="Vehicle registration (optional)"
                    maxLength={10}
                    value={registration}
                    onChange={(e) => setRegistration(e.target.value.toUpperCase())}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="make" className="label mb-1 block">Make</label>
                      <input
                        id="make"
                        className="input"
                        placeholder="Vehicle make (optional)"
                        value={vehicleMake}
                        onChange={(e) => setVehicleMake(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="model" className="label mb-1 block">Model</label>
                      <input
                        id="model"
                        className="input"
                        placeholder="Vehicle model (optional)"
                        value={vehicleModel}
                        onChange={(e) => setVehicleModel(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button type="button" onClick={() => setStep(1)} className="btn btn-secondary flex-1">
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!locationReady || !quote || quoteLoading}
                  className="btn btn-primary flex-1"
                >
                  {quoteLoading ? 'Checking price…' : 'Choose Fitting Slot'} <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ════════ STEP 3: CHOOSE SLOT ════════ */}
          {step === 3 && (
            <div className="card space-y-6">
              <div className="border-b border-line pb-4">
                <h2 className="text-xl font-bold">3. Select Appointment Slot</h2>
                <p className="text-sm text-ink-2">Choose an available date and fitting window.</p>
              </div>

              {/* Date Tabs */}
              <div>
                <label className="label mb-3 block flex items-center gap-2">
                  <Calendar size={14} className="text-brand" /> Select Date
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {availableDates.map((d) => {
                    const isSelected = selectedDate === d;
                    const dateObj = new Date(d);
                    const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'short' });
                    const dayNum = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setSelectedDate(d);
                          setSelectedSlot(null);
                        }}
                        className={`p-2.5 rounded border text-center transition-all ${
                          isSelected
                            ? 'bg-brand text-ink-inverse border-brand font-bold shadow-lg'
                            : 'bg-surface-3 border-line text-ink-2 hover:border-border-2 hover:text-ink-1'
                        }`}
                      >
                        <div className="text-xs uppercase">{dayName}</div>
                        <div className="text-sm font-bold mt-0.5">{dayNum}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Slots */}
              <div>
                <label className="label mb-3 block flex items-center gap-2">
                  <Clock size={14} className="text-brand" /> Fitting Window {selectedDate ? 'for ' + new Date(selectedDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
                </label>

                {isLoadingSlots ? (
                  <div className="py-8 text-center text-ink-3 flex items-center justify-center gap-2">
                    <Loader2 size={18} className="animate-spin text-brand" /> Loading available van slots...
                  </div>
                ) : slotsForSelectedDate.length === 0 ? (
                  <div><p className="text-sm text-ink-3 py-4">{slotsError ?? 'No fitting times are available. Please choose another day.'}</p><ContactActions /></div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {slotsForSelectedDate.map((s) => {
                      const isSelected = selectedSlot?.id === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={!s.available}
                          onClick={() => handleSelectSlot(s)}
                          className={`slot ${isSelected ? 'slot-selected' : s.available ? 'slot-available' : 'slot-full'}`}
                        >
                          <span className="text-sm font-bold">
                            {formatSlotTime(s.start_time)} – {formatSlotTime(s.end_time)}
                          </span>
                          <span className={`text-xs mt-1 ${isSelected ? 'text-ink-inverse font-semibold' : 'text-ok'}`}>
                            {isSelected ? 'Selected — reserved at checkout' : `${s.remaining} fitting time available`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {slotReady && (
                  <div className="mt-4 p-3 bg-brand/10 border border-brand/30 rounded flex items-center gap-2 text-xs text-brand">
                    <CheckCircle2 size={16} />
                    <span>Time selected. Your time and tyres will be reserved together when you submit your details.</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button type="button" onClick={() => setStep(2)} className="btn btn-secondary flex-1">
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  disabled={!slotReady}
                  className="btn btn-primary flex-1"
                >
                  Enter Contact Details <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ════════ STEP 4: CONTACT & FINAL CONFIRMATION ════════ */}
          {step === 4 && (
            <form onSubmit={handleProceedToPayment} className="card space-y-6">
              <div className="border-b border-line pb-4">
                <h2 className="text-xl font-bold">4. Customer Contact &amp; Fitting Address</h2>
                <p className="text-sm text-ink-2">Provide your contact info so the technician can call ahead on arrival.</p>
              </div>

              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="label mb-2 block">Full Name *</label>
                    <input
                      id="name"
                      autoComplete="name"
                      className="input"
                      placeholder="e.g. David Smith"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="label mb-2 block">Email Address *</label>
                    <input
                      id="email"
                      autoComplete="email"
                      type="email"
                      className="input"
                      placeholder="david@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="phone" className="label mb-2 block">UK Mobile Number *</label>
                    <input
                      id="phone"
                      autoComplete="tel"
                      type="tel"
                      className="input"
                      placeholder="Your UK mobile number"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="city" className="label mb-2 block">City</label>
                    <input
                      id="city"
                      autoComplete="address-level2"
                      className="input"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="address1" className="label mb-2 block">Fitting Street Address *</label>
                  <input
                    id="address1"
                      autoComplete="street-address"
                    className="input mb-2"
                    placeholder="e.g. 10 Park Lane"
                    required
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                  />
                  <input
                    aria-label="Apartment, suite or unit (optional)"
                    id="address2"
                      autoComplete="address-line2"
                    className="input"
                    placeholder="Apartment, suite, unit (optional)"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="notes" className="label mb-2 block">Fitting Location &amp; Access Notes</label>
                  <textarea
                    id="notes"
                    rows={2}
                    className="input resize-none text-sm"
                    placeholder="e.g. Driveway on left of house / underground office car park bay 12 / lock nut key in glovebox"
                    value={fittingNotes}
                    onChange={(e) => setFittingNotes(e.target.value)}
                  />
                </div>
              </div>

              {formError && (
                <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-xs flex items-center gap-2" role="alert">
                  <AlertCircle size={16} /> {formError}
                </div>
              )}
              {formError && <ContactActions className="mt-3" />}

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-line">
                <button type="button" onClick={() => setStep(3)} className="btn btn-secondary flex-1">
                  <ArrowLeft size={16} /> Back to Slots
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !quote || !slotReady || !locationReady || !tyresReady}
                  className="btn btn-primary flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Reserving Booking...
                    </>
                  ) : (
                    <>
                      Reserve for Bank Payment <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right Column: Sticky Live Order Summary */}
        <div className="card lg:sticky lg:top-24 space-y-6 border-border-brand/40 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <h3 className="text-base font-bold uppercase tracking-wider">Order Summary</h3>
            <span className="badge badge-info">Fitted Mobile</span>
          </div>

          {/* Selected Tyre Items */}
          <div className="space-y-3 text-sm">
            {selectedTyre && (
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-ink-1">
                    {quantity} × {selectedTyre.brand} {selectedTyre.model}
                  </div>
                  <div className="text-xs text-ink-3">{formatTyreSize(selectedTyre)}</div>
                </div>
                <span className="mono font-semibold">{price(frontTotal)}</span>
              </div>
            )}

            {hasRearTyre && rearTyre && (
              <div className="flex items-start justify-between gap-2 pt-2 border-t border-line/40">
                <div>
                  <div className="font-semibold text-ink-1">
                    {rearQuantity} × {rearTyre.brand} {rearTyre.model} (Rear)
                  </div>
                  <div className="text-xs text-ink-3">{formatTyreSize(rearTyre)}</div>
                </div>
                <span className="mono font-semibold">{price(rearTotal)}</span>
              </div>
            )}

            {/* Mobile fitting fee */}
            <div className="flex items-center justify-between text-xs text-ink-2 pt-2 border-t border-line/40">
              <span>Mobile van fitting &amp; balance</span>
              <span className="mono font-semibold text-ink-1">{price(quote?.fitting_fee)}</span>
            </div>

            {/* Callout fee */}
            <div className="flex items-center justify-between text-xs text-ink-2">
              <span>London area call-out</span>
              <span className="mono font-semibold text-ink-1">
                {price(quote?.callout_charge)}
              </span>
            </div>
          </div>

          {/* Total & Deposit Breakdown */}
          <div className="border-t border-line pt-4 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold text-ink-1">Total Fitted Amount</span>
              <span className="price-display text-xl">{price(quote?.total_amount)}</span>
            </div>
            <div className="flex items-baseline justify-between text-ok font-semibold text-sm">
              <span>Deposit required at payment</span>
              <span className="mono">{price(quote?.deposit_amount)}</span>
            </div>
            <div className="flex items-baseline justify-between text-xs text-ink-2 pt-1 border-t border-line/40">
              <span>Remaining Balance (Due on Fitting Day)</span>
              <span className="mono font-semibold text-ink-1">{price(quote?.balance_due)}</span>
            </div>
          </div>

          {/* Appointment Preview */}
          {selectedSlot && (
            <div className="p-3 bg-surface-3 rounded border border-line text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-ink-1">
                <Clock size={14} className="text-brand" />
                {new Date(selectedSlot.slot_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, {formatSlotTime(selectedSlot.start_time)}–{formatSlotTime(selectedSlot.end_time)}
              </div>
              {postcode && (
                <div className="flex items-center gap-1.5 text-ink-2">
                  <MapPin size={14} className="text-brand" />
                  {postcode.toUpperCase()}{zone ? ' (' + zone.zone_name + ')' : ''}
                </div>
              )}
            </div>
          )}

          {quoteError && <p role="alert" className="text-sm text-danger">{quoteError}</p>}
          {!quote && !quoteError && <p className="text-xs text-ink-2" role="status">{quoteLoading ? 'Checking price…' : 'Confirm your tyres and fitting area to check the complete price.'}</p>}
          <p className="text-xs text-ink-2">Pay by manual bank transfer. Your payment deadline appears after the reservation is confirmed. A quote or selected time does not reserve a booking.</p>
        </div>
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="container-g section text-center py-20"><Loader2 size={32} className="animate-spin mx-auto text-brand" /></div>}>
      <BookingWizard />
    </Suspense>
  );
}
