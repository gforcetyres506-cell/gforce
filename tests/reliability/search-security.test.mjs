import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource } from './loader.mjs';
import { NextRequest } from 'next/server.js';

test('search URLs ignore deployment origins and never include utility paths', () => {
  const { SITE_ORIGIN, SEARCH_PAGES, publicMetadata, utilityMetadata } = loadSource('src/lib/site.ts', { env: { APP_URL: 'https://staging.vercel.app' } });
  assert.equal(SITE_ORIGIN, 'https://www.gforcetyres-mobile.co.uk');
  for (const path of SEARCH_PAGES) {
    assert.doesNotMatch(path, /admin|api|manage|booking|confirmation|\?|#/);
    assert.equal(publicMetadata(path, 'Title', 'Description').alternates.canonical, SITE_ORIGIN + (path === '/' ? '' : path));
  }
  const utility = utilityMetadata('Private', 'Private description', false);
  assert.equal(utility.robots.index, false);
  assert.equal(utility.alternates.canonical, null);
  assert.equal(utility.openGraph, null);
});

test('production policy permits only configured providers and nonce scripts', () => {
  const { contentSecurityPolicy, isUtilityPath } = loadSource('src/lib/security-policy.ts');
  const csp = contentSecurityPolicy('testnonce', true, 'https://project.supabase.co');
  assert.match(csp, /nonce-testnonce/);
  assert.match(csp, /connect-src 'self' https:\/\/challenges.cloudflare.com https:\/\/project.supabase.co wss:\/\/project.supabase.co/);
  assert.doesNotMatch(csp, /unsafe-eval|api.resend|\*/);
  assert.doesNotMatch(csp.split(';').find(s => s.trim().startsWith('script-src')), /unsafe-inline/);
  for (const rule of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", 'upgrade-insecure-requests']) assert(csp.includes(rule));
  assert(!contentSecurityPolicy('test', true, 'javascript:alert(1)').includes('javascript:'));
  for (const path of ['/manage/private', '/api/admin/os', '/admin/login', '/booking/pay', '/confirmation/reference', '/tyres']) assert(isUtilityPath(path));
  assert.equal(isUtilityPath('/mobile-tyre-fitting'), false);
});

test('structured business facts omit unknowns and fabricated ratings', () => {
  const { organizationSchema } = loadSource('src/lib/business-entity.ts');
  const schema = organizationSchema();
  assert.equal(schema.name, 'G Force Tyres Mobile');
  assert.equal(schema['@type'], 'Organization');
  for (const key of ['telephone', 'address', 'openingHours', 'areaServed', 'aggregateRating', 'review']) assert.equal(schema[key], undefined);
});

test('middleware preserves canonical redirects and sends non-indexable private headers', async () => {
  const { middleware } = loadSource('src/middleware.ts', { env:{NODE_ENV:'production'}, modules:{
    '@/lib/env':{hasSupabasePublicEnv:()=>false},
  } });
  const apex = await middleware(new NextRequest('https://gforcetyres-mobile.co.uk/coverage?utm_source=test'));
  assert.equal(apex.status,308);
  assert.equal(apex.headers.get('location'),'https://www.gforcetyres-mobile.co.uk/coverage?utm_source=test');
  const unusual = await middleware(new NextRequest('http://127.0.0.1//untrusted.example/path', {headers:{host:'gforcetyres-mobile.co.uk'}}));
  assert.equal(new URL(unusual.headers.get('location')).origin,'https://www.gforcetyres-mobile.co.uk');
  const proxied = await middleware(new NextRequest('http://127.0.0.1/', {headers:{host:'www.gforcetyres-mobile.co.uk','x-forwarded-proto':'https'}}));
  assert.equal(proxied.headers.get('strict-transport-security'),'max-age=31536000; includeSubDomains');
  const sameOrigin = await middleware(new NextRequest('http://127.0.0.1/api/checkout/create', {method:'POST',headers:{host:'www.gforcetyres-mobile.co.uk','x-forwarded-proto':'https',origin:'https://www.gforcetyres-mobile.co.uk'}}));
  assert.equal(sameOrigin.status,200);
  const reserve = loadSource('src/lib/reservation-request.ts');
  assert.equal((await reserve.handleReservationRequest(new Request('http://127.0.0.1/api/checkout/create', {method:'POST',headers:{host:'www.gforcetyres-mobile.co.uk','x-forwarded-proto':'https',origin:'https://www.gforcetyres-mobile.co.uk','content-type':'application/json'},body:'{}'}))).status,400);
  const { getRequestOrigin } = loadSource('src/lib/request-origin.ts');
  assert.equal(getRequestOrigin(new Request('http://127.0.0.1/',{headers:{host:'www.gforcetyres-mobile.co.uk','x-forwarded-proto':'javascript'}})),null);
  const privatePage = await middleware(new NextRequest('https://www.gforcetyres-mobile.co.uk/manage/test-invalid', {headers:{'x-nonce':'forged'}}));
  assert.equal(privatePage.headers.get('strict-transport-security'),'max-age=31536000; includeSubDomains');
  assert.equal(privatePage.headers.get('x-robots-tag'),'noindex, nofollow');
  assert.equal(privatePage.headers.get('referrer-policy'),'no-referrer');
  assert.match(privatePage.headers.get('cache-control'),/no-store/);
  assert(!privatePage.headers.get('content-security-policy').includes('forged'));
  const attack = await middleware(new NextRequest('https://www.gforcetyres-mobile.co.uk/api/checkout/create', {method:'POST',headers:{origin:'https://attacker.invalid'}}));
  assert.equal(attack.status,403);
  assert.equal(attack.headers.get('access-control-allow-origin'),null);
});

test('invalid public filters and malformed management tokens are rejected before privileged access', async () => {
  const db = {from(){throw new Error('Privileged access must not occur');}};
  const tyres = loadSource('src/app/api/tyres/route.ts',{db});
  for (const query of ['w=NaN','w=-1','p=999','r=18%27','tier=unknown','season=unknown','unexpected=1']) {
    assert.equal((await tyres.GET(new Request('https://example.invalid/api/tyres?'+query))).status,400);
  }
  const slots = loadSource('src/app/api/slots/route.ts',{db});
  for (const query of ['from=2026-02-30','to=invalid','from=2026-12-10&to=2026-12-01']) assert.equal((await slots.GET(new Request('https://example.invalid/api/slots?'+query))).status,400);
  const manage = loadSource('src/app/api/manage/[token]/route.ts',{db});
  assert.equal((await manage.GET(new Request('https://example.invalid/api/manage/invalid'),{params:Promise.resolve({token:'invalid'})})).status,404);
});
