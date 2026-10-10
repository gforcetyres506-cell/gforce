import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createBusinessContact } from '../../src/lib/business-contact';

const contactsConfigured = process.env.UI_TEST_CONTACTS !== 'off';
const tyre = {
  id: '00000000-0000-4000-8000-000000000001', brand: 'UI test', model: 'Responsive test tyre', sku: 'ui-test',
  width: 225, profile: 45, rim: 18, tier: 'standard', season: 'summer',
  sell_price: 10000, cost_price: 5000, stock: 4, active: true,
  is_run_flat: false, is_xl: false, load_index: '95', speed_rating: 'Y',
  fuel_economy: 'B', wet_grip: 'A', noise_db: 70, created_at: '2026-01-01',
};
const zone = { id: 'ui-zone', postcode_prefix: 'E14', zone_name: 'UI test zone', callout_charge: 0, active: true };
const slot = {
  id: '00000000-0000-4000-8000-000000000003', slot_date: '2030-01-02', start_time: '10:00:00', end_time: '12:00:00',
  max_bookings: 2, available: true, remaining: 2, active: true,
};
const rear = { ...tyre, id: '00000000-0000-4000-8000-000000000002', width: 255, profile: 40, sell_price: 12000 };
const journey = '/booking?tyre=00000000-0000-4000-8000-000000000001&w=225&p=45&r=18&pc=E14%208PX';

test.beforeEach(async ({ page }) => {
  // TEST_ONLY_SAFE: exercise widget callbacks without external Cloudflare traffic.
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?*', (route) => route.fulfill({
    contentType: 'application/javascript', body: 'window.turnstile={render:function(el,options){options.callback("ui-token");return "ui-widget"},remove:function(){}}',
  }));
  // Browser fixtures are isolated from the credential-free production server.
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: object = { ok: false, error: 'not_found', message: 'No matching UI fixture' };
    if (path === '/api/tyres') body = { ok: true, data: [tyre, rear] };
    if (path === '/api/slots') body = { ok: true, data: [slot] };
    if (path === '/api/postcode/check') body = { ok: true, covered: true, data: { zone } };
    if (path === '/api/account/me') body = { ok: false };
    if (path === '/api/holds/create') body = { ok: true, data: { hold_id: 'ui-hold', slot_id: slot.id, expires_at: new Date(Date.now() + 900000).toISOString() } };
    if (path === '/api/checkout/quote') {
      const items: Array<{ tyre_id: string; quantity: number }> = route.request().postDataJSON().items;
      const lines = items.map((item) => ({ ...item, label: 'UI quote fixture', unit_price: item.tyre_id === rear.id ? rear.sell_price : tyre.sell_price,
        line_total: item.quantity * (item.tyre_id === rear.id ? rear.sell_price : tyre.sell_price) }));
      const tyres_total = lines.reduce((sum, line) => sum + line.line_total, 0);
      body = { ok: true, data: { lines, tyres_total, fitting_fee: 1700, callout_charge: 0,
        total_amount: tyres_total + 1700, deposit_amount: tyres_total + 1700, balance_due: 0 } };
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
});

async function noOverflow(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const dimensions = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
  for (const action of await page.locator('[data-critical-action]:visible, .btn:visible, .mobile-header-cta:visible, .slot:visible').all()) {
    await touchTarget(action);
  }
}

async function touchTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

async function customerAccessibility(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
  const smallText = await page.locator('main :is(p, label, span, button, a)').evaluateAll((nodes) => nodes
    .filter((node) => {
      const element = node as HTMLElement;
      return element.innerText?.trim() && element.getBoundingClientRect().height > 0 && getComputedStyle(element).visibility !== 'hidden';
    })
    .filter((node) => parseFloat(getComputedStyle(node).fontSize) < 12)
    .map((node) => (node as HTMLElement).innerText));
  expect(smallText).toEqual([]);
}

