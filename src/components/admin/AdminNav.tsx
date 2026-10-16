'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Package,
  Warehouse,
  Clock,
  MapPin,
  Truck,
  Users,
  CreditCard,
  Settings,
  ShieldCheck,
  KeyRound,
  LogOut,
  Wrench,
} from 'lucide-react';

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function signOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      const response = await fetch('/api/admin/logout', { method: 'POST' });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error();
      router.replace('/admin/login');
      router.refresh();
    } catch {
      setSignOutError('Sign out could not be confirmed. Please try again.');
    } finally { setIsSigningOut(false); }
  }

  const links = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/bookings', label: 'Bookings', icon: Calendar },
    { href: '/admin/products', label: 'Products', icon: Package },
    { href: '/admin/inventory', label: 'Inventory', icon: Warehouse },
    { href: '/admin/slots', label: 'Slots', icon: Clock },
    { href: '/admin/zones', label: 'Zones', icon: MapPin },
    { href: '/admin/fitters', label: 'Fitters', icon: Truck },
    { href: '/admin/customers', label: 'Customers', icon: Users },
    { href: '/admin/payments', label: 'Payments', icon: CreditCard },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
    { href: '/admin/audit', label: 'Audit', icon: ShieldCheck },
    { href: '/admin/access', label: 'Access', icon: KeyRound },
  ];

  return (
    <div className="flex flex-col gap-4 border-b border-line pb-4 mb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-brand/10 text-brand border border-brand/30">
            <Wrench size={18} />
          </span>
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-3 font-bold">Dispatch Console</div>
            <div className="text-base font-bold text-ink-1">G Force Operations</div>
          </div>
        </div>
        <button
          type="button"
          onClick={signOut}
          disabled={isSigningOut}
          className="hidden sm:flex min-h-11 items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase text-ink-3 hover:text-danger rounded transition-colors disabled:opacity-60"
        >
          <LogOut size={14} /> {isSigningOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>

      {signOutError && <p role="alert" className="text-sm text-danger">{signOutError}</p>}
      <nav aria-label="Admin" className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap no-scrollbar">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex shrink-0 min-h-10 items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider rounded transition-colors ${
                isActive
                  ? 'bg-brand text-ink-inverse'
                  : 'bg-surface-3 text-ink-2 hover:text-ink-1 hover:bg-surface-4'
              }`}
            >
              <Icon size={14} />
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={signOut}
          disabled={isSigningOut}
          className="flex sm:hidden shrink-0 min-h-10 items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase text-ink-3 hover:text-danger rounded transition-colors disabled:opacity-60"
        >
          <LogOut size={14} /> {isSigningOut ? 'Signing out…' : 'Sign out'}
        </button>
      </nav>
    </div>
  );
}
