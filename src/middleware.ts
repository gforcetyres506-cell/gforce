import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { hasSupabasePublicEnv, getSupabasePublicEnv } from '@/lib/env';
import { contentSecurityPolicy, isUtilityPath } from '@/lib/security-policy';
import { SITE_ORIGIN } from '@/lib/site';
import { getRequestOrigin } from '@/lib/request-origin';

export async function middleware(request: NextRequest) {
  // Next's self-hosted URL can contain the internal loopback host. Use the
  // incoming Host for public-domain decisions; only exact approved names match.
  const requestHost = request.headers.get('host') ?? request.nextUrl.host;
  const host = requestHost.toLowerCase().replace(/:\d+$/, '');
  const protocol = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');
  const requestOrigin = getRequestOrigin(request);
  if (host === 'gforcetyres-mobile.co.uk') {
    // Assign the path separately so a leading // cannot change the destination.
    const target = new URL(SITE_ORIGIN);
    target.pathname = request.nextUrl.pathname;
    target.search = request.nextUrl.search;
    return NextResponse.redirect(target, 308);
  }
  const production = process.env.NODE_ENV === 'production';
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))));
  const csp = contentSecurityPolicy(nonce, production, process.env.NEXT_PUBLIC_SUPABASE_URL);
  const requestHeaders = new Headers(request.headers);
  // Always overwrite caller-supplied nonce/policy values.
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const makeResponse = (response = NextResponse.next({ request: { headers: requestHeaders } })) => {
    response.headers.set('Content-Security-Policy', csp);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', /^\/(?:manage|confirmation)(?:\/|$)/.test(request.nextUrl.pathname) ? 'no-referrer' : 'strict-origin-when-cross-origin');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    if (production && host === 'www.gforcetyres-mobile.co.uk' &&
      protocol === 'https') {
      response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    if (isUtilityPath(request.nextUrl.pathname)) {
      response.headers.set('X-Robots-Tag', 'noindex, ' + (/^\/(manage|api|admin|account|confirmation)(\/|$)/.test(request.nextUrl.pathname) ? 'nofollow' : 'follow'));
      response.headers.set('Cache-Control', 'private, no-store');
    }
    return response;
  };
  // Webhooks authenticate their provider signature instead of browser Origin.
  if (request.nextUrl.pathname.startsWith('/api/') && request.nextUrl.pathname !== '/api/stripe/webhook' &&
    !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== requestOrigin)) {
      return makeResponse(NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 }));
    }
  }
  if (!hasSupabasePublicEnv()) return makeResponse();

  const env = getSupabasePublicEnv();
  let response = makeResponse();
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: { secure: production, sameSite: 'lax', httpOnly: true },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          requestHeaders.set('cookie', request.headers.get('cookie') ?? '');
          response = makeResponse();
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Do not remove this call: it validates/refreshes the cookie-backed session.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