async function publicNavigation(page: Page) {
  await expect(page.locator('header a, footer a, [role="dialog"] a').filter({ hasText: /Staff|Operator Login|Admin Dispatch Console|Staff Portal|Sign in/i })).toHaveCount(0);
  await expect(page.locator('header a[href^="/admin"], footer a[href^="/admin"], header a[href^="/account"], [role="dialog"] a[href^="/admin"], [role="dialog"] a[href^="/account"]')).toHaveCount(0);
}

test('contact configuration has no invented defaults', () => {
  expect(createBusinessContact()).toEqual({ phone: null, whatsapp: null });
  expect(createBusinessContact('not a number', 'javascript:alert(1)')).toEqual({ phone: null, whatsapp: null });
  expect(createBusinessContact('+44 1632 960001').phone?.href).toBe('tel:+441632960001');
  expect(createBusinessContact(undefined, '+441632960002')).toEqual({ phone: null, whatsapp: { href: 'https://wa.me/441632960002' } });
});

test('public pages: metadata, contact configuration and no overflow', async ({ page }) => {
  const titles = new Set<string>();
  for (const path of ['/', '/tyres', journey, '/manage/ui-invalid-token', '/terms', '/privacy', '/cancellation']) {
    await page.goto(path);
    await noOverflow(page);
    await publicNavigation(page);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S/);
    titles.add(await page.title());
    if (contactsConfigured) {
      await expect(page.locator('a[href="tel:+441632960001"]:visible').first()).toBeVisible();
      await expect(page.locator('a[href="https://wa.me/441632960002"]:visible').first()).toBeVisible();
    } else {
      await expect(page.locator('a[href^="tel:"], a[href*="wa.me"]')).toHaveCount(0);
      await expect(page.getByRole('complementary', { name: 'Contact G Force Tyres' })).toHaveCount(0);
    }
  }
  expect(titles.size).toBe(7);
  const response = await page.goto('/ui-page-that-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('main')).toContainText('G Force Tyres');
  await noOverflow(page);
  await customerAccessibility(page);
});

test('finder, contact locations and mobile navigation are accessible', async ({ page }) => {
  await page.goto('/');
  const finder = page.locator('#tyre-finder');
  await expect(finder.getByLabel('Fitting postcode')).toBeVisible();
  await touchTarget(finder.getByRole('button', { name: 'Check area' }));
  await touchTarget(finder.getByRole('button', { name: 'Enter it manually' }));
  await customerAccessibility(page);
  if (contactsConfigured) {
    await expect(page.locator('.hero-copy a[href^="tel:"]')).toHaveCount(1);
    await expect(page.locator('footer a[href^="tel:"]')).toHaveCount(1);
    if (page.viewportSize()!.width < 1024) {
      await touchTarget(page.getByRole('complementary', { name: 'Contact G Force Tyres' }).getByRole('link', { name: 'Call to book' }));
    } else {
      await expect(page.locator('header a[href^="tel:"]')).toBeVisible();
    }
  }
  if (page.viewportSize()!.width < 1024) {
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    const drawer = page.getByRole('dialog', { name: 'Navigation' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Close navigation menu' })).toBeFocused();
    await publicNavigation(page);
    if (contactsConfigured) await expect(drawer.getByRole('link', { name: 'Call to book' })).toBeVisible();
    await noOverflow(page);
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeFocused();
  }
  await finder.getByRole('button', { name: 'Enter it manually' }).click();
  await expect(finder.getByRole('button', { name: 'Show Available Tyres' })).toBeVisible();
  for (const label of ['Width', 'Profile', 'Rim']) await expect(finder.getByLabel(label, { exact: true })).toHaveValue('');
  const manualContinue = finder.getByRole('button', { name: 'Show Available Tyres' });
  await expect(manualContinue).toBeDisabled();
  await finder.getByLabel('Width', { exact: true }).selectOption('205');
  await finder.getByLabel('Profile', { exact: true }).selectOption('55');
  await expect(manualContinue).toBeDisabled();
  await finder.getByLabel('Rim', { exact: true }).selectOption('16');
  await expect(manualContinue).toBeEnabled();
  await touchTarget(finder.getByRole('button', { name: 'Show Available Tyres' }));
  await noOverflow(page);
  await customerAccessibility(page);
  const fonts = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    display: getComputedStyle(document.querySelector('h1')!).fontFamily,
    loaded: [...document.fonts].filter((font) => font.status === 'loaded').length,
  }));
  expect(fonts.body).toContain('Inter');
  expect(fonts.display).toContain('Bebas Neue');
  expect(fonts.loaded).toBeGreaterThanOrEqual(2);
});

