'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  Car,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  LogOut,
  Wrench,
  ChevronRight,
  ExternalLink,
  PlusCircle,
  Package,
} from 'lucide-react';
import MStripe from '@/components/ui/MStripe';
import { formatPrice, formatSlotTime, formatReg } from '@/lib/utils';
import type { BookingWithDetails } from '@/types';

interface CustomerAccountData {
  user: {
    id: string;
    email: string;
    name: string;
    phone: string;
  };
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
    address_line1?: string;
    postcode?: string;
  } | null;
  bookings: BookingWithDetails[];
  vehicles: Array<{
    reg: string;
    make: string;
    model: string;
    lastUsed: string;
  }>;
}

export default function CustomerAccountDashboard() {
  const router = useRouter();
  const [data, setData] = useState<CustomerAccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/account/me')
      .then((r) => {
        if (r.status === 401) {
          router.replace('/account/login');
          return null;
        }
        return r.json();
      })
      .then((res) => {
        if (res && res.ok && res.data) {
          setData(res.data);
        } else if (res) {
          setAccountError('Account service unavailable. Please try again later.');
        }
      })
      .catch(() => {
        setAccountError('Account service unavailable. Please try again later.');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      const response = await fetch('/api/account/logout', { method: 'POST' });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error();
      router.push('/');
      router.refresh();
    } catch {
      setAccountError('Sign out could not be confirmed. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <div className="container-g section text-center py-24">
        <Loader2 size={36} className="animate-spin mx-auto text-brand mb-4" />
        <p className="text-sm text-ink-3">Loading your account...</p>
      </div>
    );
  }

  if (!data) return <div className="container-g section"><p role="alert">{accountError ?? 'Account service unavailable.'}</p></div>;

  const activeBookings = data.bookings.filter(
    (b) => !['completed', 'cancelled', 'refunded'].includes(b.status),
  );
  const pastBookings = data.bookings.filter((b) =>
    ['completed', 'cancelled', 'refunded'].includes(b.status),
  );

  return (
    <div className="container-g section py-10 space-y-10">
      <MStripe className="mb-2" />
      {accountError && <p role="alert" className="text-sm text-danger">{accountError}</p>}

      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-line">
        <div>
          <span className="label text-brand">Customer Portal</span>
          <h1 className="display-1 mt-1">
            {data.user.name ? `WELCOME, ${data.user.name.toUpperCase()}` : 'MY ACCOUNT'}
          </h1>
          <p className="text-xs text-ink-3 mt-1 flex items-center gap-2">
            <span>{data.user.email}</span>
            {data.user.phone && (
              <>
                <span>•</span>
                <span>{data.user.phone}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/booking" className="btn btn-primary btn-sm flex items-center gap-1.5">
            <PlusCircle size={15} /> Book Mobile Fitting
          </Link>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="btn btn-secondary btn-sm flex items-center gap-1.5 text-ink-2 hover:text-rose-400"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card border-line/60 bg-surface/50 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-3 font-semibold uppercase tracking-wider">Active Fittings</span>
            <Clock size={16} className="text-amber-400" />
          </div>
          <p className="text-3xl font-black mt-2 text-ink-1">{activeBookings.length}</p>
        </div>
        <div className="card border-line/60 bg-surface/50 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-3 font-semibold uppercase tracking-wider">Saved Vehicles</span>
            <Car size={16} className="text-brand" />
          </div>
          <p className="text-3xl font-black mt-2 text-ink-1">{data.vehicles.length}</p>
        </div>
        <div className="card border-line/60 bg-surface/50 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-3 font-semibold uppercase tracking-wider">Completed Jobs</span>
            <CheckCircle2 size={16} className="text-emerald-400" />
          </div>
          <p className="text-3xl font-black mt-2 text-ink-1">
            {data.bookings.filter((b) => b.status === 'completed').length}
          </p>
        </div>
      </div>

      {/* Section 1: Upcoming / Active Appointments */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-1 flex items-center gap-2">
            <Calendar size={18} className="text-brand" /> Upcoming Appointments
          </h2>
        </div>

        {activeBookings.length === 0 ? (
          <div className="card border-line bg-surface/40 p-8 text-center space-y-3">
            <p className="text-ink-2 text-sm">No active mobile fitting appointments scheduled right now.</p>
            <Link href="/booking" className="btn btn-primary btn-sm inline-flex items-center gap-1.5">
              Book a mobile tyre fitting
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeBookings.map((b) => (
              <div key={b.id} className="card border-line border-l-4 border-l-brand p-5 space-y-4 shadow-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-brand">{b.booking_ref}</span>
                    <h3 className="font-bold text-ink-1 text-base mt-0.5">
                      {b.vehicle_make} {b.vehicle_model}
                    </h3>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded bg-surface-2 font-mono text-xs font-semibold text-ink-1 border border-line">
                      {formatReg(b.vehicle_reg ?? '')}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {b.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="text-xs text-ink-2 space-y-1.5 pt-2 border-t border-line/60">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-ink-3" />
                    <span>Date: {b.slot?.slot_date ?? 'Not confirmed'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-ink-3" />
                    <span>
                      Window: {b.slot?.start_time ? `${formatSlotTime(b.slot.start_time)} - ${formatSlotTime(b.slot.end_time)}` : 'Standard'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-ink-3" />
                    <span>Fitting Location: {b.fitting_address}, {b.fitting_postcode}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-line/60 flex items-center justify-between">
                  <span className="text-xs text-ink-3">
                    {b.items?.length ?? 0} tyre(s) • Total: {formatPrice(b.total_amount)}
                  </span>
                  <Link
                    href={`/manage/${b.manage_token}`}
                    className="btn btn-secondary btn-sm text-xs flex items-center gap-1"
                  >
                    Track & Manage <ExternalLink size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Saved Vehicles */}
      {data.vehicles.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-ink-1 flex items-center gap-2">
            <Car size={18} className="text-brand" /> Saved Vehicles
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {data.vehicles.map((v) => (
              <div key={v.reg} className="card border-line p-4 flex items-center justify-between bg-surface/50">
                <div>
                  <div className="font-mono text-xs font-black text-ink-1 px-2 py-0.5 rounded bg-surface-2 border border-line inline-block mb-1">
                    {formatReg(v.reg)}
                  </div>
                  <p className="text-xs font-semibold text-ink-1">{v.make} {v.model}</p>
                </div>
                <Link
                  href={`/booking?reg=${encodeURIComponent(v.reg)}`}
                  className="btn btn-secondary btn-sm text-xs font-semibold"
                >
                  Book tyres
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 3: Past Booking History */}
      {pastBookings.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-ink-1 flex items-center gap-2">
            <Package size={18} className="text-ink-3" /> Past Fittings & Invoices
          </h2>
          <div className="card border-line p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2 border-b border-line text-ink-3 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">Reference</th>
                    <th className="p-3.5">Vehicle</th>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Tyres</th>
                    <th className="p-3.5">Order total</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {pastBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-surface-2/40 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-brand">{b.booking_ref}</td>
                      <td className="p-3.5 font-semibold text-ink-1">
                        {formatReg(b.vehicle_reg ?? '')} ({b.vehicle_make})
                      </td>
                      <td className="p-3.5 text-ink-2">{b.slot?.slot_date ?? b.created_at.split('T')[0]}</td>
                      <td className="p-3.5 text-ink-2">
                        {b.items?.map((it) => `${it.quantity}x ${it.tyre_label}`).join(', ') || 'Tyres'}
                      </td>
                      <td className="p-3.5 font-bold text-ink-1">{formatPrice(b.total_amount)}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                          b.status === 'completed'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <Link
                          href={`/manage/${b.manage_token}`}
                          className="text-brand hover:underline inline-flex items-center gap-1 font-semibold"
                        >
                          View <ChevronRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
