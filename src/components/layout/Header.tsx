'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Menu, X } from 'lucide-react';
import BrandLogo from '@/components/layout/BrandLogo';
import { ContactActions } from '@/components/layout/BusinessContact';

const NAV = [
  { href: '/#tyre-finder', label: 'Find tyres' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/coverage', label: 'Fitting locations' },
  { href: '/tyres', label: 'Tyres' },
  { href: '/guides', label: 'Guides' },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);

  function handleBrandClick(event: MouseEvent<HTMLAnchorElement>) {
    setOpen(false);
    if (pathname !== '/') return;
    event.preventDefault();
    window.history.replaceState(window.history.state, '', '/');
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  useEffect(() => {
    if (!open) return;
    const trigger = menuButton.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawer.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key !== 'Tab') return;
      const elements = drawer.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)');
      if (!elements?.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const closeOnDesktop = () => { if (window.innerWidth >= 1024) setOpen(false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', closeOnDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', closeOnDesktop);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <header className="site-header sticky top-0 z-50 border-b border-line">
        <div className="container-g flex min-h-[68px] items-center justify-between gap-3">
          <Link href="/" onClick={handleBrandClick} aria-label="G Force Tyres home" className="inline-flex min-h-11 shrink-0 items-center rounded">
            <BrandLogo priority sizes="(max-width: 639px) 104px, 118px" className="w-[104px] sm:w-[118px]" />
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-4 xl:gap-6 lg:flex">
            {NAV.map((link) => (
              <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center text-sm text-ink-2 hover:text-ink-1">
                {link.label}
              </Link>
            ))}
            <ContactActions className="header-contact-actions" />
            <Link href="/#tyre-finder" className="btn btn-primary btn-sm" data-critical-action>Start booking</Link>
          </nav>
          <div className="flex items-center gap-2 lg:hidden">
            <Link href="/#tyre-finder" className="mobile-header-cta" data-critical-action>Find tyres</Link>
            <button ref={menuButton} onClick={() => setOpen(true)} className="flex h-11 w-11 items-center justify-center text-ink-1 rounded" aria-label="Open navigation menu" aria-expanded={open} aria-controls={open ? 'mobile-navigation' : undefined}>
              <Menu size={23} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>
      {open && (
        <div ref={drawer} id="mobile-navigation" role="dialog" aria-modal="true" aria-label="Navigation" className="fixed inset-0 z-[60] overflow-y-auto bg-surface lg:hidden">
          <div className="container-g flex min-h-[68px] items-center justify-between border-b border-line">
            <Link href="/" onClick={handleBrandClick} aria-label="G Force Tyres home" className="inline-flex min-h-11 items-center">
              <BrandLogo sizes="116px" className="w-[116px]" />
            </Link>
            <button onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded" aria-label="Close navigation menu"><X size={24} aria-hidden="true" /></button>
          </div>
          <nav aria-label="Mobile navigation" className="container-g flex flex-col gap-2 py-6">
            {NAV.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="display-2 min-h-11 py-3 hover:text-brand">{link.label}</Link>
            ))}
            <Link href="/#tyre-finder" onClick={() => setOpen(false)} className="btn btn-primary mt-4 w-full" data-critical-action>Start tyre search</Link>
            <ContactActions className="mt-3" onAction={() => setOpen(false)} />
          </nav>
          <p className="container-g border-t border-line py-6 text-sm text-ink-2">Enter the tyre size from your sidewall.</p>
        </div>
      )}
    </>
  );
}