test('all four booking steps fit, have named controls and autofill', async ({ page }) => {
  await page.goto(journey);
  await expect(page.getByRole('heading', { name: tyre.model })).toBeVisible();
  await expect(page.getByText('Standard', { exact: true })).toBeVisible();
  for (const button of await page.getByRole('group', { name: 'Booking progress' }).getByRole('button').all()) {
    await touchTarget(button);
    await expect(button).toHaveAccessibleName(/Step \d:/);
  }
  await expect(page.getByRole('button', { name: 'Step 1: Tyres & Qty', exact: true })).toHaveAttribute('aria-current', 'step');
  await touchTarget(page.getByRole('button', { name: 'Increase tyre quantity', exact: true }));
  await page.getByRole('checkbox').check();
  await expect(page.getByLabel('Select Rear Tyre Model')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Continue to Location & Vehicle' })).toBeDisabled();
  await page.getByLabel('Select Rear Tyre Model').selectOption(rear.id);
  await touchTarget(page.getByRole('button', { name: 'Increase rear tyre quantity' }));
  await noOverflow(page);
  await customerAccessibility(page);
  await page.getByRole('button', { name: 'Continue to Location & Vehicle' }).click();
  await expect(page.getByLabel('London Postcode')).toHaveAttribute('autocomplete', 'postal-code');
  await noOverflow(page);
  await customerAccessibility(page);
  await page.getByRole('button', { name: 'Choose Fitting Slot' }).click();
  await expect(page.getByRole('button', { name: /10am.*12pm/ })).toBeVisible();
  await noOverflow(page);
  await customerAccessibility(page);
  await page.getByRole('button', { name: /10am.*12pm/ }).click();
  await page.getByRole('button', { name: 'Enter Contact Details' }).click();
  for (const [id,autocomplete] of [['name','name'],['email','email'],['phone','tel'],['address1','street-address']]) {
    await expect(page.locator('#' + id)).toHaveAttribute('autocomplete', autocomplete);
  }
  await touchTarget(page.getByRole('button', { name: 'Reserve for Bank Payment' }));
  await noOverflow(page);
  await customerAccessibility(page);
  await expect(page.locator('main')).toContainText('£17.00');
  await expect(page.locator('main')).toContainText('£237.00');
  await expect(page.locator('main')).toContainText('Full amount due by bank transfer');
});

test('error and empty states offer only configured contact actions', async ({ page }) => {
  await page.route('**/api/postcode/check', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, covered: false }) }));
  await page.goto('/');
  await page.getByLabel('Fitting postcode').fill('ZZ1 1ZZ');
  await page.getByRole('button', { name: 'Check area' }).click();
  await expect(page.locator('#tyre-finder').getByRole('alert')).toContainText('outside our current fitting area');
  if (contactsConfigured) await expect(page.locator('#tyre-finder a[href^="tel:"]')).toBeVisible();
  await noOverflow(page);
  await page.goto('/tyres?w=999&p=99&r=99');
  await expect(page.getByRole('heading', { name: 'Inventory unavailable' })).toBeVisible();
  if (contactsConfigured) await expect(page.locator('main a[href^="tel:"]')).toBeVisible();
  await noOverflow(page);
  await customerAccessibility(page);
});

