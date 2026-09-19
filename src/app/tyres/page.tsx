import Link from 'next/link';
import { getTyres } from '@/lib/db';
import { formatPrice, formatTyreSize } from '@/lib/utils';
import MStripe from '@/components/ui/MStripe';
import { ShieldCheck, Zap, Fuel, Volume2 } from 'lucide-react';
import type { Tyre } from '@/types';

export const revalidate = 60;

interface Props {
  // Next 15: searchParams is a Promise
  searchParams: Promise<{ w?: string; p?: string; r?: string; pc?: string; reg?: string; tier?: string; season?: string }>;
}

export default async function TyresPage({ searchParams }: Props) {
  const sp = await searchParams;
  const width = sp.w ? Number(sp.w) : undefined;
  const profile = sp.p ? Number(sp.p) : undefined;
  const rim = sp.r ? Number(sp.r) : undefined;
  const filterTier = sp.tier;
  const filterSeason = sp.season;

  const tyres = await getTyres({
    width,
    profile,
    rim,
    tier: filterTier,
    season: filterSeason,
  });

  const qs = new URLSearchParams({
    ...(sp.w && { w: sp.w }),
    ...(sp.p && { p: sp.p }),
    ...(sp.r && { r: sp.r }),
    ...(sp.pc && { pc: sp.pc }),
    ...(sp.reg && { reg: sp.reg }),
  });

  return (
    <div className="container-g section">
      <MStripe className="mb-6" />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <p className="label mb-2">Tyre options</p>
          <h1 className="display-1">
            {width && profile && rim ? (
              <>
                {width}/{profile} <span className="text-brand">R{rim}</span>
              </>
            ) : (
              <>
                BROWSE BY <span className="text-brand">TYRE SIZE</span>
              </>
            )}
          </h1>
          <p className="text-ink-2 mt-2">
            {tyres.length === 0
              ? 'No tyres matching your current filter.'
              : `${tyres.length} ${tyres.length === 1 ? 'option' : 'options'} matching this tyre size.`}
          </p>
        </div>

        {/* Quick size pill selector if browsing general catalogue */}
        {!width && (
          <div className="flex flex-wrap gap-2">
            {[
              { label: '225/45 R18', w: '225', p: '45', r: '18' },
              { label: '205/55 R16', w: '205', p: '55', r: '16' },
              { label: '195/65 R15', w: '195', p: '65', r: '15' },
              { label: '255/40 R18 (Rear)', w: '255', p: '40', r: '18' },
            ].map((s) => (
              <Link
                key={s.label}
                href={`/tyres?w=${s.w}&p=${s.p}&r=${s.r}`}
                className="btn btn-secondary btn-sm"
              >
                {s.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-y border-line py-4 mb-10 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-ink-3">Tier:</span>
          {[
            { id: 'all', label: 'All Tiers' },
            { id: 'premium', label: 'Premium' },
            { id: 'mid', label: 'Mid-Range' },
            { id: 'budget', label: 'Budget' },
          ].map((tab) => {
            const active = (!filterTier && tab.id === 'all') || filterTier === tab.id;
            const newQs = new URLSearchParams(qs);
            if (tab.id === 'all') newQs.delete('tier');
            else newQs.set('tier', tab.id);
            return (
              <Link
                key={tab.id}
                href={`/tyres?${newQs.toString()}`}
                className={`px-3 py-1.5 rounded transition-colors text-xs font-semibold uppercase ${
                  active ? 'bg-brand text-ink-inverse' : 'bg-surface-3 text-ink-2 hover:text-ink-1'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-ink-3">Season:</span>
          {[
            { id: 'all', label: 'All' },
            { id: 'summer', label: 'Summer' },
            { id: 'all-season', label: 'All-Season' },
          ].map((tab) => {
            const active = (!filterSeason && tab.id === 'all') || filterSeason === tab.id;
            const newQs = new URLSearchParams(qs);
            if (tab.id === 'all') newQs.delete('season');
            else newQs.set('season', tab.id);
            return (
              <Link
                key={tab.id}
                href={`/tyres?${newQs.toString()}`}
                className={`px-3 py-1.5 rounded transition-colors text-xs font-semibold uppercase ${
                  active ? 'bg-brand text-ink-inverse' : 'bg-surface-3 text-ink-2 hover:text-ink-1'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {tyres.length === 0 ? (
        <div className="card max-w-lg mx-auto text-center py-12">
          <h2 className="text-xl font-bold mb-3">No tyres found</h2>
          <p className="text-sm text-ink-2 mb-6">
            No tyres matching that exact combination. Please try a different size or contact us.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/tyres" className="btn btn-secondary">Clear filters</Link>
            <Link href="/booking" className="btn btn-primary">Book custom size</Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tyres.map((t) => (
            <article key={t.id} className="card-tyre flex flex-col justify-between group">
              <div>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-brand">{t.brand}</div>
                    <h2 className="text-xl font-bold leading-tight mt-0.5">{t.model}</h2>
                  </div>
                  <span className={`badge badge-${t.tier}`}>{t.tier}</span>
                </div>

                <div className="mono text-base font-semibold text-ink-1 mb-4">
                  {formatTyreSize(t)}
                </div>

                {/* EU Tyre Label Ratings */}
                <div className="grid grid-cols-3 gap-2 bg-surface-3/60 p-2.5 rounded border border-border/50 mb-4 text-xs">
                  <div className="flex items-center gap-1.5 text-ink-2">
                    <Fuel size={14} className="text-brand shrink-0" />
                    <span>Eco: <strong className="text-ink-1">{t.fuel_economy ?? '—'}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-ink-2">
                    <Zap size={14} className="text-brand shrink-0" />
                    <span>Grip: <strong className="text-ink-1">{t.wet_grip ?? '—'}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-ink-2">
                    <Volume2 size={14} className="text-brand shrink-0" />
                    <span>Noise: <strong className="text-ink-1">{t.noise_db ? `${t.noise_db}dB` : '—'}</strong></span>
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap gap-1.5">
                  {t.is_run_flat && <span className="badge badge-info">Run-Flat (RFT)</span>}
                  {t.is_xl && <span className="badge badge-info">Extra Load (XL)</span>}
                  {t.season !== 'summer' && <span className="badge badge-warning">{t.season}</span>}
                  {t.season === 'summer' && <span className="badge badge-info">Summer</span>}
                </div>
              </div>

              <div className="border-t border-line pt-4 mt-4">
                <div className="mb-2 flex items-baseline justify-between">
                  <div>
                    <span className="price-display text-2xl text-ink-1">{formatPrice(t.sell_price)}</span>
                    <span className="text-xs text-ink-3 ml-1.5">each, fitted</span>
                  </div>
                  <div className="text-xs text-ok font-semibold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-ok animate-pulse" />
                    {`${t.stock} available`}
                  </div>
                </div>
                <p className="text-[11px] text-ink-3 mb-4">
                  Review the selected tyre, quantity and appointment details before continuing.
                </p>
                <Link
                  href={`/booking?tyre=${t.id}&qty=2&${qs.toString()}`}
                  className="btn btn-primary w-full btn-sm"
                >
                  Select &amp; Choose Slot
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Selection guidance */}
      <div className="mt-16 card grid md:grid-cols-3 gap-6 bg-surface-2/80 border-border">
        <div className="flex items-start gap-3">
          <ShieldCheck size={22} className="text-brand shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold">Confirm the fitment</h4>
            <p className="text-xs text-ink-2 mt-1">Compare the selected size with the numbers printed on the physical tyre sidewall.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Zap size={22} className="text-brand shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold">Review the complete price</h4>
            <p className="text-xs text-ink-2 mt-1">Any applicable fitting-location charge must be shown before a real payment step.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Fuel size={22} className="text-brand shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold">Keep the vehicle details</h4>
            <p className="text-xs text-ink-2 mt-1">The tyre size, registration and postcode remain attached to the booking journey.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
