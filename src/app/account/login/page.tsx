'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, AlertCircle, Loader2, KeyRound, UserPlus } from 'lucide-react';
import MStripe from '@/components/ui/MStripe';

export default function CustomerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/account/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.message || 'Unable to sign in. Please check your email and password.');
        return;
      }

      router.push('/account');
      router.refresh();
    } catch {
      setError('Connection issue. Please check your internet and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container-g section max-w-md py-12">
      <MStripe className="mb-6 mx-auto" />

      <div className="text-center mb-8">
        <p className="label mb-1 text-brand">Customer Portal</p>
        <h1 className="display-1">SIGN IN</h1>
        <p className="text-xs text-ink-3">Track appointments, manage bookings & view saved vehicles</p>
      </div>

      <div className="card space-y-6 border-line bg-surface/80 backdrop-blur shadow-2xl">
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="cust-email" className="label mb-2 block">Email Address</label>
            <input
              id="cust-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="input w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="cust-password" className="label block">Password</label>
            </div>
            <input
              id="cust-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
              className="input w-full"
            />
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
            className="btn btn-primary w-full justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Sign in to your account
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-line flex flex-col gap-3 text-center text-xs text-ink-2">
          <div>
            Don&apos;t have an account yet?{' '}
            <Link href="/account/signup" className="text-brand font-semibold hover:underline inline-flex items-center gap-1">
              <UserPlus size={13} /> Create an account
            </Link>
          </div>
          <div className="text-ink-3">
            Booked as a guest? You can also check your appointment using the link in your email or{' '}
            <Link href="/booking" className="text-ink-1 hover:underline">
              start a new booking
            </Link>.
          </div>
        </div>
      </div>
    </div>
  );
}
