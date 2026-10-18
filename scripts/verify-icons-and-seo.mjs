import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

async function verify() {
  console.log('=== VERIFYING LOCAL NEXT.JS BUILD AND ICON ROUTES ===');

  const port = 3125;
  const child = spawn('npx', ['next', 'start', '-p', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
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
    child.kill();
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

    console.log('\n--- Checking HTML Icon Tags ---');
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

    console.log('\nALL LOCAL VERIFICATIONS PASSED: 100% SUCCESS.');
  } finally {
    child.kill();
  }
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exitCode = 1;
});
