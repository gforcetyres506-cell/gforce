import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createBusinessContact } from '../../src/lib/business-contact';

const contactsConfigured = process.env.UI_TEST_CONTACTS !== 'off';
const tyre = {
  id: 'ui-test-tyre', brand: 'UI test', model: 'Responsive test tyre', sku: 'ui-test',
  width: 225, profile: 45, rim: 18, tier: 'mid', season: 'summer',
  sell_price: 10000, cost_price: 5000, stock: 4, active: true,
  is_run_flat: false, is_xl: false, load_index: '95', speed_rating: 'Y',
  fuel_economy: 'B', wet_grip: 'A', noise_db: 70, created_at: '2026-01-01',
};
const zone = { id: 'ui-zone', postcode_prefix: 'E14', zone_name: 'UI test zone', callout_charge: 0, active: true };
const slot = {
  id: 'ui-slot', slot_date: '2030-01-02', start_time: '10:00:00', end_time: '12:00:00',
  max_bookings: 2, available: true, remaining: 2, active: true,
};

test.beforeEach(async ({ page }) => {
  // Every API is intercepted, including GET /slots (which can write in the
  // legacy implementation). No test can reach hosted Supabase or providers.
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: object = { ok: false, message: 'No matching UI fixture' };
    if (path === '/api/tyres') body = { ok: true, data: [tyre] };
    if (path === '/api/slots') body = { ok: true, data: [slot] };
    if (path === '/api/postcode/check') body = { ok: true, covered: true, data: { zone } };
    if (path === '/api/account/me') body = { ok: false };
    if (path === '/api/holds/create') body = { ok: true, data: { hold_id: 'ui-hold' } };
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
  for (const path of ['/', '/tyres', '/booking', '/manage/ui-invalid-token', '/terms', '/privacy', '/cancellation']) {
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
  await page.goto('/booking?tyre=ui-test-tyre&pc=E14%208PX');
  await expect(page.getByRole('heading', { name: tyre.model })).toBeVisible();
  await expect(page.getByText('Standard', { exact: true })).toBeVisible();
  for (const button of await page.getByRole('group', { name: 'Booking progress' }).getByRole('button').all()) {
    await touchTarget(button);
    await expect(button).toHaveAccessibleName(/Step \d:/);
  }
  await expect(page.getByRole('button', { name: 'Step 1: Tyres & Qty', exact: true })).toHaveAttribute('aria-current', 'step');
  await touchTarget(page.getByRole('button', { name: 'Increase tyre quantity', exact: true }));
  await page.getByRole('checkbox').check();
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
  await touchTarget(page.getByRole('button', { name: 'Proceed to Secure Deposit' }));
  await noOverflow(page);
  await customerAccessibility(page);
  // Intentionally stop before checkout: Gate A does not exercise payment logic.
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
  await expect(page.getByRole('heading', { name: 'No tyres found' })).toBeVisible();
  if (contactsConfigured) await expect(page.locator('main a[href^="tel:"]')).toBeVisible();
  await noOverflow(page);
  await customerAccessibility(page);
});

test('catalogue uses styled standard badges and 44px selection actions', async ({ page }) => {
  // SSR catalogue has no configured database in this local test server. This
  // checks the existing legacy fallback rendering, not business inventory.
  await page.goto('/tyres?tier=standard');
  await expect(page.getByRole('link', { name: 'Standard', exact: true })).toHaveAttribute('href', /tier=standard/);
  const badges = page.locator('.badge-standard');
  expect(await badges.count()).toBeGreaterThan(0);
  await expect(badges.first()).toHaveText('Standard');
  await expect(page.locator('main')).not.toContainText('Mid-Range');
  for (const action of await page.getByRole('link', { name: 'Select & Choose Slot' }).all()) await touchTarget(action);
  const badgeColors = await badges.first().evaluate((node) => ({ color: getComputedStyle(node).color, bg: getComputedStyle(node).backgroundColor }));
  expect(badgeColors.bg).not.toBe('rgba(0, 0, 0, 0)');
  await noOverflow(page);
  await customerAccessibility(page);
});
