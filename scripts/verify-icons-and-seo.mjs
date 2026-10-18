import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

async function verify() {
  console.log('=== VERIFYING LOCAL NEXT.JS BUILD, SEO AND ICON ROUTES ===');

  const port = 3126;
  const child = spawn(process.execPath, ['./node_modules/next/dist/bin/next', 'start', '-p', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (d) => process.stdout.write('[next-stdout] ' + d));
  child.stderr.on('data', (d) => process.stderr.write('[next-stderr] ' + d));

  // Wait until server is up
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/`);
      if (res.status === 200) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (!ready) {
    try { process.kill(child.pid); } catch {}
    throw new Error('Next.js start failed to become ready on port ' + port);
  }

  try {
    const endpoints = [
      { path: '/', expectedStatus: 200 },
      { path: '/favicon.ico', expectedStatus: 200, contentType: 'image/x-icon' },
      { path: '/icon.png', expectedStatus: 200, contentType: 'image/png' },
      { path: '/icon-48.png', expectedStatus: 200, contentType: 'image/png' },
      { path: '/icon-96.png', expectedStatus: 200, contentType: 'image/png' },
      { path: '/icon-192.png', expectedStatus: 200, contentType: 'image/png' },
      { path: '/apple-icon.png', expectedStatus: 200, contentType: 'image/png' },
      { path: '/apple-touch-icon.png', expectedStatus: 200, contentType: 'image/png' },
      { path: '/robots.txt', expectedStatus: 200 },
      { path: '/sitemap.xml', expectedStatus: 200 },
      { path: '/llms.txt', expectedStatus: 200 },
      { path: '/coverage', expectedStatus: 200 },
      { path: '/guides', expectedStatus: 200 },
      { path: '/guides/tyre-size', expectedStatus: 200 },
      { path: '/guides/puncture-repair', expectedStatus: 200 },
      { path: '/guides/mobile-fitting-checklist', expectedStatus: 200 },
      { path: '/guides/tyre-replacement-signs', expectedStatus: 200 },
      { path: '/guides/load-speed-ratings', expectedStatus: 200 },
    ];

    console.log('\n--- Checking Endpoint Statuses ---');
    for (const ep of endpoints) {
      const res = await fetch(`http://localhost:${port}${ep.path}`);
      console.log(`${ep.path}: ${res.status} ${res.headers.get('content-type')}`);
      assert.equal(res.status, ep.expectedStatus, `${ep.path} expected status ${ep.expectedStatus}`);
      if (ep.contentType) {
        assert(
          res.headers.get('content-type')?.includes(ep.contentType) ||
          res.headers.get('content-type')?.includes('image/'),
          `${ep.path} expected content-type matching ${ep.contentType}`
        );
      }
    }

    console.log('\n--- Checking HTML Icon Tags & Meta ---');
    const homeRes = await fetch(`http://localhost:${port}/`);
    const html = await homeRes.text();

    const iconLinks = html.match(/<link[^>]+rel=["']?[^"']*icon[^"']*["']?[^>]*>/gi) || [];
    console.log('Icon tags found in HTML head:', iconLinks);
    assert(iconLinks.length > 0, 'No icon tags found in HTML head');
    assert(
      iconLinks.some((l) => l.includes('favicon.ico') || l.includes('icon-48.png') || l.includes('icon.png')),
      'Favicon link missing from HTML head'
    );

    const canonicalMatch = html.match(/<link[^>]+rel=["']?canonical["']?[^>]*>/gi) || [];
    console.log('Canonical tag:', canonicalMatch);
    assert(canonicalMatch.length > 0, 'Canonical tag missing');

    const robotsMatch = html.match(/<meta[^>]+name=["']?robots["']?[^>]*>/gi) || [];
    console.log('Robots tag:', robotsMatch);
    assert(robotsMatch.length > 0, 'Robots meta tag missing');

    console.log('\n--- Checking Sitemap Content ---');
    const sitemapRes = await fetch(`http://localhost:${port}/sitemap.xml`);
    const sitemapXml = await sitemapRes.text();
    const urlsInSitemap = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    console.log('URLs in sitemap.xml:', urlsInSitemap);
    assert.equal(urlsInSitemap.length, 11, 'Expected 11 URLs in sitemap');
    assert(urlsInSitemap.includes('https://www.gforcetyres-mobile.co.uk/guides'));
    assert(urlsInSitemap.includes('https://www.gforcetyres-mobile.co.uk/guides/puncture-repair'));

    console.log('\n--- Checking llms.txt Content ---');
    const llmsRes = await fetch(`http://localhost:${port}/llms.txt`);
    const llmsText = await llmsRes.text();
    assert(llmsText.includes('G Force Tyres Mobile'), 'llms.txt missing business name');
    assert(llmsText.includes('BS AU 159'), 'llms.txt missing BS AU 159');

    console.log('\nALL 18 ENDPOINT AND CONTENT VERIFICATIONS PASSED: 100% SUCCESS.');
  } finally {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { stdio: 'ignore' });
    } else {
      child.kill('SIGKILL');
    }
  }
}

verify()
  .then(() => {
    setTimeout(() => process.exit(0), 1000);
  })
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  });