test('catalogue fails closed without database configuration', async ({ page }) => {
  await page.goto('/tyres?tier=standard');
  await expect(page.getByRole('link', { name: 'Standard', exact: true })).toHaveAttribute('href', /tier=standard/);
  await expect(page.getByRole('heading', { name: 'Inventory unavailable' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Select & Choose Slot' })).toHaveCount(0);
  await expect(page.locator('.card-tyre')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('Mid-Range');
  await noOverflow(page);
  await customerAccessibility(page);
});

test('missing context redirects to finder and unknown tyre never selects another', async ({ page }) => {
  await page.goto('/booking');
  await expect(page).toHaveURL('/#tyre-finder');
  await page.goto('/booking?tyre=wrong-id&w=225&p=45&r=18');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('That tyre is unavailable');
  await expect(page.getByRole('heading', { name: tyre.model })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue to Location & Vehicle' })).toBeDisabled();
  await page.getByRole('button', { name: 'Step 4: Contact & Reserve' }).click();
  await expect(page.getByLabel('Full Name')).toHaveCount(0);
  await noOverflow(page);
});

test('unavailable vehicle lookup switches to empty manual size fields', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Fitting postcode').fill('E14 8PX');
  await page.getByRole('button', { name: 'Check area' }).click();
  await page.getByLabel('Enter the vehicle registration').fill('AB21ABC');
  await page.getByRole('button', { name: 'Find matching size' }).click();
  for (const label of ['Width', 'Profile', 'Rim']) await expect(page.getByLabel(label, { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Show Available Tyres' })).toBeDisabled();
  await expect(page.locator('main')).not.toContainText('BMW');
});

async function reachCheckout(page: Page) {
  await page.goto(journey);
  await page.getByRole('button', { name: 'Continue to Location & Vehicle' }).click();
  await page.getByRole('button', { name: 'Choose Fitting Slot' }).click();
  await page.getByRole('button', { name: /10am.*12pm/ }).click();
  await expect(page.locator('main')).toContainText('Time selected.');
  await expect(page.locator('main')).not.toContainText('Time reserved until');
  await page.getByRole('button', { name: 'Enter Contact Details' }).click();
  await page.getByLabel('Full Name').fill('UI Test Only');
  await page.locator('#email').fill('ui@example.invalid');
  await page.locator('#phone').fill('+441632960001');
  await page.locator('#address1').fill('Test fixture only');
}

for (const failure of ['network', 'database', 'malformed result', 'slot conflict']) {
  test('atomic checkout failure is truthful: ' + failure, async ({ page }) => {
    await page.route('**/api/checkout/create', async (route) => {
      if (failure === 'network') return route.abort('failed');
      await route.fulfill({ status: failure === 'database' ? 503 : failure === 'slot conflict' ? 409 : 200,
        contentType: 'application/json', body: JSON.stringify(failure === 'slot conflict'
          ? { ok: false, message: 'That fitting time could not be reserved. Please choose another.' }
          : { ok: failure === 'malformed result', data: { status: 'AWAITING_BANK_PAYMENT' } }) });
    });
    await reachCheckout(page);
    await page.getByRole('button', { name: 'Reserve for Bank Payment' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText(failure === 'slot conflict' ? 'could not be reserved' : 'could not be verified');
    await expect(page).toHaveURL(/booking/);
    await expect(page.locator('main')).not.toContainText('Booking confirmed');
    await noOverflow(page);
  });
}

test('checkout retries keep the same key and slot selection creates no premature hold', async ({ page }) => {
  const keys: string[] = [];
  let prematureHolds = 0;
  page.on('request', (request) => { if (request.url().includes('/api/holds/create')) prematureHolds++; });
  await page.route('**/api/checkout/create', async route => {
    const payload = route.request().postDataJSON(); keys.push(payload.session_token);
    expect(Object.keys(payload)).not.toContain('price');
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false }) });
  });
  await reachCheckout(page);
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Reserve for Bank Payment' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText('could not be verified');
  }
  expect(prematureHolds).toBe(0); expect(keys).toHaveLength(2); expect(keys[0]).toBe(keys[1]);
});

test('confirmed atomic reservation shows bank deadline and rechecks expiry without a paid claim', async ({ page }) => {
  const token = '00000000-0000-4000-8000-000000000004';
  let deadline = '';
  let reads = 0;
  await page.route('**/api/checkout/create', route => {
    deadline = new Date(Date.now() + 3500).toISOString();
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: {
      booking_id: '00000000-0000-4000-8000-000000000005', reference: 'UI-BANK-ONLY', manage_token: token,
      status: 'AWAITING_BANK_PAYMENT', expires_at: deadline, total_pence: 11700, deposit_pence: 11700, balance_pence: 0,
    } }) });
  });
  await page.route('**/api/manage/' + token, route => {
    reads++;
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: {
      id: 'ui-bank-only', booking_ref: 'UI-BANK-ONLY', status: reads > 1 ? 'EXPIRED' : 'AWAITING_BANK_PAYMENT',
      bank_payment_expires_at: deadline, fitter_id: null, customer: null, slot: null, items: [],
      total_amount: 11700, deposit_amount: 11700, balance_due: 0, deposit_paid_at: null,
      bank_payment: { provider: 'manual', payment_method: 'bank_transfer', status: 'pending', amount_pence: 11700, currency: 'gbp', reference: 'UI-BANK-ONLY', paid_at: null, verified: false, bank_details: { bank_name: 'UI test bank', bank_account_name: 'UI Test Only', sort_code: '000000', account_number: '00000000' } },
    } }) });
  });
  await reachCheckout(page);
  await page.getByRole('button', { name: 'Reserve for Bank Payment' }).click();
  await expect(page).toHaveURL('/manage/' + token);
  await expect(page.getByText('Awaiting bank payment', { exact: true })).toBeVisible();
  await expect(page.locator('main')).toContainText('Your booking is confirmed after G Force verifies receipt.');
  await expect(page.locator('main .ring-brand')).toHaveCount(0);
  await expect(page.getByText('Booking expired', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('main')).toContainText('fitting time and tyres have been released');
  await noOverflow(page);
});

