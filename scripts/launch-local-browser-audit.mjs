import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

// Read-only, loopback-only lab audit. Never use a customer/production database.
const origin = 'http://127.0.0.1:3111';
const directory = 'docs/launch/evidence';
mkdirSync(directory, { recursive:true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport:{width:390,height:844}, reducedMotion:'reduce' });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline:false, latency:150, downloadThroughput:200000, uploadThroughput:93750 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate:4 });
  await page.addInitScript(() => {
    window.launchMetrics = { lcpMs:null, layoutShiftSum:0, eventDurationsMs:[] };
    new PerformanceObserver(list => { for (const e of list.getEntries()) window.launchMetrics.lcpMs = e.startTime; }).observe({type:'largest-contentful-paint', buffered:true});
    new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.launchMetrics.layoutShiftSum += e.value; }).observe({type:'layout-shift', buffered:true});
    new PerformanceObserver(list => { for (const e of list.getEntries()) window.launchMetrics.eventDurationsMs.push(e.duration); }).observe({type:'event', buffered:true, durationThreshold:16});
  });
  const response = await page.goto(origin, { waitUntil:'networkidle', timeout:60000 });
  await page.getByLabel('Fitting postcode').fill('E14 8PX');
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => ({tag:document.activeElement?.tagName, name:document.activeElement?.getAttribute('aria-label')}));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  const metrics = await page.evaluate(() => window.launchMetrics);
  // Viewport captures accurately show content-visibility:auto sections;
  // Chromium full-page captures can omit offscreen paint even after scrolling.
  await page.screenshot({path:`${directory}/LOCAL_CHROMIUM_390.png`});
  await page.locator('#coverage h2').scrollIntoViewIfNeeded();
  const coverageVisible = await page.locator('#coverage h2').isVisible();
  await page.screenshot({path:`${directory}/LOCAL_COVERAGE_390.png`});
  const social = await context.request.get(`${origin}/opengraph-image`);
  writeFileSync(`${directory}/SOCIAL_PREVIEW.png`,await social.body());
  const secure = await context.request.get(origin, {headers:{host:'www.gforcetyres-mobile.co.uk','x-forwarded-proto':'https'}});
  const apex = await context.request.get(`${origin}/coverage?utm_source=qa`, {headers:{host:'gforcetyres-mobile.co.uk'},maxRedirects:0});
  const crossSite = await context.request.post(`${origin}/api/checkout/create`, {headers:{origin:'https://untrusted.example','sec-fetch-site':'cross-site'},data:{}});
  const sameSite = await context.request.post(`${origin}/api/checkout/create`, {headers:{host:'www.gforcetyres-mobile.co.uk','x-forwarded-proto':'https',origin:'https://www.gforcetyres-mobile.co.uk','sec-fetch-site':'same-origin'},data:{}});
  const policyChecks = {
    hsts:secure.headers()['strict-transport-security'],
    apexStatus:apex.status(), apexLocation:apex.headers().location,
    crossSiteMutationStatus:crossSite.status(),
    sameSiteInvalidInputStatus:sameSite.status(),
  };
  const pass = response.status() === 200 && !overflow && coverageVisible && social.status() === 200
    && policyChecks.hsts === 'max-age=31536000; includeSubDomains'
    && policyChecks.apexStatus === 308
    && policyChecks.apexLocation === 'https://www.gforcetyres-mobile.co.uk/coverage?utm_source=qa'
    && policyChecks.crossSiteMutationStatus === 403 && policyChecks.sameSiteInvalidInputStatus === 400;
  const report = {checkedAt:new Date().toISOString(), status:pass ? 'PASS' : 'FAIL',
    scope:'Local production build, Chromium 390px, reduced motion, no configured database/providers. Simulated network: 150ms latency, 1.6Mbps download, 750Kbps upload; CPU 4x slowdown. One lab sample only.',
    httpStatus:response.status(), overflow, coverageVisible, focusedAfterPostcodeTab:focused, policyChecks, metrics,
    fieldCoreWebVitals:'BLOCKED: lab LCP/layout-shift/event timing does not establish field LCP/CLS or INP; real devices and accepted deployment required.'};
  writeFileSync(`${directory}/LOCAL_BROWSER.json`,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  if(!pass) process.exitCode = 1;
} finally { await browser.close(); }
