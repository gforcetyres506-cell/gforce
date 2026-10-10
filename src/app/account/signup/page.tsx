'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import MStripe from '@/components/ui/MStripe';

export default function CustomerSignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [registrationMessage, setRegistrationMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your password.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      // 1. Create account
      const res = await fetch('/api/account/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          password,
          address,
          postcode,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.message || 'Registration failed. Please review your details.');
        setIsSubmitting(false);
        return;
      }

      setRegistrationMessage(data.message);
    } catch {
      setError('Connection issue during registration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container-g section max-w-lg py-12">
      <MStripe className="mb-6 mx-auto" />

      <div className="text-center mb-8">
        <p className="label mb-1 text-brand">Customer Registration</p>
        <h1 className="display-1">CREATE ACCOUNT</h1>
        <p className="text-xs text-ink-3">Save vehicles, track bookings, and book mobile tyre fitting faster</p>
      </div>

      <div className="card space-y-6 border-line bg-surface/80 backdrop-blur shadow-2xl">
        {registrationMessage && <div role="status" className="text-sm text-ink-2">{registrationMessage} <Link href="/account/login" className="text-brand underline">Go to sign in</Link></div>}
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reg-name" className="label mb-2 block">Full Name *</label>
              <input
                id="reg-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sarah Jenkins"
                required
                className="input w-full"
              />
            </div>
            <div>
              <label htmlFor="reg-phone" className="label mb-2 block">Mobile Phone *</label>
              <input
                id="reg-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Your UK mobile number"
                required
                className="input w-full"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-email" className="label mb-2 block">Email Address *</label>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sarah@example.com"
              required
              className="input w-full"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reg-password" className="label mb-2 block">Password (min 8 chars) *</label>
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="input w-full"
              />
            </div>
            <div>
              <label htmlFor="reg-confirm" className="label mb-2 block">Confirm Password *</label>
              <input
                id="reg-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="input w-full"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-line/60">
            <p className="text-xs text-ink-3 mb-3">Optional: Default Fitting Address (can be changed per booking)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label htmlFor="reg-address" className="label mb-1 block">Street Address</label>
                <input
                  id="reg-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="10 Marsh Wall"
                  className="input w-full text-xs"
                />
              </div>
              <div>
                <label htmlFor="reg-pc" className="label mb-1 block">Postcode</label>
                <input
                  id="reg-pc"
                  type="text"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                  placeholder="E14 9GE"
                  className="input w-full text-xs"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary w-full justify-center gap-2 mt-4"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating your account...
              </>
            ) : (
              <>
                Complete Registration
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-line text-center text-xs text-ink-2">
          Already have an account?{' '}
          <Link href="/account/login" className="text-brand font-semibold hover:underline">
            Sign in here
          </Link>
        </div>
      </div>
    </div>
  );
}
