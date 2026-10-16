/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import BankSettings from './BankSettings';
import { formatPrice, extractInventory } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, ShieldCheck, AlertCircle } from 'lucide-react';

type Resource =
  | 'dashboard'
  | 'bookings'
  | 'products'
  | 'inventory'
  | 'slots'
  | 'zones'
  | 'fitters'
  | 'customers'
  | 'payments'
  | 'settings'
  | 'audit';

type AnyRow = Record<string, any>;

const n = (v: FormDataEntryValue | null) => Number(v);
const s = (v: FormDataEntryValue | null) => String(v ?? '').trim();

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function isLegacyBooking(b: AnyRow): boolean {
  return !b.booking_source;
}

export default function AdminWorkspace({
  resource,
  canOperate,
  isOwner,
}: {
  resource: Resource;
  canOperate: boolean;
  isOwner: boolean;
}) {
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState('Loading…');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [danger, setDanger] = useState<{
    question: string;
    action: string;
    payload: AnyRow;
    endpoint?: string;
  } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  async function load() {
    try {
      const r = await fetch('/api/admin/os?resource=' + resource, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.message);
      setData(j.data);
      setMessage('');
    } catch {
      setData(null);
      setMessage('Data unavailable. No changes can be made.');
    }
  }

  useEffect(() => {
    void load();
  }, [resource]);

  async function mutate(action: string, payload: AnyRow, endpoint = '/api/admin/os') {
    setBusy(true);
    setMessage('');
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(endpoint === '/api/admin/os' ? { action, payload } : payload),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.message || 'Change rejected.');
      setMessage('Saved and audited.');
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Change rejected.');
    } finally {
      setBusy(false);
    }
  }

  function confirm(question: string, action: string, payload: AnyRow, endpoint?: string) {
    setDanger({ question, action, payload, endpoint });
    setTimeout(() => dialog.current?.showModal());
  }

  async function confirmed() {
    const d = danger;
    dialog.current?.close();
    setDanger(null);
    if (d) await mutate(d.action, d.payload, d.endpoint);
  }

  const records: AnyRow[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.bookings)
      ? data.bookings
      : [];

  const filtered = useMemo(
    () =>
      records.filter(
        (r) =>
          (!status || r.status === status) &&
          (!query || JSON.stringify(r).toLowerCase().includes(query.toLowerCase())),
      ),
    [records, query, status],
  );

  const form = (handler: (fd: FormData) => void, children: React.ReactNode) => (
    <form
      className="card grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        handler(new FormData(e.currentTarget));
      }}
    >
      {children}
      <button disabled={busy || !canOperate} className="btn btn-primary min-h-11">
        Save
      </button>
    </form>
  );

  const input = (name: string, label: string, type = 'text', required = true) => (
    <label className="text-sm">
      {label}
      <input name={name} type={type} required={required} className="input w-full min-h-11 mt-1" />
    </label>
  );

  return (
    <div className="space-y-6 min-w-0">
      {message && <p role="status" className="text-sm text-ink-2">{message}</p>}

      {/* DASHBOARD */}
      {resource === 'dashboard' && data && (
        <div className="space-y-6">
          {/* Metrics summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(data)
              .filter(([k]) => k !== 'checklist')
              .map(([k, v]) => (
                <article className="card" key={k}>
                  <p className="text-xs uppercase tracking-wider text-ink-3">{k.replaceAll('_', ' ')}</p>
                  <p className="text-2xl font-bold mt-2 text-ink-1">
                    {k.includes('revenue') || k.includes('balance')
                      ? formatPrice(Number(v))
                      : String(v)}
                  </p>
                </article>
              ))}
          </div>

          {/* Launch Setup Checklist */}
          {data.checklist && (
            <div className="card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                <div>
                  <h2 className="text-lg font-bold text-ink-1">Launch Setup Checklist</h2>
                  <p className="text-xs text-ink-3">
                    Persisted database readiness criteria before customer checkout can accept bookings.
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded border ${
                    data.checklist.live_booking_acceptance
                      ? 'bg-success/15 text-success border-success/30'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {data.checklist.live_booking_acceptance ? (
                    <>
                      <CheckCircle2 size={14} /> Live Ready
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={14} /> Setup Incomplete
                    </>
                  )}
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  {
                    key: 'contacts',
                    title: '1. Contacts & Public Links',
                    desc: 'Phone, email and WhatsApp contact links configured.',
                    done: data.checklist.contacts,
                    href: '/admin/settings',
                  },
                  {
                    key: 'products_and_stock',
                    title: '2. Approved Products & Stock',
                    desc: 'Active tyre catalogue with positive stock levels.',
                    done: data.checklist.products_and_stock,
                    href: '/admin/products',
                  },
                  {
                    key: 'coverage_and_callout',
                    title: '3. Service Coverage & Callout Fees',
                    desc: 'Active service zones with defined callout rates.',
                    done: data.checklist.coverage_and_callout,
                    href: '/admin/zones',
                  },
                  {
                    key: 'real_fitters',
                    title: '4. Mobile Fitters',
                    desc: 'Active mobile tyre fitters assigned to fleet vans.',
                    done: data.checklist.real_fitters,
                    href: '/admin/fitters',
                  },
                  {
                    key: 'hours_and_slots',
                    title: '5. Weekly Hours & Generated Slots',
                    desc: 'Weekly schedule rules and future fitting capacity.',
                    done: data.checklist.hours_and_slots,
                    href: '/admin/slots',
                  },
                  {
                    key: 'pricing_and_vat',
                    title: '6. Pricing, Job Duration & VAT',
                    desc: 'Standard fitting fee, job duration, and VAT rate.',
                    done: data.checklist.pricing_and_vat,
                    href: '/admin/settings',
                  },
                  {
                    key: 'bank_account_and_window',
                    title: '7. Business Bank Account & Window',
                    desc: 'Sort code, account number and payment window.',
                    done: data.checklist.bank_account_and_window,
                    href: '/admin/settings',
                  },
                  {
                    key: 'legal_policies',
                    title: '8. Cancellation, Terms & Privacy',
                    desc: 'Approved cancellation policy and legal notices.',
                    done: data.checklist.legal_policies,
                    href: '/admin/settings',
                  },
                  {
                    key: 'email_delivery',
                    title: '9. Email Delivery',
                    desc: 'Resend API key configured for customer confirmations.',
                    done: data.checklist.email_delivery,
                    href: '/admin/settings',
                  },
                  {
                    key: 'live_booking_acceptance',
                    title: '10. Owner Pricing Approval',
                    desc: 'Explicit owner sign-off enabling live customer checkout.',
                    done: data.checklist.live_booking_acceptance,
                    href: '/admin/settings',
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-start gap-3 p-3 rounded bg-surface-2 border border-line"
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        item.done ? 'bg-success text-ink-inverse' : 'bg-surface-4 text-ink-3'
                      }`}
                    >
                      {item.done ? '✓' : '!'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-semibold ${item.done ? 'text-ink-1' : 'text-ink-2'}`}>
                          {item.title}
                        </span>
                        <Link href={item.href} className="text-xs text-brand hover:underline font-medium shrink-0">
                          Configure →
                        </Link>
                      </div>
                      <p className="text-xs text-ink-3 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* BOOKINGS */}
      {resource === 'bookings' && (
        <>
          <div className="flex flex-wrap gap-3 items-center">
            <Link className="btn btn-primary min-h-11" href="/admin/bookings/phone">
              New phone booking
            </Link>
            {inputFilter(query, setQuery, 'Search reference, customer, registration')}
            <select
              aria-label="Filter bookings by status"
              className="input min-h-11"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {[
                'AWAITING_BANK_PAYMENT',
                'CONFIRMED',
                'tyres_reserved',
                'fitter_assigned',
                'en_route',
                'completed',
                'cancelled',
                'refunded',
                'EXPIRED',
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div className="space-y-4">
            {filtered.map((b) => {
              const legacy = isLegacyBooking(b);
              return (
                <article className="card space-y-3" key={b.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-bold break-all text-base text-ink-1">{b.reference}</h2>
                    {legacy && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        Historical — read only
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ink-2">
                    {[b.customer?.first_name, b.customer?.last_name].filter(Boolean).join(' ')} ·{' '}
                    {b.registration || 'No registration'} · {b.status} · {formatPrice(b.total_pence)}
                  </p>

                  {legacy ? (
                    <div className="p-3 rounded bg-surface-2 border border-line text-xs text-ink-3">
                      Preserved legacy record. Operational actions (assignment, reschedule, cancel, payment)
                      are disabled to maintain historical audit integrity.
                    </div>
                  ) : (
                    <>
                      <div className="grid sm:grid-cols-3 gap-3">
                        <select
                          aria-label={'Fitter for ' + b.reference}
                          className="input min-h-11"
                          defaultValue={b.fitter_id ?? ''}
                          id={'f-' + b.id}
                        >
                          <option value="">Fitter not assigned yet</option>
                          {(data?.fitters ?? []).map((f: AnyRow) => (
                            <option value={f.id} key={f.id}>
                              {f.name} · {f.van_name || 'No van'}
                            </option>
                          ))}
                        </select>
                        <button
                          disabled={!canOperate || busy}
                          className="btn btn-secondary min-h-11"
                          onClick={() => {
                            const el = document.getElementById('f-' + b.id) as HTMLSelectElement;
                            if (el.value)
                              void mutate('booking.assign_fitter', {
                                booking_id: b.id,
                                fitter_id: el.value,
                                reason: 'Owner assigned fitter',
                              });
                          }}
                        >
                          Assign fitter
                        </button>
                        <select
                          aria-label={'Status for ' + b.reference}
                          className="input min-h-11"
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value)
                              confirm(
                                'Change ' + b.reference + ' to ' + e.target.value + '?',
                                'booking.status',
                                {
                                  booking_id: b.id,
                                  status: e.target.value,
                                  reason: 'Owner confirmed operational status change',
                                },
                              );
                          }}
                        >
                          <option value="">Change operational status</option>
                          {['tyres_reserved', 'fitter_assigned', 'en_route', 'completed'].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid sm:grid-cols-3 gap-3">
                        <select
                          aria-label={'New slot for ' + b.reference}
                          id={'s-' + b.id}
                          className="input min-h-11"
                          defaultValue=""
                        >
                          <option value="">Choose new slot</option>
                          {(data?.slots ?? []).map((x: AnyRow) => (
                            <option value={x.id} key={x.id}>
                              {x.date} {x.start_at.slice(0, 5)}
                            </option>
                          ))}
                        </select>
                        <button
                          disabled={!canOperate || busy}
                          className="btn btn-secondary min-h-11"
                          onClick={() => {
                            const el = document.getElementById('s-' + b.id) as HTMLSelectElement;
                            if (el.value)
                              confirm('Reschedule ' + b.reference + ' to the selected fitting time?', 'booking.reschedule', {
                                booking_id: b.id,
                                slot_id: el.value,
                                reason: 'Owner confirmed reschedule',
                              });
                          }}
                        >
                          Review reschedule
                        </button>
                        <button
                          disabled={!canOperate || busy || ['cancelled', 'refunded', 'completed'].includes(b.status)}
                          className="btn btn-secondary min-h-11 text-danger"
                          onClick={() =>
                            confirm('Cancel ' + b.reference + ' and release its reserved resources?', 'booking.cancel', {
                              booking_id: b.id,
                              reason: 'Owner confirmed cancellation',
                            })
                          }
                        >
                          Review cancellation
                        </button>
                      </div>

                      {b.status === 'AWAITING_BANK_PAYMENT' && (
                        <div className="flex flex-wrap gap-3">
                          <button
                            disabled={!canOperate || busy}
                            className="btn btn-primary min-h-11"
                            onClick={() =>
                              confirm(
                                'Have you confirmed ' +
                                  formatPrice(b.payment?.[0]?.amount_pence ?? 0) +
                                  ' has arrived in the G Force business bank account?',
                                'verify',
                                {
                                  action: 'verify',
                                  booking_id: b.id,
                                  expected_amount_pence: b.payment?.[0]?.amount_pence,
                                  bank_receipt_confirmed: true,
                                },
                                '/api/admin/payments',
                              )
                            }
                          >
                            MARK PAYMENT RECEIVED
                          </button>
                          <button
                            disabled={!canOperate || busy}
                            className="btn btn-secondary min-h-11"
                            onClick={() => {
                              const mins = Number(prompt('Additional payment-window minutes (1–10080)'));
                              const reason = prompt('Reason for extension')?.trim();
                              if (mins && reason && b.bank_payment_expires_at)
                                confirm(
                                  'Extend the payment deadline for ' + b.reference + '?',
                                  'extend',
                                  {
                                    action: 'extend',
                                    booking_id: b.id,
                                    minutes: mins,
                                    reason,
                                    expected_expires_at: b.bank_payment_expires_at,
                                  },
                                  '/api/admin/payments',
                                );
                            }}
                          >
                            Extend payment window
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}

      {/* PRODUCTS */}
      {resource === 'products' && (
        <>
          {form(
            (fd) =>
              void mutate('product.save', {
                sku: s(fd.get('sku')),
                brand: s(fd.get('brand')),
                model: s(fd.get('model')),
                width: n(fd.get('width')),
                profile: n(fd.get('profile')),
                rim: n(fd.get('rim')),
                load_index: s(fd.get('load_index')),
                speed_rating: s(fd.get('speed_rating')),
                run_flat: fd.get('run_flat') === 'on',
                extra_load: fd.get('extra_load') === 'on',
                season: s(fd.get('season')),
                tier: s(fd.get('tier')),
                image_url: s(fd.get('image_url')),
                stock_qty: n(fd.get('stock_qty')),
                cost_price_pence: n(fd.get('cost_price_pence')),
                selling_price_pence: n(fd.get('selling_price_pence')),
                supplier_sku: s(fd.get('supplier_sku')),
                low_stock_threshold: n(fd.get('low_stock_threshold')),
              }),
            <>
              {input('sku', 'SKU')}
              {input('brand', 'Brand')}
              {input('model', 'Model')}
              {input('width', 'Width', 'number')}
              {input('profile', 'Profile', 'number')}
              {input('rim', 'Rim', 'number')}
              {input('load_index', 'Load index')}
              {input('speed_rating', 'Speed rating')}
              <label className="text-sm">
                Season
                <select name="season" className="input w-full min-h-11 mt-1">
                  <option>summer</option>
                  <option>all-season</option>
                  <option>winter</option>
                </select>
              </label>
              <label className="text-sm">
                Tier
                <select name="tier" className="input w-full min-h-11 mt-1">
                  <option>budget</option>
                  <option>standard</option>
                  <option>premium</option>
                </select>
              </label>
              {input('image_url', 'Image HTTPS URL', 'url', false)}
              {input('stock_qty', 'Stock quantity', 'number')}
              {input('cost_price_pence', 'Cost price (pence, e.g. 5000 = £50.00)', 'number')}
              {input('selling_price_pence', 'Selling price (pence, e.g. 8500 = £85.00)', 'number')}
              {input('supplier_sku', 'Supplier SKU', 'text', false)}
              {input('low_stock_threshold', 'Low-stock alert threshold', 'number')}
              <label className="flex items-center gap-2 text-sm">
                <input name="run_flat" type="checkbox" /> Run-flat
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input name="extra_load" type="checkbox" /> Extra load (XL)
              </label>
            </>,
          )}
          <CsvImport onDone={load} />
          <Records
            rows={filtered}
            render={(r) => (
              <>
                <b>
                  {r.sku} · {r.brand} {r.model}
                </b>
                <span>
                  {r.width}/{r.profile} R{r.rim} · {r.tier} · {r.active ? 'Active' : 'Archived'}
                </span>
                {canOperate && <ProductEdit row={r} save={(p) => void mutate('product.save', p)} />}{' '}
                {r.active && (
                  <button
                    disabled={!canOperate}
                    className="btn btn-secondary text-danger"
                    onClick={() => confirm('Archive ' + r.sku + '? It will disappear from public search.', 'product.archive', { id: r.id })}
                  >
                    Review archive
                  </button>
                )}
              </>
            )}
          />
        </>
      )}

      {/* INVENTORY */}
      {resource === 'inventory' && (
        <Records
          rows={filtered}
          render={(r) => {
            const i = extractInventory(r.inventory);
            return (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b className="text-base text-ink-1">
                    {r.sku} · {r.brand} {r.model}
                  </b>
                  <span className="text-xs text-ink-3">
                    {r.width}/{r.profile} R{r.rim} {r.load_index}
                    {r.speed_rating}
                  </span>
                </div>
                {i ? (
                  <>
                    <div className="text-sm text-ink-2 space-y-1">
                      <div>
                        Stock: <span className="font-bold text-ink-1">{i.stock_qty}</span> · Reserved:{' '}
                        <span className="font-bold text-ink-1">{i.reserved_qty}</span> · Available:{' '}
                        <span className="font-bold text-brand">{i.stock_qty - i.reserved_qty}</span> ·
                        Price: <span className="font-bold text-ink-1">{formatPrice(i.selling_price_pence)}</span>
                        {i.cost_price_pence > 0 && (
                          <> · Cost: <span>{formatPrice(i.cost_price_pence)}</span></>
                        )}
                        {' '}· Low alert at: <span>{i.low_stock_threshold}</span>
                      </div>
                    </div>
                    {canOperate && (
                      <InventoryForm
                        row={r}
                        onSave={(payload, cycle) =>
                          void mutate(cycle ? 'inventory.cycle_count' : 'inventory.adjust', payload)
                        }
                      />
                    )}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-danger/15 text-danger border border-danger/30">
                    <AlertCircle size={14} /> Inventory record missing
                  </span>
                )}
              </>
            );
          }}
        />
      )}

      {/* ZONES */}
      {resource === 'zones' && (
        <>
          {form(
            (fd) =>
              void mutate('zone.save', {
                name: s(fd.get('name')),
                postcode_prefix: s(fd.get('postcode_prefix')),
                callout_fee_pence: n(fd.get('callout_fee_pence')),
                priority: n(fd.get('priority')),
                active: true,
              }),
            <>
              {input('name', 'Zone name (e.g. Croydon & Sutton)')}
              {input('postcode_prefix', 'Outward postcode (e.g. CR or BR)')}
              {input('callout_fee_pence', 'Callout fee (pence, e.g. 1500 = £15.00)', 'number')}
              {input('priority', 'Priority', 'number')}
            </>,
          )}
          <Records
            rows={filtered}
            render={(r) => (
              <>
                <b>
                  {r.postcode_prefix} · {r.name}
                </b>
                <span>
                  {formatPrice(r.callout_fee_pence)} · priority {r.priority} · {r.active ? 'Active' : 'Inactive'}
                </span>
                {canOperate && <ZoneEdit row={r} save={(p) => void mutate('zone.save', p)} />}{' '}
                {r.active && (
                  <button
                    className="btn btn-secondary text-danger"
                    onClick={() =>
                      confirm('Deactivate zone ' + r.postcode_prefix + '?', 'zone.archive', { id: r.id })
                    }
                  >
                    Review deactivate
                  </button>
                )}
              </>
            )}
          />
        </>
      )}

      {/* FITTERS */}
      {resource === 'fitters' && (
        <>
          {form(
            (fd) =>
              void mutate('fitter.save', {
                name: s(fd.get('name')),
                phone: s(fd.get('phone')),
                van_name: s(fd.get('van_name')),
                active: true,
              }),
            <>
              {input('name', 'Fitter full name')}
              {input('phone', 'Mobile phone', 'tel')}
              {input('van_name', 'Van name / reg (e.g. Van 1 - Transit)')}
            </>,
          )}
          <Records
            rows={filtered}
            render={(r) => (
              <>
                <b>{r.name}</b>
                <span>
                  {r.phone || 'No phone'} · {r.van_name || 'No van'} · workload {r.workload} ·{' '}
                  {r.active ? 'Active' : 'Inactive'}
                </span>
                {canOperate && <FitterEdit row={r} save={(p) => void mutate('fitter.save', p)} />}{' '}
                {r.active && (
                  <button
                    className="btn btn-secondary text-danger"
                    onClick={() => confirm('Deactivate fitter ' + r.name + '?', 'fitter.archive', { id: r.id })}
                  >
                    Review deactivate
                  </button>
                )}
              </>
            )}
          />
        </>
      )}

      {/* SLOTS */}
      {resource === 'slots' && (
        <Slots data={data} canOperate={canOperate} mutate={mutate} confirm={confirm} />
      )}

      {/* CUSTOMERS */}
      {resource === 'customers' && (
        <>
          <div>{inputFilter(query, setQuery, 'Search customers')}</div>
          <Records rows={filtered} render={(r) => <CustomerSummary row={r} />} />
        </>
      )}

      {/* PAYMENTS */}
      {resource === 'payments' && (
        <>
          <div className="flex gap-3">
            {inputFilter(query, setQuery, 'Search payment ledger')}
            <select
              aria-label="Filter payments by status"
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All</option>
              <option>pending</option>
              <option>received</option>
              <option>refunded</option>
            </select>
          </div>
          <Records
            rows={filtered}
            render={(r) => {
              const expired =
                r.status === 'pending' && Date.parse(r.booking?.bank_payment_expires_at) <= Date.now();
              return (
                <>
                  <b>
                    {r.reference} · {formatPrice(r.amount_pence)}
                  </b>
                  <span>
                    {expired ? 'expired' : r.status} · booking {r.booking?.status}
                  </span>
                  {r.refunded_at && (
                    <span>
                      Refund {formatPrice(r.refund_amount_pence)} · {r.refund_reference} ·{' '}
                      {new Date(r.refunded_at).toLocaleString('en-GB')}
                    </span>
                  )}
                  {r.status === 'received' && canOperate && <RefundForm row={r} confirm={confirm} />}
                </>
              );
            }}
          />
        </>
      )}

      {/* SETTINGS */}
      {resource === 'settings' && isOwner && (
        <>
          <BankSettings />
          <SettingsPricingControl data={data} confirm={confirm} busy={busy} />
          <SettingsForm data={data} save={(p) => void mutate('settings.save', p)} busy={busy} />
        </>
      )}

      {/* AUDIT */}
      {resource === 'audit' && (
        <>
          <div>{inputFilter(query, setQuery, 'Search immutable history')}</div>
          <Records
            rows={filtered}
            render={(r) => (
              <>
                <b>{r.action}</b>
                <span>
                  {r.resource_type} · {new Date(r.created_at).toLocaleString('en-GB')} · actor{' '}
                  {r.actor_name || r.admin_user_id || 'system'}
                </span>
                <details>
                  <summary>Before / after</summary>
                  <pre className="text-xs whitespace-pre-wrap break-all">
                    {JSON.stringify(
                      { before: r.before_state, after: r.after_state, metadata: r.metadata },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </>
            )}
          />
        </>
      )}

      {/* CONFIRMATION DIALOG */}
      <dialog
        ref={dialog}
        className="card bg-surface-1 text-ink-1 w-[calc(100%_-_2rem)] max-w-lg backdrop:bg-black/70"
        aria-labelledby="danger-title"
      >
        <h2 id="danger-title" className="text-lg font-bold">
          Confirm operational change
        </h2>
        <p className="text-sm my-4">{danger?.question}</p>
        <div className="flex gap-3">
          <button className="btn btn-secondary min-h-11" onClick={() => dialog.current?.close()}>
            Go back
          </button>
          <button
            className="btn btn-primary min-h-11"
            disabled={busy}
            onClick={() => void confirmed()}
          >
            Confirm change
          </button>
        </div>
      </dialog>
    </div>
  );
}

function inputFilter(value: string, set: (v: string) => void, label: string) {
  return (
    <label className="text-sm flex-1 min-w-[200px]">
      <span className="sr-only">{label}</span>
      <input
        className="input min-h-11 w-full"
        placeholder={label}
        value={value}
        onChange={(e) => set(e.target.value)}
      />
    </label>
  );
}

function Records({
  rows,
  render,
}: {
  rows: AnyRow[];
  render: (r: AnyRow) => React.ReactNode;
}) {
  return (
    <div className="grid gap-3">
      {rows.length ? (
        rows.map((r) => (
          <article className="card flex flex-col gap-2 min-w-0" key={r.id}>
            {render(r)}
          </article>
        ))
      ) : (
        <p className="text-sm text-ink-3">No records found.</p>
      )}
    </div>
  );
}

function CustomerSummary({ row }: { row: AnyRow }) {
  const bookings: AnyRow[] = row.bookings ?? [];
  const registrations = [...new Set(bookings.map((b) => b.registration).filter(Boolean))];
  return (
    <>
      <b>
        {row.first_name} {row.last_name}
      </b>
      <span>
        {row.email} · {row.phone}
      </span>
      <span>
        {registrations.length
          ? `Vehicles: ${registrations.join(', ')}`
          : 'No vehicle registrations recorded'}
      </span>
      <details>
        <summary>
          {bookings.length} booking{bookings.length === 1 ? '' : 's'} and payment history
        </summary>
        <div className="space-y-2 mt-2">
          {bookings.map((b) => (
            <p className="text-sm break-words" key={b.id}>
              {b.reference} · {b.status} · {formatPrice(b.total_pence)} ·{' '}
              {b.registration || 'No registration'}
              {(b.payments ?? []).map(
                (p: AnyRow) =>
                  ` · payment ${p.status} ${formatPrice(p.amount_pence)}${p.refund_amount_pence ? ` · refunded ${formatPrice(p.refund_amount_pence)}` : ''}`,
              )}
            </p>
          ))}
        </div>
      </details>
    </>
  );
}

function RefundForm({
  row,
  confirm,
}: {
  row: AnyRow;
  confirm: (q: string, a: string, p: AnyRow) => void;
}) {
  return (
    <form
      className="grid sm:grid-cols-3 gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget),
          amount = n(f.get('amount'));
        confirm(`Have you confirmed ${formatPrice(amount)} refund left the G Force business bank account?`, 'payment.refund', {
          booking_id: row.booking_id,
          refund_amount_pence: amount,
          refund_reference: s(f.get('reference')),
          reason: s(f.get('reason')),
          refund_confirmed:true,
        });
      }}
    >
      <input
        name="amount"
        aria-label="Full refund amount pence"
        type="number"
        min={row.amount_pence}
        max={row.amount_pence}
        defaultValue={row.amount_pence}
        readOnly
        required
        className="input min-h-11"
      />
      <input
        name="reference"
        aria-label="Refund bank reference"
        minLength={2}
        maxLength={120}
        required
        placeholder="Bank refund reference"
        className="input min-h-11"
      />
      <input
        name="reason"
        aria-label="Refund note"
        minLength={3}
        maxLength={500}
        required
        placeholder="Refund note"
        className="input min-h-11"
      />
      <button className="btn btn-secondary text-danger min-h-11">Review refund</button>
    </form>
  );
}

function InventoryForm({
  row,
  onSave,
}: {
  row: AnyRow;
  onSave: (p: AnyRow, c: boolean) => void;
}) {
  const i = extractInventory(row.inventory) || {};
  return (
    <form
      className="grid sm:grid-cols-3 gap-3 p-3 rounded bg-surface-2 border border-line"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave(
          {
            tyre_product_id: row.id,
            stock_qty: n(f.get('stock_qty')),
            selling_price_pence: n(f.get('selling_price_pence')),
            cost_price_pence: n(f.get('cost_price_pence')),
            low_stock_threshold: n(f.get('low_stock_threshold')),
            supplier_sku: s(f.get('supplier_sku')),
            reason: s(f.get('reason')),
          },
          f.get('cycle') === 'on',
        );
      }}
    >
      <label className="text-xs">
        Stock Quantity
        <input
          name="stock_qty"
          type="number"
          min="0"
          defaultValue={i.stock_qty ?? 0}
          className="input w-full min-h-11 mt-1"
          required
        />
      </label>
      <label className="text-xs">
        Selling Price (pence, e.g. 8500 = £85.00)
        <input
          name="selling_price_pence"
          type="number"
          min="1"
          defaultValue={i.selling_price_pence ?? 0}
          className="input w-full min-h-11 mt-1"
          required
        />
      </label>
      <label className="text-xs">
        Cost Price (pence, e.g. 5000 = £50.00)
        <input
          name="cost_price_pence"
          type="number"
          min="0"
          defaultValue={i.cost_price_pence ?? 0}
          className="input w-full min-h-11 mt-1"
        />
      </label>
      <label className="text-xs">
        Low Stock Alert Threshold
        <input
          name="low_stock_threshold"
          type="number"
          min="0"
          defaultValue={i.low_stock_threshold ?? 5}
          className="input w-full min-h-11 mt-1"
        />
      </label>
      <label className="text-xs">
        Supplier SKU
        <input
          name="supplier_sku"
          defaultValue={i.supplier_sku ?? ''}
          className="input w-full min-h-11 mt-1"
        />
      </label>
      <label className="text-xs">
        Audit Reason for Adjustment
        <input
          name="reason"
          required
          minLength={3}
          placeholder="e.g. Weekly stock intake check"
          className="input w-full min-h-11 mt-1"
        />
      </label>
      <div className="sm:col-span-3 flex flex-wrap items-center justify-between gap-3 pt-2">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="cycle" /> Physical cycle count verification
        </label>
        <button className="btn btn-secondary min-h-11">Save inventory adjustment</button>
      </div>
    </form>
  );
}

function ProductEdit({ row, save }: { row: AnyRow; save: (p: AnyRow) => void }) {
  return (
    <details>
      <summary className="cursor-pointer text-sm text-brand hover:underline font-medium">
        Edit product
      </summary>
      <form
        className="grid sm:grid-cols-3 gap-2 mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          save({
            id: row.id,
            sku: s(f.get('sku')),
            brand: s(f.get('brand')),
            model: s(f.get('model')),
            width: n(f.get('width')),
            profile: n(f.get('profile')),
            rim: n(f.get('rim')),
            load_index: s(f.get('load_index')),
            speed_rating: s(f.get('speed_rating')),
            run_flat: f.get('run_flat') === 'on',
            extra_load: f.get('extra_load') === 'on',
            season: s(f.get('season')),
            tier: s(f.get('tier')),
            image_url: s(f.get('image_url')),
            supplier_sku: '',
          });
        }}
      >
        {['sku', 'brand', 'model', 'width', 'profile', 'rim', 'load_index', 'speed_rating', 'image_url'].map(
          (k) => (
            <input aria-label={k} name={k} key={k} defaultValue={row[k] ?? ''} className="input min-h-11" />
          ),
        )}
        <select aria-label="season" name="season" defaultValue={row.season} className="input">
          <option>summer</option>
          <option>all-season</option>
          <option>winter</option>
        </select>
        <select aria-label="tier" name="tier" defaultValue={row.tier} className="input">
          <option>budget</option>
          <option>standard</option>
          <option>premium</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input name="run_flat" type="checkbox" defaultChecked={row.run_flat} /> Run-flat
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input name="extra_load" type="checkbox" defaultChecked={row.extra_load} /> XL
        </label>
        <button className="btn btn-secondary">Save product</button>
      </form>
    </details>
  );
}

function ZoneEdit({ row, save }: { row: AnyRow; save: (p: AnyRow) => void }) {
  return (
    <form
      className="flex flex-wrap gap-2 items-center"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        save({
          id: row.id,
          name: s(f.get('name')),
          postcode_prefix: s(f.get('postcode_prefix')),
          callout_fee_pence: n(f.get('fee')),
          priority: n(f.get('priority')),
          active: f.get('active') === 'on',
        });
      }}
    >
      <input aria-label="Zone name" name="name" defaultValue={row.name} className="input" />
      <input
        aria-label="Postcode prefix"
        name="postcode_prefix"
        defaultValue={row.postcode_prefix}
        className="input w-24"
      />
      <input
        aria-label="Callout pence"
        name="fee"
        type="number"
        defaultValue={row.callout_fee_pence}
        className="input w-32"
      />
      <input
        aria-label="Priority"
        name="priority"
        type="number"
        defaultValue={row.priority}
        className="input w-24"
      />
      <label className="flex items-center gap-1 text-sm">
        <input name="active" type="checkbox" defaultChecked={row.active} /> Active
      </label>
      <button className="btn btn-secondary">Save zone</button>
    </form>
  );
}

function FitterEdit({ row, save }: { row: AnyRow; save: (p: AnyRow) => void }) {
  return (
    <form
      className="flex flex-wrap gap-2 items-center"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        save({
          id: row.id,
          name: s(f.get('name')),
          phone: s(f.get('phone')),
          van_name: s(f.get('van')),
          active: f.get('active') === 'on',
        });
      }}
    >
      <input aria-label="Fitter name" name="name" defaultValue={row.name} className="input" />
      <input aria-label="Fitter phone" name="phone" defaultValue={row.phone ?? ''} className="input" />
      <input aria-label="Van" name="van" defaultValue={row.van_name ?? ''} className="input" />
      <label className="flex items-center gap-1 text-sm">
        <input name="active" type="checkbox" defaultChecked={row.active} /> Active
      </label>
      <button className="btn btn-secondary">Save fitter</button>
    </form>
  );
}

function CsvImport({ onDone }: { onDone: () => Promise<void> }) {
  const [message, setMessage] = useState('');
  return (
    <form
      className="card space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const file = new FormData(e.currentTarget).get('file') as File;
        const r = await fetch('/api/admin/products/import', {
          method: 'POST',
          headers: { 'Content-Type': 'text/csv' },
          body: await file.text(),
        });
        const j = await r.json();
        setMessage(
          r.ok && j.ok
            ? `Imported ${j.data.saved} products atomically.`
            : 'Import rejected. Check the exact template headers and every row.',
        );
        if (r.ok) await onDone();
      }}
    >
      <h2 className="font-bold text-base text-ink-1">CSV product import</h2>
      <p className="text-xs text-ink-3 break-words">
        sku,brand,model,width,profile,rim,load_index,speed_rating,run_flat,extra_load,season,tier,image_url,stock_qty,cost_price_pence,selling_price_pence,supplier_sku,low_stock_threshold
      </p>
      <input name="file" required type="file" accept=".csv,text/csv" className="text-sm" />
      <div>
        <button className="btn btn-secondary min-h-11">Validate and import CSV</button>
      </div>
      {message && <p role="status" className="text-sm text-ink-2">{message}</p>}
    </form>
  );
}

function Slots({
  data,
  canOperate,
  mutate,
  confirm,
}: {
  data: any;
  canOperate: boolean;
  mutate: (a: string, p: AnyRow) => Promise<void>;
  confirm: (q: string, a: string, p: AnyRow) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="card space-y-1">
        <h2 className="text-base font-bold text-ink-1">Booking Horizon</h2>
        <p className="text-sm text-ink-2">
          Customers can book appointments up to{' '}
          <span className="font-bold text-brand">{data?.settings?.booking_horizon_days ?? '—'}</span> days in
          advance.
        </p>
      </div>

      {/* Weekly Schedule Rule Form */}
      <form
        className="card space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void mutate('slot.rule.save', {
            day_of_week: n(f.get('day')),
            start_time: s(f.get('start')),
            end_time: s(f.get('end')),
            slot_duration_minutes: n(f.get('duration')),
            capacity: n(f.get('capacity')),
            active: true,
          });
        }}
      >
        <h2 className="text-base font-bold text-ink-1">Add Weekly Working Hours Rule</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <label className="text-xs">
            Day of Week
            <select name="day" className="input w-full min-h-11 mt-1" defaultValue="1" required>
              <option value="1">Monday</option>
              <option value="2">Tuesday</option>
              <option value="3">Wednesday</option>
              <option value="4">Thursday</option>
              <option value="5">Friday</option>
              <option value="6">Saturday</option>
              <option value="0">Sunday</option>
            </select>
          </label>
          <label className="text-xs">
            Start Time
            <input
              name="start"
              type="time"
              defaultValue="08:00"
              required
              className="input w-full min-h-11 mt-1"
            />
          </label>
          <label className="text-xs">
            End Time
            <input
              name="end"
              type="time"
              defaultValue="18:00"
              required
              className="input w-full min-h-11 mt-1"
            />
          </label>
          <label className="text-xs">
            Slot Duration (minutes)
            <input
              name="duration"
              type="number"
              min="15"
              step="5"
              defaultValue="60"
              required
              className="input w-full min-h-11 mt-1"
            />
          </label>
          <label className="text-xs">
            Concurrent Van Capacity
            <input
              name="capacity"
              type="number"
              min="1"
              defaultValue="1"
              required
              className="input w-full min-h-11 mt-1"
            />
          </label>
        </div>
        <button disabled={!canOperate} className="btn btn-primary min-h-11">
          Save Weekly Schedule Rule
        </button>
      </form>

      {/* Slot Generation Form */}
      <form
        className="card space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          confirm('Generate or update calendar slots from the approved schedule?', 'slot.generate', {
            from_date: s(f.get('from')),
            to_date: s(f.get('to')),
          });
        }}
      >
        <h2 className="text-base font-bold text-ink-1">Generate Calendar Slots from Schedule</h2>
        <div className="grid sm:grid-cols-2 gap-3 max-w-lg">
          <label className="text-xs">
            From Date
            <input name="from" type="date" required className="input w-full min-h-11 mt-1" />
          </label>
          <label className="text-xs">
            To Date
            <input name="to" type="date" required className="input w-full min-h-11 mt-1" />
          </label>
        </div>
        <button disabled={!canOperate} className="btn btn-secondary min-h-11">
          Review Slot Generation
        </button>
      </form>

      {/* Block Date Form */}
      <form
        className="card space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          confirm('Block this date and prevent new customer bookings?', 'slot.block', {
            date: s(f.get('date')),
            reason: s(f.get('reason')),
          });
        }}
      >
        <h2 className="text-base font-bold text-ink-1">Block Date (Holiday / Closure)</h2>
        <div className="grid sm:grid-cols-2 gap-3 max-w-lg">
          <label className="text-xs">
            Date to Block
            <input name="date" type="date" required className="input w-full min-h-11 mt-1" />
          </label>
          <label className="text-xs">
            Reason for Blocking
            <input
              name="reason"
              placeholder="e.g. Bank Holiday, Fleet Maintenance"
              minLength={3}
              required
              className="input w-full min-h-11 mt-1"
            />
          </label>
        </div>
        <button disabled={!canOperate} className="btn btn-secondary text-danger min-h-11">
          Review Blocked Date
        </button>
      </form>

      {/* Special Hours Form */}
      <form
        className="card space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void mutate('slot.special.save', {
            date: s(f.get('date')),
            start_time: s(f.get('start')),
            end_time: s(f.get('end')),
            slot_duration_minutes: n(f.get('duration')),
            capacity: n(f.get('capacity')),
            active: true,
            note: s(f.get('note')),
          });
        }}
      >
        <h2 className="text-base font-bold text-ink-1">Special Date Hours (One-off Schedule)</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="text-xs">
            Special Date
            <input name="date" type="date" required className="input w-full min-h-11 mt-1" />
          </label>
          <label className="text-xs">
            Start Time
            <input name="start" type="time" defaultValue="09:00" required className="input w-full min-h-11 mt-1" />
          </label>
          <label className="text-xs">
            End Time
            <input name="end" type="time" defaultValue="14:00" required className="input w-full min-h-11 mt-1" />
          </label>
          <label className="text-xs">
            Slot Duration (minutes)
            <input
              name="duration"
              type="number"
              min="15"
              defaultValue="60"
              required
              className="input w-full min-h-11 mt-1"
            />
          </label>
          <label className="text-xs">
            Capacity
            <input
              name="capacity"
              type="number"
              min="1"
              defaultValue="1"
              required
              className="input w-full min-h-11 mt-1"
            />
          </label>
          <label className="text-xs">
            Note
            <input
              name="note"
              placeholder="e.g. Christmas Eve reduced hours"
              className="input w-full min-h-11 mt-1"
            />
          </label>
        </div>
        <button disabled={!canOperate} className="btn btn-primary min-h-11">
          Save Special Date Hours
        </button>
      </form>

      {/* Rules list */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm uppercase tracking-wider text-ink-3">Weekly Schedule Rules</h3>
        <Records
          rows={data?.rules ?? []}
          render={(r) => (
            <>
              <b>
                {DAY_NAMES[r.day_of_week] ?? `Day ${r.day_of_week}`} · {r.start_time.slice(0, 5)}–
                {r.end_time.slice(0, 5)}
              </b>
              <span>
                {r.slot_duration_minutes} min slots · {r.capacity} van{r.capacity === 1 ? '' : 's'} ·{' '}
                {r.active ? 'Active' : 'Inactive'}
              </span>
            </>
          )}
        />
      </div>

      {/* Blocked dates */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm uppercase tracking-wider text-ink-3">Blocked Dates</h3>
        <Records
          rows={data?.blocked ?? []}
          render={(r) => (
            <>
              <b>{r.date} blocked</b>
              <span>{r.reason}</span>
              <button
                className="btn btn-secondary"
                onClick={() => confirm('Reopen ' + r.date + '?', 'slot.unblock', { date: r.date })}
              >
                Review reopen
              </button>
            </>
          )}
        />
      </div>

      {/* Special hours */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm uppercase tracking-wider text-ink-3">Special Date Overrides</h3>
        <Records
          rows={data?.special ?? []}
          render={(r) => (
            <>
              <b>{r.date} special hours</b>
              <span>
                {r.active
                  ? `${r.start_time.slice(0, 5)}–${r.end_time.slice(0, 5)} · capacity ${r.capacity}`
                  : 'Closed'}{' '}
                · {r.note}
              </span>
              <button
                className="btn btn-secondary text-danger"
                onClick={() =>
                  confirm('Delete special date ' + r.date + '?', 'slot.special.delete', { id: r.id })
                }
              >
                Review delete
              </button>
            </>
          )}
        />
      </div>

      {/* Generated slots */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm uppercase tracking-wider text-ink-3">Generated Calendar Slots</h3>
        <Records
          rows={data?.slots ?? []}
          render={(r) => (
            <>
              <b>
                {r.date} · {r.start_at.slice(0, 5)}–{r.end_at.slice(0, 5)}
              </b>
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  confirm('Change capacity for this generated slot?', 'slot.capacity', {
                    id: r.id,
                    capacity: n(f.get('capacity')),
                  });
                }}
              >
                <span className="text-xs text-ink-3">Capacity:</span>
                <input
                  name="capacity"
                  aria-label="Slot capacity"
                  type="number"
                  min="1"
                  defaultValue={r.capacity}
                  className="input w-20 min-h-9 text-sm"
                />
                <button className="btn btn-secondary min-h-9 text-xs">Review capacity</button>
              </form>
            </>
          )}
        />
      </div>
    </div>
  );
}

