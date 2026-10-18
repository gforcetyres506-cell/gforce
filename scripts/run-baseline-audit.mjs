import fs from 'node:fs';

const PROD_ORIGIN = 'https://www.gforcetyres-mobile.co.uk';

const USER_AGENTS = {
  standard: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  googlebotImage: 'Googlebot-Image/1.0',
  gptbot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
  claudebot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +https://www.anthropic.com/claudebot)',
  perplexitybot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  applebot: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)',
};

async function fetchWithDetails(url, ua = USER_AGENTS.standard, redirect = 'follow') {
  const started = performance.now();
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': ua },
      redirect,
      signal: AbortSignal.timeout(15000),
    });
    const latencyMs = Math.round(performance.now() - started);
    const contentType = res.headers.get('content-type') || '';
    const text = contentType.includes('text') || contentType.includes('json') || contentType.includes('xml')
      ? await res.text()
      : `[binary ${res.headers.get('content-length') || 'unknown'} bytes]`;
    
    return {
      url,
      status: res.status,
      latencyMs,
      contentType,
      headers: Object.fromEntries(res.headers.entries()),
      body: text,
    };
  } catch (err) {
    return {
      url,
      status: 0,
      latencyMs: Math.round(performance.now() - started),
      error: err.message,
    };
  }
}

function parseHtmlMetadata(html, url) {
  if (typeof html !== 'string') return null;

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;

  const descMatch = html.match(/<meta[^>]+name=["']?description["']?[^>]+content=["']([^"']*)["'][^>]*>/i)
    || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']?description["'][^>]*>/i);
  const description = descMatch ? descMatch[1].trim() : null;

  const canonicalMatch = html.match(/<link[^>]+rel=["']?canonical["']?[^>]+href=["']([^"']*)["'][^>]*>/i);
  const canonical = canonicalMatch ? canonicalMatch[1].trim() : null;

  const robotsMatch = html.match(/<meta[^>]+name=["']?robots["']?[^>]+content=["']([^"']*)["'][^>]*>/i);
  const robots = robotsMatch ? robotsMatch[1].trim() : null;

  const h1Matches = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
  const h2Matches = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());

  const iconMatches = [...html.matchAll(/<link[^>]+rel=["']?[^"']*icon[^"']*["']?[^>]*>/gi)].map(m => m[0]);

  // Extract JSON-LD scripts
  const jsonLdScripts = [];
  const scriptRegex = /<script[^>]+type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      jsonLdScripts.push(JSON.parse(match[1]));
    } catch (e) {
      jsonLdScripts.push({ raw: match[1], parseError: e.message });
    }
  }

  // Internal links
  const internalLinks = new Set();
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let lMatch;
  while ((lMatch = linkRegex.exec(html)) !== null) {
    const href = lMatch[1];
    if (href.startsWith('/') || href.startsWith(PROD_ORIGIN)) {
      internalLinks.add(href);
    }
  }

  return {
    title,
    description,
    canonical,
    robots,
    h1: h1Matches,
    h2: h2Matches,
    icons: iconMatches,
    jsonLd: jsonLdScripts,
    internalLinks: Array.from(internalLinks),
  };
}

async function runBaselineAudit() {
  console.log('=== RUNNING PHASE A BASELINE AUDIT AGAINST PRODUCTION ===');
  const results = {
    auditedAt: new Date().toISOString(),
    productionOrigin: PROD_ORIGIN,
    pages: {},
    redirects: {},
    botResponses: {},
    robotsTxt: null,
    sitemapXml: null,
    faviconEndpoints: {},
  };

  // 1. Audit core public pages
  const corePages = [
    '/',
    '/mobile-tyre-fitting',
    '/how-it-works',
    '/coverage',
    '/contact',
    '/guides/tyre-size',
    '/tyres',
    '/privacy',
    '/terms',
  ];

  console.log('\n--- Auditing Public Pages ---');
  for (const p of corePages) {
    const url = `${PROD_ORIGIN}${p}`;
    console.log(`Auditing: ${url}`);
    const r = await fetchWithDetails(url);
    const meta = r.status === 200 ? parseHtmlMetadata(r.body, url) : null;
    results.pages[p] = {
      status: r.status,
      latencyMs: r.latencyMs,
      contentType: r.contentType,
      xVercelId: r.headers?.['x-vercel-id'],
      securityHeaders: {
        csp: Boolean(r.headers?.['content-security-policy']),
        hsts: Boolean(r.headers?.['strict-transport-security']),
        nosniff: r.headers?.['x-content-type-options'] === 'nosniff',
      },
      parsed: meta,
    };
  }

  // 2. Audit robots.txt and sitemap.xml
  console.log('\n--- Auditing robots.txt and sitemap.xml ---');
  const robotsRes = await fetchWithDetails(`${PROD_ORIGIN}/robots.txt`);
  results.robotsTxt = {
    status: robotsRes.status,
    contentType: robotsRes.contentType,
    content: robotsRes.body,
  };

  const sitemapRes = await fetchWithDetails(`${PROD_ORIGIN}/sitemap.xml`);
  const sitemapUrls = [...(sitemapRes.body || '').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  results.sitemapXml = {
    status: sitemapRes.status,
    contentType: sitemapRes.contentType,
    urls: sitemapUrls,
  };

  // 3. Audit Favicon Endpoints on Live Production
  console.log('\n--- Auditing Favicon Endpoints on Live Site ---');
  const faviconEndpoints = [
    '/favicon.ico',
    '/icon.png',
    '/apple-icon.png',
    '/icon-48.png',
    '/icon-192.png',
  ];
  for (const ep of faviconEndpoints) {
    const res = await fetchWithDetails(`${PROD_ORIGIN}${ep}`);
    results.faviconEndpoints[ep] = {
      status: res.status,
      contentType: res.contentType,
      size: res.body?.length || 0,
      xVercelId: res.headers?.['x-vercel-id'],
    };
    console.log(`Favicon ${ep}: ${res.status} (${res.contentType})`);
  }

  // 4. Audit Redirects
  console.log('\n--- Auditing Domain Redirects ---');
  const redirectUrls = [
    'http://gforcetyres-mobile.co.uk/',
    'http://www.gforcetyres-mobile.co.uk/',
    'https://gforcetyres-mobile.co.uk/',
  ];
  for (const u of redirectUrls) {
    const res = await fetchWithDetails(u, USER_AGENTS.standard, 'manual');
    results.redirects[u] = {
      status: res.status,
      location: res.headers?.location,
    };
    console.log(`Redirect ${u} -> status ${res.status}, location: ${res.headers?.location}`);
  }

  // 5. Test AI Crawlers and Googlebot on homepage
  console.log('\n--- Auditing Bot Access on Homepage ---');
  for (const [botName, ua] of Object.entries(USER_AGENTS)) {
    const res = await fetchWithDetails(`${PROD_ORIGIN}/`, ua);
    results.botResponses[botName] = {
      status: res.status,
      latencyMs: res.latencyMs,
      xVercelId: res.headers?.['x-vercel-id'],
      contentLength: res.body?.length,
    };
    console.log(`Bot ${botName}: status ${res.status}, latency: ${res.latencyMs}ms`);
  }

  // Save evidence
  fs.writeFileSync('docs/seo/BASELINE_CRAWL_EVIDENCE.json', JSON.stringify(results, null, 2) + '\n');
  console.log('\nSaved docs/seo/BASELINE_CRAWL_EVIDENCE.json');
}

runBaselineAudit().catch(console.error);
