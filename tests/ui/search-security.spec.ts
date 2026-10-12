import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { SEARCH_PAGES, SITE_ORIGIN } from '../../src/lib/site';

test('search pages emit unique canonical metadata and parseable honest JSON-LD', async ({ page }) => {
  const titles = new Set<string>();
  for (const path of SEARCH_PAGES) {
    const canonical = SITE_ORIGIN + (path === '/' ? '' : path);
    const response = await page.goto(path + '?utm_source=qa');
    expect(response?.status()).toBe(200);
    titles.add(await page.title());
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
    expect((await page.locator('meta[name="description"]').getAttribute('content'))?.length).toBeGreaterThan(30);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    const data = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(data.length).toBeGreaterThan(0);
    for (const json of data) {
      expect(JSON.parse(json)['@context']).toBe('https://schema.org');
      expect(json).not.toMatch(/aggregateRating|reviewCount|localhost|vercel\.app|manage\//);
    }
    const links = await page.locator('a[href]').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')));
    expect(links.join(' ')).not.toMatch(/localhost|vercel\.app|http:\/\//);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(accessibility.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
  }
  expect(titles.size).toBe(SEARCH_PAGES.length);
});

test('robots and XML sitemap expose only canonical public pages', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  const text = await robots.text();
  expect(text).toContain('Sitemap: ' + SITE_ORIGIN + '/sitemap.xml');
  expect(text).not.toMatch(/manage|token|Google-Extended|GPTBot/);
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()['content-type']).toMatch(/xml/);
  const xml = await sitemap.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  expect(urls).toEqual(SEARCH_PAGES.map(p => SITE_ORIGIN + (p === '/' ? '' : p)));
  expect(urls.join(' ')).not.toMatch(/manage|admin|api\/|token|booking|\?|localhost|vercel\.app/);
  expect(xml).not.toContain('<lastmod>');
});

test('private routes have noindex, no canonical and deny unauthorised API access', async ({ page, request }) => {
  for (const path of ['/booking?tyre=00000000-0000-4000-8000-000000000001&w=225&p=45&r=18&pc=E14%208PX', '/manage/search-test-invalid', '/admin/login', '/account/login', '/privacy', '/terms', '/cancellation', '/tyres']) {
    const direct = await request.get(path, { maxRedirects: 0 });
    expect(direct.headers()['x-robots-tag'] ?? 'MISSING: ' + path).toMatch(/noindex/);
    if (direct.status() >= 300 && direct.status() < 400) {
      expect(direct.headers().location).toBe('/#tyre-finder');
      continue;
    }
    const response = await page.goto(path);
    expect(response?.status(), path).toBeLessThan(500);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"], meta[property="og:url"]')).toHaveCount(0);
  }
  const admin = await request.get('/admin');
  expect(new URL(admin.url()).pathname).toBe('/admin/login');
  for (const path of ['/api/admin/os', '/api/admin/inventory', '/api/admin/access']) {
    const response = await request.get(path);
    expect([401, 403, 503]).toContain(response.status());
    expect(response.headers()['x-robots-tag']).toMatch(/noindex/);
    expect(await response.text()).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|postgresql:\/\/|stack|SELECT /);
  }
  const missing = await request.get('/search-page-does-not-exist');
  expect(missing.status()).toBe(404);
});

test('nonce policy protects hydration and blocks injected scripts', async ({ page, request }) => {
  await page.addInitScript(() => { (window as unknown as { cspErrors: string[] }).cspErrors = []; document.addEventListener('securitypolicyviolation', e => (window as unknown as { cspErrors: string[] }).cspErrors.push(e.violatedDirective)); });
  const response = await page.goto('/');
  const headers = response!.headers();
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toContain('geolocation=()');
  const csp = headers['content-security-policy'];
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();
  expect(csp).not.toMatch(/unsafe-eval|script-src[^;]*unsafe-inline|\*/);
  const inline = await page.locator('script:not([src])').evaluateAll(nodes => nodes.map(n => (n as HTMLScriptElement).nonce));
  expect(inline.every(n => n === nonce)).toBe(true);
  await page.getByLabel('Fitting postcode').fill('E14 8PX');
  expect(await page.evaluate(() => (window as unknown as { cspErrors: string[] }).cspErrors)).toEqual([]);
  const second = await request.get('/', { headers: { 'x-nonce': 'attacker-nonce' } });
  expect(second.headers()['content-security-policy']).not.toContain(nonce!);
  expect(second.headers()['content-security-policy']).not.toContain('attacker-nonce');
  // CDP/evaluate runs privileged trusted JavaScript. A parser-inserted script
  // models an actual HTML injection and must be blocked by the real policy.
  await page.route('**/?csp-injection=1', async route => {
    const original = await route.fetch();
    await route.fulfill({ response: original, body: (await original.text()).replace('</head>', '<script>window.injectedScriptRan=true</script></head>') });
  });
  await page.goto('/?csp-injection=1');
  expect(await page.evaluate(() => (window as unknown as { injectedScriptRan?: boolean }).injectedScriptRan)).toBeUndefined();
  expect(await page.evaluate(() => (window as unknown as { cspErrors: string[] }).cspErrors)).toContain('script-src-elem');
  const privateResponse = await request.get('/manage/search-test-invalid');
  expect(privateResponse.headers()['referrer-policy']).toBe('no-referrer');
});

test('social image and approved logo icons are real image responses', async ({ request }) => {
  for (const path of ['/opengraph-image', '/icon.png', '/apple-icon.png']) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/image\/png/);
    expect((await response.body()).length).toBeGreaterThan(1000);
  }
});
