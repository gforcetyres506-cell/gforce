'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CreditCard,
  Lock,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Car,
  MapPin,
  ArrowLeft,
} from 'lucide-react';
import MStripe from '@/components/ui/MStripe';
import { formatPrice, formatSlotTime, formatReg } from '@/lib/utils';
import type { BookingWithDetails } from '@/types';
import { isMockDataEnabled } from '@/lib/mock-mode';

function PaymentPageContent() {
  const mockMode = isMockDataEnabled();
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingRef = searchParams.get('ref') || '';

  const [bookingData, setBookingData] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60); // 15 minutes in seconds
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Card form mock state
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardName, setCardName] = useState('');

  useEffect(() => {
    if (!mockMode) return;
    // Load from sessionStorage if available
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('gf_checkout_data');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setBookingData(parsed);
          setCardName(parsed.customer?.name || '');
        } catch {
          // ignore
        }
      }
    }
  }, [mockMode]);

  // 15-minute countdown timer
  useEffect(() => {
    if (!mockMode) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [mockMode]);

  if (!mockMode) {
    return (
      <div className="container-g section max-w-2xl text-center">
        <MStripe className="mb-6 mx-auto" />
        <h1 className="display-2">PAYMENTS ARE NOT LIVE YET</h1>
        <p className="mt-3 text-sm text-ink-2">
          No card details can be entered until the verified Stripe Checkout flow is implemented in Phase 3.
        </p>
        <Link href="/" className="btn btn-secondary mt-6">Return to homepage</Link>
      </div>
    );
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const progressPercent = (timeLeft / (15 * 60)) * 100;

  // Breakdown values
  const breakdown = bookingData?.breakdown;
  const depositAmount = breakdown?.deposit_amount ?? 5000;
  const totalAmount = breakdown?.total_amount ?? 31800;
  const balanceDue = breakdown?.balance_due ?? (totalAmount - depositAmount);

  async function handleCompletePayment(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setIsProcessing(true);
    setError(null);

    try {
      // Call mock confirmation endpoint
      const res = await fetch('/api/checkout/confirm-mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_ref: bookingRef }),
      });
      const data = await res.json();

      if (data.ok) {
        router.push(`/confirmation/${bookingRef}`);
      } else {
        setError('Payment could not be confirmed. No booking has been completed.');
      }
    } catch {
      setError('Payment could not be confirmed. No booking has been completed.');
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="container-g section max-w-4xl">
      <MStripe className="mb-6" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <p className="label mb-1 text-brand">Secure Checkout</p>
          <h1 className="display-1">PAY HOLD DEPOSIT</h1>
          <p className="mono text-sm text-ink-3">Ref: {bookingRef}</p>
        </div>

        {/* 15-min Slot Hold Countdown Pill */}
        <div className="card bg-surface-3/80 border-border-brand/40 py-3 px-5 flex flex-col items-center justify-center shrink-0">
          <div className="flex items-center gap-2 text-warning font-bold text-sm">
            <Clock size={16} className="animate-pulse" /> Slot Hold: {timeFormatted}
          </div>
          <div className="w-32 bg-surface-4 h-1.5 rounded-full overflow-hidden mt-1.5">
            <div
              className="bg-warning h-full transition-all duration-1000"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8 items-start">
        {/* Payment Card Section */}
        <div className="card space-y-6">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div className="flex items-center gap-2 font-bold text-base">
              <CreditCard size={20} className="text-brand" /> Card Payment
            </div>
            <span className="flex items-center gap-1 text-xs text-ok font-semibold">
              <Lock size={14} /> 256-Bit Encrypted
            </span>
          </div>

          <form onSubmit={handleCompletePayment} className="space-y-4">
            <div>
              <label htmlFor="cardname" className="label mb-2 block">Name on Card *</label>
              <input
                id="cardname"
                className="input"
                placeholder="David Smith"
                required
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="cardnum" className="label mb-2 block">Card Number *</label>
              <div className="relative">
                <input
                  id="cardnum"
                  className="input mono pr-10"
                  placeholder="4242 •••• •••• 4242"
                  required
                  maxLength={19}
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                />
                <CreditCard size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="expiry" className="label mb-2 block">Expiry Date *</label>
                <input
                  id="expiry"
                  className="input mono"
                  placeholder="MM / YY"
                  required
                  maxLength={5}
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="cvc" className="label mb-2 block">CVC / CVV *</label>
                <input
                  id="cvc"
                  type="password"
                  className="input mono"
                  placeholder="123"
                  required
                  maxLength={4}
                  value={cardCvc}
                  onChange={(e) => setCardCvc(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-xs flex items-center gap-2">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isProcessing || timeLeft === 0}
              className="btn btn-primary w-full mt-4"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Authorising Deposit...
                </>
              ) : (
                <>
                  Pay {formatPrice(depositAmount)} Deposit &amp; Confirm Booking
                </>
              )}
            </button>
          </form>

          {/* Quick Dev/Test 1-Click Button */}
          <div className="p-4 bg-brand/5 border border-brand/20 rounded space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-brand uppercase tracking-wider">Local Test Mode</span>
              <span className="badge badge-info text-xs">Local test only</span>
            </div>
            <p className="text-xs text-ink-2">
              Simulate the development-only confirmation path without collecting card data.
            </p>
            <button
              type="button"
              onClick={() => handleCompletePayment()}
              disabled={isProcessing}
              className="btn btn-secondary w-full btn-sm text-xs font-semibold"
            >
              {isProcessing ? <Loader2 size={14} className="animate-spin" /> : 'Run local test confirmation'}
            </button>
          </div>
        </div>

        {/* Order Details & Deposit Summary */}
        <div className="space-y-6">
          <div className="card space-y-4 border-border-brand/30">
            <h3 className="text-sm font-bold uppercase tracking-wider border-b border-line pb-3">
              Payment Breakdown
            </h3>

            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between text-ink-2">
                <span>Total Fitted Price</span>
                <span className="mono font-semibold text-ink-1">{formatPrice(totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-ok font-bold">
                <span>Deposit Payable Now</span>
                <span className="mono">{formatPrice(depositAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-ink-2 pt-2 border-t border-line/40">
                <span>Balance on Fitting Day</span>
                <span className="mono font-semibold text-ink-1">{formatPrice(balanceDue)}</span>
              </div>
            </div>

            {bookingData?.customer && (
              <div className="p-3 bg-surface-3 rounded border border-line text-xs space-y-1.5 mt-4">
                <div className="font-bold text-ink-1">{bookingData.customer.name}</div>
                <div className="text-ink-2">{bookingData.customer.email} · {bookingData.customer.phone}</div>
                <div className="text-ink-3 flex items-center gap-1 mt-1">
                  <MapPin size={12} className="text-brand" />
                  {bookingData.customer.addressLine1}, {bookingData.customer.postcode}
                </div>
              </div>
            )}
          </div>

          <div className="card bg-surface-2/60 space-y-3 text-xs text-ink-2">
            <div className="flex items-start gap-2.5">
              <ShieldCheck size={18} className="text-brand shrink-0 mt-0.5" />
              <div>
                <strong className="text-ink-1 block">Free Cancellation Guarantee</strong>
                Cancel or reschedule anytime up to 48 hours before your slot for a 100% full deposit refund.
              </div>
            </div>
            <div className="flex items-start gap-2.5 pt-2 border-t border-line/50">
              <CheckCircle2 size={18} className="text-brand shrink-0 mt-0.5" />
              <div>
                <strong className="text-ink-1 block">Contactless Mobile Workshop</strong>
                Pay remaining balance seamlessly via chip &amp; pin card reader on fitting completion.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookingPayPage() {
  return (
    <Suspense fallback={<div className="container-g section text-center py-20"><Loader2 size={32} className="animate-spin mx-auto text-brand" /></div>}>
      <PaymentPageContent />
    </Suspense>
  );
}
