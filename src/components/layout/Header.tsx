'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type MouseEvent } from 'react';
import { Menu, X, Wrench, User } from 'lucide-react';
import BrandLogo from '@/components/layout/BrandLogo';

const NAV = [
  { href: '/#tyre-finder', label: 'Find tyres' },
  { href: '/#how',      label: 'How it works' },
  { href: '/#coverage', label: 'Fitting locations' },
  { href: '/tyres',     label: 'Tyres' },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [customer, setCustomer] = useState<{ name: string; email: string } | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/account/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res?.ok && res?.data?.user) {
          setCustomer(res.data.user);
        } else {
          setCustomer(null);
        }
      })
      .catch(() => setCustomer(null));
  }, [pathname]);

  function handleBrandClick(event: MouseEvent<HTMLAnchorElement>) {
    setOpen(false);

    // A normal Link handles navigation from every other route. On the home
    // route, explicitly clear any section hash and return to the top so the
    // brand mark never feels like an inert link.
    if (pathname !== '/') return;

    event.preventDefault();
    window.history.replaceState(window.history.state, '', '/');
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  }

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <header className="site-header sticky top-0 z-50 border-b border-line">
        <div className="container-g flex h-[68px] items-center justify-between">
          <Link
            href="/"
            onClick={handleBrandClick}
            aria-label="G Force Tyres home"
            className="inline-flex shrink-0 items-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 focus-visible:ring-offset-surface"
          >
            <BrandLogo
              priority
              sizes="(max-width: 359px) 92px, (max-width: 639px) 104px, 118px"
              className="w-[92px] min-[360px]:w-[104px] sm:w-[118px]"
            />
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-ink-2 transition-colors hover:text-ink-1 focus:text-brand"
              >
                {l.label}
              </Link>
            ))}
            {customer ? (
              <Link
                href="/account"
                className="text-xs font-semibold px-2.5 py-1.5 rounded bg-surface-2 border border-line text-ink-1 hover:border-brand flex items-center gap-1.5 transition-colors"
              >
                <User size={13} className="text-brand" />
                <span>{customer.name ? customer.name.split(' ')[0] : 'My Account'}</span>
              </Link>
            ) : (
              <Link
                href="/account/login"
                className="text-xs text-ink-2 hover:text-ink-1 flex items-center gap-1.5 transition-colors"
              >
                <User size={13} /> Sign in
              </Link>
            )}
            <Link href="/admin/bookings" className="text-xs text-ink-3 hover:text-brand flex items-center gap-1">
              <Wrench size={13} /> Staff
            </Link>
            <Link href="/booking" className="btn btn-primary btn-sm">
              Start booking
            </Link>
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <Link href="/#tyre-finder" className="mobile-header-cta">
              Find tyres
            </Link>
            <button
              onClick={() => setOpen(true)}
              className="flex h-11 w-11 items-center justify-center text-ink-1 rounded focus:ring-2 focus:ring-brand"
              aria-label="Open navigation menu"
            >
              <Menu size={23} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {open && (
        <div className="fixed inset-0 z-[60] bg-surface flex flex-col justify-between md:hidden animate-in fade-in duration-200">
          <div>
            <div className="container-g flex h-[68px] items-center justify-between border-b border-line">
              <Link
                href="/"
                onClick={handleBrandClick}
                aria-label="G Force Tyres home"
                className="inline-flex shrink-0 items-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <BrandLogo sizes="116px" className="w-[116px]" />
              </Link>
              <button
                onClick={() => setOpen(false)}
                className="flex h-11 w-11 items-center justify-center text-ink-1 rounded focus:ring-2 focus:ring-brand"
                aria-label="Close navigation menu"
              >
                <X size={24} />
              </button>
            </div>
            <nav className="container-g flex flex-col gap-2 pt-8">
              {NAV.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="display-2 py-3 transition-colors hover:text-brand"
                >
                  {l.label}
                </Link>
              ))}
              {customer ? (
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="display-2 py-3 transition-colors hover:text-brand flex items-center gap-2"
                >
                  <User size={24} className="text-brand" /> My Account
                </Link>
              ) : (
                <Link
                  href="/account/login"
                  onClick={() => setOpen(false)}
                  className="display-2 py-3 transition-colors hover:text-brand flex items-center gap-2"
                >
                  <User size={24} /> Sign in
                </Link>
              )}
              <Link
                href="/#tyre-finder"
                onClick={() => setOpen(false)}
                className="btn btn-primary mt-6 w-full"
              >
                Start tyre search
              </Link>
            </nav>
          </div>

          <div className="container-g pb-8 border-t border-line pt-6 text-xs text-ink-3 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <span>Location-first mobile tyre booking</span>
              <Link
                href="/admin/login"
                onClick={() => setOpen(false)}
                className="text-brand font-semibold hover:underline"
              >
                Operator Login &rarr;
              </Link>
            </div>
            <div>Use registration lookup or enter the tyre size manually.</div>
          </div>
        </div>
      )}
    </>
  );
}
