import https from 'node:https';
import http from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';

// Read-only public checks. Never fetch customer links or log cookies/bodies.
const canonical = 'https://www.gforcetyres-mobile.co.uk';
const origins = [canonical, 'https://gforcetyres-mobile.co.uk', 'http://www.gforcetyres-mobile.co.uk', 'http://gforcetyres-mobile.co.uk'];
const selectedHeaders = ['content-type','location','strict-transport-security','content-security-policy','x-content-type-options','x-frame-options','referrer-policy','permissions-policy','x-robots-tag','access-control-allow-origin'];
function get(url) {
  return new Promise((resolve, reject) => {
    const req = (url.startsWith('https:') ? https : http).get(url, { timeout: 20000, headers: { 'User-Agent': 'GForce-ReadOnly-Launch-Audit/1.0' } }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; if (body.length > 2000000) req.destroy(new Error('Response too large')); });
      res.on('end', () => resolve({ status: res.statusCode, headers: Object.fromEntries(selectedHeaders.filter(k => res.headers[k]).map(k => [k,res.headers[k]])), body }));
    });
    req.on('timeout', () => req.destroy(new Error('Network timeout')));
    req.on('error', reject);
  });
}
async function certificate(host) {
  return new Promise(resolve => {
    const req = https.get(`https://${host}/`, { timeout: 20000 }, res => {
      const socket = res.socket, leaf = socket.getPeerCertificate(true), chain = [];
      let cert = leaf;
      while (cert?.fingerprint256 && !chain.some(c => c.fingerprint === cert.fingerprint256)) {
        chain.push({ subject: cert.subject, issuer: cert.issuer, validFrom: cert.valid_from, validTo: cert.valid_to, fingerprint: cert.fingerprint256 });
        cert = cert.issuerCertificate;
      }
      res.resume();
      resolve({ host, trusted: socket.authorized, authorizationError: socket.authorizationError ?? null, subjectAltName: leaf.subjectaltname, protocol: socket.getProtocol(), chain });
    });
    req.on('timeout', () => req.destroy(new Error('Network timeout')));
    req.on('error', e => resolve({ host, status: 'BLOCKED', error: e.code ?? e.message }));
  });
}
const report = { checkedAt: new Date().toISOString(), deployment: 'Existing live deployment; branch SHA not attested; no deployment performed', redirects: [], certificates: [], pages: [] };
for (const origin of origins) {
  const steps = []; let url = origin + '/';
  try {
    for (let i = 0; i < 6; i++) {
      const r = await get(url); steps.push({ url, status: r.status, ...r.headers });
      if (![301,302,303,307,308].includes(r.status) || !r.headers.location) break;
      url = new URL(r.headers.location, url).href;
    }
    report.redirects.push({ origin, steps, canonicalReached: url === canonical + '/', redirectCount: steps.length - 1 });
  } catch (e) { report.redirects.push({ origin, steps, status: 'BLOCKED', error: e.code ?? e.message }); }
}
for (const host of ['www.gforcetyres-mobile.co.uk','gforcetyres-mobile.co.uk']) report.certificates.push(await certificate(host));
for (const path of ['/', '/robots.txt', '/sitemap.xml', '/tyres', '/terms', '/privacy', '/cancellation', '/contact', '/how-it-works', '/mobile-tyre-fitting']) {
  try {
    const { body, ...r } = await get(canonical + path);
    report.pages.push({ path, ...r,
      ...(r.headers['content-type']?.includes('text/html') ? {
        title: body.match(/<title>(.*?)<\/title>/s)?.[1] ?? null,
        canonicals: [...body.matchAll(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/g)].map(m => m[1]),
        mixedContentResourceCount: [...body.matchAll(/(?:src|href)="http:\/\/[^\"]+"/g)].length,
        localhostLinkCount: [...body.matchAll(/(?:src|href)="[^\"]*(?:localhost|127\.0\.0\.1)[^\"]*"/g)].length,
        selfCertifiedGdprClaim: /UK GDPR Compliant/i.test(body),
        draftLanguage: /Draft legal content|current preview/i.test(body),
      } : { characterCount: body.length }),
    });
  } catch(e) { report.pages.push({ path, status: 'BLOCKED', error: e.code ?? e.message }); }
}
mkdirSync('docs/launch/evidence', { recursive: true });
writeFileSync('docs/launch/evidence/LIVE_NETWORK.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
