import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

// Public, read-only browser check. No form submission or customer-token URLs.
const browser = await chromium.launch();
const context = await browser.newContext({ viewport:{width:390,height:844}, reducedMotion:'reduce', ignoreHTTPSErrors:false });
const page = await context.newPage();
const httpResources = [], failures = [];
page.on('request', r => { if(r.url().startsWith('http:')) httpResources.push(new URL(r.url()).origin); });
page.on('requestfailed', r => failures.push({ origin:new URL(r.url()).origin, error:r.failure()?.errorText }));
const report = { checkedAt:new Date().toISOString(), device:'Automated Chromium 390px; not Safari, physical phone or Instagram', status:'BLOCKED' };
try {
  const response = await page.goto('https://www.gforcetyres-mobile.co.uk/', { waitUntil:'networkidle', timeout:45000 });
  Object.assign(report, { status:'PASS', httpStatus:response.status(), finalUrl:page.url(), title:await page.title(),
    security:await response.securityDetails(), httpResources, requestFailures:failures,
    overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),
    // Describe counts only; never persist private/manage links from rendered HTML.
    canonical:await page.locator('link[rel="canonical"]').getAttribute('href').catch(()=>null),
  });
  mkdirSync('docs/launch/evidence',{recursive:true});
  await page.screenshot({path:'docs/launch/evidence/LIVE_CHROMIUM_390.png',fullPage:true});
} catch(e) { report.error=e.message.split('\n')[0]; }
await browser.close();
mkdirSync('docs/launch/evidence',{recursive:true});
writeFileSync('docs/launch/evidence/LIVE_BROWSER.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
