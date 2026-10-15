import { test, expect, type Page } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { buildGate3Harness } from './gate3-build-harness.mjs';

const id = '00000000-0000-4000-8000-000000000005', token = '00000000-0000-4000-8000-000000000004';
const reference = 'GF-00000000000040008000000000000005';
const bank = { bank_name: 'UI Test Bank', bank_account_name: 'UI Test Only', sort_code: '000000', account_number: '00000000' };
const pending = { id, booking_ref: reference, manage_token: token, booking_source: 'phone', status: 'AWAITING_BANK_PAYMENT',
  bank_payment_expires_at: '2030-01-01T12:00:00Z', customer: { name: 'UI Test Only' }, slot: null, items: [], fitter_id: null,
  total_amount: 11700, deposit_amount: 11700, balance_due: 0, tyres_total: 10000, fitting_fee: 1700, callout_charge: 0,
  bank_payment: { provider: 'manual', payment_method: 'bank_transfer', status: 'pending', amount_pence: 11700, currency: 'gbp', reference,
    bank_details: bank, paid_at: null as string | null, verified: false },
};
test.beforeAll(async () => { await buildGate3Harness(); });
async function noOverflow(page: Page) {
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.client);
  for (const button of await page.locator('button:visible, .btn:visible').all()) {
    const box = await button.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(44); expect(box!.width).toBeGreaterThanOrEqual(44);
  }
}
async function harness(page: Page, kind: string, viewer = false, query = '') {
  const css = readdirSync('.next/static/css').filter(f => f.endsWith('.css')).map(f => `<link rel="stylesheet" href="/_next/static/css/${f}">`).join('');
  await page.route('**/__gate3_harness*', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1">${css}</head><body><main class="container-g section min-w-0"><div id="root"></div></main></body></html>` }));
  await page.goto('/__gate3_harness' + query); await page.addScriptTag({ path: '.local-postgres/gate3-harness-' + process.pid + '.js' });
  await page.evaluate(({ kind, viewer }) => window.mountGate3(kind, viewer), { kind, viewer });
}
test('bank instructions show full amount and no paid claim; verified receipt changes customer status', async ({ page }) => {
  let received = false;
  await page.route('**/api/manage/' + token, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true,
    data: { ...pending, status: received ? 'CONFIRMED' : pending.status, bank_payment: { ...pending.bank_payment,
      status: received ? 'received' : 'pending', verified: received, paid_at: received ? '2026-10-10T12:00:00Z' : null } } }) }));
  await page.goto('/manage/' + token);
  await expect(page.getByRole('heading', { name: 'Booking reserved', exact: true })).toBeVisible();
  await expect(page.getByText('Your fitting is reserved while we wait for payment.', { exact: false })).toBeVisible();
  await expect(page.locator('main')).toContainText('UI Test Bank'); await expect(page.locator('main')).toContainText('00-00-00');
  await expect(page.locator('main')).not.toContainText('Payment received'); await expect(page.locator('main .ring-brand')).toHaveCount(0);
  await noOverflow(page);
  received = true; await page.reload();
  await expect(page.getByText('Booking confirmed', { exact: true })).toBeVisible();
  await expect(page.locator('main')).toContainText('Payment received'); await expect(page.locator('main .ring-brand')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Booking reserved', exact: true })).toHaveCount(0); await noOverflow(page);
});
test('unconfigured bank instructions block payment without invented account details', async ({ page }) => {
  await page.route('**/api/manage/' + token, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: { ...pending, bank_payment: null } }) }));
  await page.goto('/manage/' + token); await expect(page.getByRole('main').getByRole('alert')).toContainText('Bank payment is blocked');
  await expect(page.getByRole('button', { name: 'Copy payment instructions' })).toHaveCount(0); await noOverflow(page);
});
test('actual staff component requires confirmation, cancels safely, and submits exact bank receipt assertion', async ({ page }) => {
  const mutations: object[] = []; let current = pending;
  await page.route('**/api/admin/bookings', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: [current] }) }));
  await page.route('**/api/admin/payments', route => { mutations.push(route.request().postDataJSON()); current = { ...pending, status: 'CONFIRMED', bank_payment: { ...pending.bank_payment, status: 'received', verified: true, paid_at: '2026-10-10T12:00:00Z' } };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) }); });
  await harness(page, 'bookings'); await page.getByLabel('Select booking').selectOption(id);
  await page.getByRole('button', { name: 'MARK PAYMENT RECEIVED', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.getByRole('dialog')).toContainText('Have you confirmed £117.00 has arrived in the G Force business bank account?');
  expect(mutations).toHaveLength(0); await page.getByRole('button', { name: 'Cancel', exact: true }).click(); expect(mutations).toHaveLength(0);
  await page.getByRole('button', { name: 'MARK PAYMENT RECEIVED', exact: true }).click(); await noOverflow(page);
  await page.getByRole('button', { name: 'Yes, receipt verified' }).click();
  await expect(page.getByRole('status')).toContainText('Change saved and audited.');
  expect(mutations).toEqual([{ action: 'verify', booking_id: id, expected_amount_pence: 11700, bank_receipt_confirmed: true }]);
  await expect(page.getByRole('button', { name: 'MARK PAYMENT RECEIVED', exact: true })).toHaveCount(0);
});
test('actual viewer component has no mutation, email or phone-booking controls', async ({ page }) => {
  await page.route('**/api/admin/bookings', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: [pending] }) }));
  await harness(page, 'bookings', true); await page.getByLabel('Select booking').selectOption(id);
  await expect(page.getByRole('button', { name: 'MARK PAYMENT RECEIVED', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Email payment instructions' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Create phone booking' })).toHaveCount(0);
  await expect(page.getByText('Extend payment window', { exact: true })).toHaveCount(0); await noOverflow(page);
});
test('owner bank settings start empty and report configuration required', async ({ page }) => {
  await page.route('**/api/admin/bank-settings', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, configured: false, data: { bank_account_name: null, bank_name: null, sort_code: null, account_number: null, bank_payment_window_minutes: null } }) }));
  await harness(page, 'settings'); await expect(page.getByRole('status')).toContainText('Configuration required');
  for (const label of ['Account name','Bank name','Sort code','Account number','Payment window (minutes)']) await expect(page.getByLabel(label, { exact: true })).toHaveValue('');
  await noOverflow(page);
});
test('actual staff controls copy instructions, email without a delivery claim and explicitly extend', async ({ page, browserName }) => {
  const bodies: object[] = [];
  if (browserName === 'chromium') await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  else await page.addInitScript(() => {
    // WebKit has no Playwright clipboard permission override. Exercise the
    // real denial fallback without reading the operating-system clipboard.
    Object.defineProperty(navigator, 'clipboard', { configurable:true, value:{ writeText:async()=>{ throw new Error('Test-only copy denial'); } } });
  });
  await page.route('**/api/admin/bookings', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: [pending] }) }));
  await page.route('**/api/admin/payments/instructions', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, message: 'Email accepted by the provider. Inbox delivery is not confirmed.' }) }));
  await page.route('**/api/admin/payments', route => { bodies.push(route.request().postDataJSON()); return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) }); });
  await harness(page, 'bookings'); await page.getByLabel('Select booking').selectOption(id);
  await page.getByRole('button', { name: 'Copy payment instructions' }).click();
  if (browserName === 'chromium') {
    await expect(page.getByText('Payment instructions copied.', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Amount due: £117.00');
  } else {
    await expect(page.getByText('Copy was unavailable. Please select the bank details below.')).toBeVisible();
    await expect(page.getByText('Payment instructions copied.', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('region', { name:'Bank transfer instructions' })).toContainText('UI Test Bank');
  }
  await page.getByRole('button', { name: 'Email payment instructions' }).click(); await expect(page.getByRole('status').first()).toContainText('Inbox delivery is not confirmed');
  await page.getByLabel('Additional minutes').fill('30'); await page.getByLabel('Reason for extension').fill('Customer requested additional transfer time');
  await page.getByRole('button', { name: 'Check availability and extend' }).click(); await expect(page.getByRole('status').first()).toContainText('Change saved and audited');
  expect(bodies).toEqual([{ action: 'extend', booking_id: id, minutes: 30, reason: 'Customer requested additional transfer time', expected_expires_at: pending.bank_payment_expires_at }]);
  await noOverflow(page);
});
test('phone wizard uses actual shared customer journey and the protected phone endpoint', async ({ page }) => {
  const tyre = { id:'00000000-0000-4000-8000-000000000001', brand:'UI Test', model:'Phone fixture', sku:'test-only', width:205,profile:55,rim:16, stock:2,sell_price:10000, active:true,tier:'standard' };
  const slot = { id:'00000000-0000-4000-8000-000000000003',slot_date:'2030-01-02',start_time:'10:00:00',end_time:'12:00:00',active:true,available:true,remaining:1,max_bookings:1 };
  const zone = { id:'test-only',zone_name:'Test only',postcode_prefix:'E14',callout_charge:0,active:true };
  let payload: Record<string, unknown> | null = null;
  await page.route('**/api/tyres?*', route => route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:[tyre]})}));
  await page.route('**/api/slots', route => route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:[slot]})}));
  await page.route('**/api/postcode/check', route => route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,covered:true,data:{zone}})}));
  await page.route('**/api/checkout/quote', route => route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:{lines:[{tyre_id:tyre.id,label:'Test only',quantity:1,unit_price:10000,line_total:10000}],tyres_total:10000,fitting_fee:1700,callout_charge:0,total_amount:11700,deposit_amount:11700,balance_due:0}})}));
  await page.route('**/api/admin/bookings/phone', route => { payload=route.request().postDataJSON();return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,message:'Test service unavailable. Reservation unconfirmed.'})}); });
  await harness(page,'phone',false,'?tyre='+tyre.id+'&w=205&p=55&r=16&pc=E14%208PX');
  await page.getByRole('button',{name:'Continue to Location & Vehicle'}).click();await page.getByRole('button',{name:'Choose Fitting Slot'}).click();
  await page.getByRole('button',{name:/10am.*12pm/}).click();await page.getByRole('button',{name:'Enter Contact Details'}).click();
  await page.getByLabel('Full Name').fill('Phone Test Only');await page.locator('#email').fill('phone@example.invalid');await page.locator('#phone').fill('+441632960001');await page.locator('#address1').fill('Phone fixture only');
  await page.getByRole('button',{name:'Reserve for Bank Payment'}).click();await expect(page.getByRole('alert')).toContainText('Reservation unconfirmed');
  expect(payload).not.toBeNull();expect(payload).not.toHaveProperty('price');expect(payload).not.toHaveProperty('booking_source');await noOverflow(page);
});