test('pricing outage blocks the journey without invented totals', async ({ page }) => {
  await page.route('**/api/checkout/quote', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false }) }));
  await page.goto(journey);
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Pricing unavailable. Cannot continue.');
  await page.getByRole('button', { name: 'Continue to Location & Vehicle' }).click();
  await expect(page.getByRole('button', { name: 'Choose Fitting Slot' })).toBeDisabled();
  await expect(page.locator('main')).not.toContainText('£20.00');
  await expect(page.locator('main')).not.toContainText('£50.00');
  await expect(page.locator('main')).toContainText('Unavailable');
});

test('pending bookings have no paid step or fictional fitter', async ({ page }) => {
  await page.route('**/api/manage/ui-pending', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    ok: true, data: { id: 'ui-booking', booking_ref: 'UI-PENDING', status: 'pending_payment',
      fitter_id: null, customer: null, slot: null, items: [], total_amount: 10000, deposit_amount: 3000,
      balance_due: 7000, deposit_paid_at: null, stripe_payment_intent_id: null, stripe_charge_id: null },
  }) }));
  await page.goto('/manage/ui-pending');
  await expect(page.getByText('Fitter not assigned yet', { exact: true })).toBeVisible();
  await expect(page.getByText('Deposit required', { exact: true })).toBeVisible();
  await expect(page.locator('main .ring-brand')).toHaveCount(0);
  await noOverflow(page);
});

test('payment screen ignores browser state and never offers fake payment', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('gf_checkout_data', JSON.stringify({ is_mock_payment: true, breakdown: { deposit_amount: 5000 } })));
  await page.goto('/booking/pay?ref=not-a-booking');
  await expect(page.getByRole('heading', { name: 'Pay by bank transfer' })).toBeVisible();
  await expect(page.locator('main input, main form')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /confirm|pay|test/i })).toHaveCount(0);
  await noOverflow(page);
});