function SettingsPricingControl({
  data,
  confirm,
  busy,
}: {
  data: AnyRow;
  confirm: (q: string, a: string, p: AnyRow) => void;
  busy: boolean;
}) {
  const isApproved = Boolean(data?.pricing_configured);

  const requirements = [
    {
      label: 'Standard job duration',
      status: data?.job_duration_minutes ? `${data.job_duration_minutes} mins` : 'Missing (required > 0)',
      ok: Boolean(data?.job_duration_minutes && data.job_duration_minutes > 0),
    },
    {
      label: 'Default fitting fee',
      status: data?.fitting_fee_pence != null ? formatPrice(data.fitting_fee_pence) : 'Missing',
      ok: data?.fitting_fee_pence != null && data.fitting_fee_pence >= 0,
    },
    {
      label: 'Approved cancellation policy',
      status: data?.cancellation_policy ? 'Configured' : 'Missing (required)',
      ok: Boolean(data?.cancellation_policy?.trim()),
    },
    {
      label: 'Bank payment window',
      status: data?.bank_payment_window_minutes
        ? `${data.bank_payment_window_minutes} mins`
        : 'Missing (1–10,080 mins)',
      ok: Boolean(data?.bank_payment_window_minutes && data.bank_payment_window_minutes > 0),
    },
    {
      label: 'Business bank account & sort code',
      status: data?.bank_account_configured ? 'Configured' : 'Configured via Bank Transfer Settings above',
      ok: Boolean(data?.bank_account_configured),
    },
  ];

  const allMet = requirements.every((r) => r.ok);

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <h2 className="text-lg font-bold text-ink-1">Live Checkout & Pricing Approval</h2>
          <p className="text-xs text-ink-3">
            Public customer checkout requires explicit business owner approval of all mandatory pricing and bank settings.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded border ${
            isApproved
              ? 'bg-success/15 text-success border-success/30'
              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
          }`}
        >
          {isApproved ? (
            <>
              <ShieldCheck size={14} /> Live Checkout Enabled
            </>
          ) : (
            <>
              <AlertTriangle size={14} /> Checkout Paused (Approval Required)
            </>
          )}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-2 text-xs">
        {requirements.map((r) => (
          <div key={r.label} className="flex items-center justify-between p-2 rounded bg-surface-2 border border-line">
            <span className="text-ink-2">{r.label}</span>
            <span className={`font-semibold ${r.ok ? 'text-success' : 'text-amber-400'}`}>
              {r.status}
            </span>
          </div>
        ))}
      </div>

      <div className="pt-2 flex flex-wrap gap-3">
        {!isApproved ? (
          <button
            disabled={busy || !allMet}
            className="btn btn-primary min-h-11"
            onClick={() =>
              confirm(
                'Are you sure you want to approve all business pricing, fees, duration, and bank terms to ENABLE live customer checkout?',
                'settings.approve_pricing',
                { reason: 'Owner approved live pricing configuration' },
              )
            }
          >
            Approve Pricing & Enable Live Checkout
          </button>
        ) : (
          <button
            disabled={busy}
            className="btn btn-secondary text-danger min-h-11"
            onClick={() =>
              confirm(
                'Are you sure you want to pause live customer checkout? No new customer bookings will be accepted until re-approved.',
                'settings.revoke_pricing',
                { reason: 'Owner paused live checkout' },
              )
            }
          >
            Revoke Approval & Pause Checkout
          </button>
        )}
      </div>
    </div>
  );
}

function SettingsForm({
  data,
  save,
  busy,
}: {
  data: AnyRow;
  save: (p: AnyRow) => void;
  busy: boolean;
}) {
  if (!data) return null;
  return (
    <form
      className="card space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        save({
          phone: s(f.get('phone')),
          email: s(f.get('email')),
          whatsapp: s(f.get('whatsapp')),
          fitting_fee_pence: n(f.get('fitting_fee_pence')),
          job_duration_minutes: n(f.get('job_duration_minutes')),
          booking_horizon_days: n(f.get('booking_horizon_days')),
          same_day_enabled: f.get('same_day_enabled') === 'on',
          same_day_cutoff: s(f.get('same_day_cutoff')),
          vat_registered: f.get('vat_registered') === 'on',
          vat_number: s(f.get('vat_number')),
          vat_rate_bps: n(f.get('vat_rate_bps')),
          cancellation_notice_hours: n(f.get('cancellation_notice_hours')),
          cancellation_policy: s(f.get('cancellation_policy')),
          terms_and_conditions: s(f.get('terms_and_conditions')),
          privacy_policy: s(f.get('privacy_policy')),
        });
      }}
    >
      <h2 className="text-lg font-bold text-ink-1">General Business Settings</h2>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <label className="text-xs">
          Public Telephone Number
          <input
            name="phone"
            type="tel"
            defaultValue={data.phone ?? ''}
            className="input w-full min-h-11 mt-1"
          />
        </label>
        <label className="text-xs">
          Notification Email
          <input
            name="email"
            type="email"
            defaultValue={data.email ?? ''}
            className="input w-full min-h-11 mt-1"
          />
        </label>
        <label className="text-xs">
          WhatsApp Contact Number
          <input
            name="whatsapp"
            type="tel"
            defaultValue={data.whatsapp ?? ''}
            className="input w-full min-h-11 mt-1"
          />
        </label>
        <label className="text-xs">
          Default Fitting Fee (pence, e.g. 2000 = £20.00)
          <input
            name="fitting_fee_pence"
            type="number"
            min="0"
            defaultValue={data.fitting_fee_pence ?? 2000}
            required
            className="input w-full min-h-11 mt-1"
          />
        </label>
        <label className="text-xs">
          Standard Job Duration (minutes)
          <input
            name="job_duration_minutes"
            type="number"
            min="15"
            defaultValue={data.job_duration_minutes ?? 60}
            required
            className="input w-full min-h-11 mt-1"
          />
        </label>
        <label className="text-xs">
          Booking Horizon (days in advance)
          <input
            name="booking_horizon_days"
            type="number"
            min="1"
            max="90"
            defaultValue={data.booking_horizon_days ?? 14}
            required
            className="input w-full min-h-11 mt-1"
          />
        </label>
        <label className="text-xs">
          Same-Day Cutoff Time
          <input
            name="same_day_cutoff"
            type="time"
            defaultValue={data.same_day_cutoff?.slice?.(0, 5) ?? '14:00'}
            className="input w-full min-h-11 mt-1"
          />
        </label>
        <label className="text-xs">
          VAT Registration Number
          <input
            name="vat_number"
            defaultValue={data.vat_number ?? ''}
            placeholder="GB..."
            className="input w-full min-h-11 mt-1"
          />
        </label>
        <label className="text-xs">
          VAT Rate (basis points, 2000 = 20%)
          <input
            name="vat_rate_bps"
            type="number"
            min="0"
            defaultValue={data.vat_rate_bps ?? 2000}
            required
            className="input w-full min-h-11 mt-1"
          />
        </label>
        <label className="text-xs">
          Cancellation Notice Required (hours)
          <input
            name="cancellation_notice_hours"
            type="number"
            min="0"
            defaultValue={data.cancellation_notice_hours ?? 24}
            required
            className="input w-full min-h-11 mt-1"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-4 pt-2">
        <label className="flex items-center gap-2 text-sm">
          <input name="same_day_enabled" type="checkbox" defaultChecked={data.same_day_enabled} />
          Enable same-day bookings
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input name="vat_registered" type="checkbox" defaultChecked={data.vat_registered} />
          Business is VAT registered
        </label>
      </div>

      <div className="space-y-3 pt-2">
        <label className="block text-xs">
          Approved Cancellation Policy
          <textarea
            name="cancellation_policy"
            defaultValue={data.cancellation_policy ?? ''}
            required
            rows={3}
            className="input w-full mt-1 p-2"
          />
        </label>
        <label className="block text-xs">
          Terms & Conditions
          <textarea
            name="terms_and_conditions"
            defaultValue={data.terms_and_conditions ?? ''}
            rows={3}
            className="input w-full mt-1 p-2"
          />
        </label>
        <label className="block text-xs">
          Privacy Policy
          <textarea
            name="privacy_policy"
            defaultValue={data.privacy_policy ?? ''}
            rows={3}
            className="input w-full mt-1 p-2"
          />
        </label>
      </div>

      <button disabled={busy} className="btn btn-primary min-h-11">
        Save business settings
      </button>
    </form>
  );
}
