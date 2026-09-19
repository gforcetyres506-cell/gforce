import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { lookupVRM } from '@/lib/oneauto';
import { checkCoverage } from '@/lib/postcodes';
import { verifyTurnstile } from '@/lib/turnstile';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { vrmLookupSchema } from '@/lib/validation';
import { isMockDataEnabled } from '@/lib/mock-mode';

export const runtime = 'nodejs';

/**
 * POST /api/vrm/lookup
 *
 * Every OneAutoAPI call costs ~£0.15, so this endpoint is gated hard.
 * Nothing reaches the paid API until all four gates pass:
 *
 *   Turnstile  → is it a human?
 *   Rate limit → 3 per IP per 10 minutes
 *   Coverage   → would we even service this postcode?
 *   Cache      → have we already paid for this plate?
 *
 * A failed lookup is not an error state for the user — the UI falls back
 * to manual tyre size entry, which is equally valid.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'bad_request', message: 'Invalid request.' },
      { status: 400 }
    );
  }

  const parsed = vrmLookupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_reg',
        message: parsed.error.errors[0]?.message ?? 'Check the registration and postcode.',
      },
      { status: 400 }
    );
  }

  const { registration, postcode, email, turnstileToken } = parsed.data;

  // Gate 1 ── bot check
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return NextResponse.json(
      { ok: false, error: 'bot_check_failed', message: 'Verification failed. Reload and retry.' },
      { status: 403 }
    );
  }

  // Gate 2 ── rate limit
  const limit = await checkRateLimit(`vrm:${ip}`, 3, 10);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: 'rate_limited',
        message: 'Too many lookups. Wait a few minutes or enter your tyre size manually.',
      },
      { status: 429 }
    );
  }

  // Gate 3 ── coverage. No point paying for a vehicle we cannot service.
  const coverage = await checkCoverage(postcode);
  if (!coverage.covered) {
    await captureInterest(email, postcode, 'out_of_area');
    return NextResponse.json(
      { ok: false, error: 'outside_coverage', message: coverage.message },
      { status: 400 }
    );
  }

  // Capture the lead regardless of whether the lookup succeeds
  await captureInterest(email, postcode, 'vrm_gate');

  // Gate 4 ── cache, then the paid API
  const result = await lookupVRM(registration);

  if (!result) {
    return NextResponse.json(
      {
        ok: false,
        error: 'lookup_failed',
        message: 'We could not find that vehicle. Enter your tyre size from the sidewall instead.',
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    data: { vehicle: result, zone: coverage.zone },
  });
}

async function captureInterest(email: string | undefined, postcode: string, source: string): Promise<void> {
  if (!email) return;

  try {
    const db = createServiceClient();
    await db.from('interest_registrations').insert({
      email: email.toLowerCase(),
      postcode: postcode.toUpperCase(),
      source,
    });
  } catch {
    // Lead capture must never break the lookup.
  }
}