test('credential-free production APIs fail closed', async ({ request }) => {
  for (const path of ['/api/tyres', '/api/slots', '/api/manage/not-a-booking', '/api/account/me']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(path === '/api/account/me' ? 404 : 503);
    expect((await response.json()).ok).toBe(false);
  }
  const hold = { slot_id: '00000000-0000-4000-8000-000000000001', session_token: 'isolated-ui-test-session' };
  const cases: Array<[string, object, number]> = [
    ['/api/admin/payments', { action: 'verify', booking_id: '00000000-0000-4000-8000-000000000005', expected_amount_pence: 11700, bank_receipt_confirmed: true }, 503],
    ['/api/admin/payments/instructions', { booking_id: '00000000-0000-4000-8000-000000000005' }, 503],
    ['/api/admin/bookings/phone', {}, 503],
    ['/api/checkout/create', {}, 400],
    ['/api/checkout/confirm-mock', {}, 404],
    ['/api/holds/create', hold, 503], ['/api/holds/release', hold, 503],
    ['/api/checkout/quote', { postcode: 'E14 8PX', items: [{ tyre_id: tyre.id, quantity: 1 }] }, 503],
    ['/api/vrm/lookup', { registration: 'AB21ABC', postcode: 'E14 8PX' }, 503],
    ['/api/account/signup', { name: 'UI test', email: 'test@example.com', password: 'isolated-test-password', phone: '07700900001' }, 404],
  ];
  for (const [path, data, status] of cases) {
    const response = await request.post(path, { data });
    expect(response.status(), path).toBe(status);
    expect((await response.json()).ok).toBe(false);
  }
});

for (const axle of ['front','rear','both'] as const) {
  test('sidewall confirmation is mandatory for staggered ' + axle, async ({ page }) => {
    await page.route('**/api/vrm/lookup', async (route) => {
      expect(route.request().postDataJSON().turnstileToken).toBe('ui-token');
      await route.fulfill({ contentType:'application/json',body:JSON.stringify({ok:true,data:{zone,vehicle:{
        registration:'AB21ABC',make:'Test only',model:'Staggered fixture',source:'oneauto',isStaggered:true,
        front:{width:225,profile:45,rim:18},rear:{width:255,profile:40,rim:18}
      }}}) });
    });
    await page.goto('/');
    await page.getByLabel('Fitting postcode').fill('E14 8PX');
    await page.getByRole('button',{name:'Check area'}).click();
    await page.getByLabel('Enter the vehicle registration').fill('AB21ABC');
    await page.getByRole('button',{name:'Find matching size'}).click();
    const confirm=page.getByRole('button',{name:'YES, THESE MATCH — VIEW TYRES'});
    await expect(confirm).toBeDisabled();
    const choice=page.getByRole('button',{name:axle === 'both' ? /Both axles/ : new RegExp(axle+' axle','i')});
    await touchTarget(choice); await choice.click();
    await expect(confirm).toBeDisabled();
    const physical=page.getByRole('checkbox',{name:/I checked the physical sidewalls/});
    await physical.check(); await expect(confirm).toBeEnabled();
    await page.getByRole('button',{name:/Front axle/i}).click();
    await expect(physical).not.toBeChecked();
    await choice.click(); await physical.check();
    await noOverflow(page); await customerAccessibility(page);
    await confirm.click();
    await expect(page).toHaveURL(/\/tyres\?/);
    const params=new URL(page.url()).searchParams;
    expect(params.get('axle')).toBe(axle); expect(params.get('sidewall')).toBe('confirmed');
    expect(params.get('w')).toBe(axle === 'rear' ? '255':'225');
    expect(params.get('rw')).toBe(axle === 'both' ? '255':null);
  });
}
test('both axles require a deliberate matching rear product',async ({page})=>{
  await page.goto(journey+'&axle=both&rw=255&rp=40&rr=18');
  await expect(page.getByRole('checkbox')).toBeChecked();
  await expect(page.getByLabel('Select Rear Tyre Model')).toHaveValue('');
  await expect(page.getByRole('button',{name:'Continue to Location & Vehicle'})).toBeDisabled();
  await expect(page.getByLabel('Select Rear Tyre Model').locator('option')).toHaveCount(2);
  await page.getByLabel('Select Rear Tyre Model').selectOption(rear.id);
  await expect(page.getByRole('button',{name:'Continue to Location & Vehicle'})).toBeEnabled();
  await noOverflow(page);
});
