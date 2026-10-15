import { NextResponse } from 'next/server';
import { lookupVRM } from '@/lib/oneauto';
import { resolvePostcode, checkCoverage } from '@/lib/postcodes';
import { verifyTurnstile } from '@/lib/turnstile';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { vrmLookupSchema } from '@/lib/validation';

export const runtime = 'nodejs';
const manual = 'Vehicle lookup is unavailable. Enter your tyre size from the sidewall instead.';
export async function POST(req: Request) {
  const parsed = vrmLookupSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_reg', message: 'Check the registration or enter the tyre size manually.' }, { status: 400 });
  try {
    if (!process.env.ONEAUTO_API_KEY) return NextResponse.json({ ok: false, error: 'lookup_unavailable', message: manual }, { status: 503 });
    const ip = getClientIp(req);
    if (!(await verifyTurnstile(parsed.data.turnstileToken, ip))) return NextResponse.json({ ok: false, error: 'bot_check_failed', message: manual }, { status: 403 });
    const limit = await checkRateLimit('vrm:' + ip, 3, 10);
    if (!limit.allowed) return NextResponse.json({ ok: false, error: 'rate_limited', message: manual }, { status: 429 });
    const resolved = await resolvePostcode(parsed.data.postcode);
    if (!resolved) return NextResponse.json({ ok: false, error: 'invalid_postcode', message: manual }, { status: 400 });
    const coverage = await checkCoverage(resolved.postcode);
    if (!coverage.covered) return NextResponse.json({ ok: false, error: 'outside_coverage', message: coverage.message }, { status: 400 });
    // A shared ceiling also bounds spend when client addresses rotate.
    const globalLimit = await checkRateLimit('vrm:global', 30, 10);
    if (!globalLimit.allowed) return NextResponse.json({ ok: false, error: 'rate_limited', message: manual }, { status: 429 });
    const vehicle = await lookupVRM(parsed.data.registration);
    if (!vehicle) return NextResponse.json({ ok: false, error: 'lookup_failed', message: manual }, { status: 404 });
    return NextResponse.json({ ok: true, data: { vehicle, zone: coverage.zone } });
  } catch {
    return NextResponse.json({ ok: false, error: 'lookup_unavailable', message: manual }, { status: 503 });
  }
}
