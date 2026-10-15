import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkoutSchema, ukPostcodeSchema } from '@/lib/validation';
import { checkCoverage, resolvePostcode } from '@/lib/postcodes';
import { calculatePrice, PricingError } from '@/lib/pricing';

export const runtime = 'nodejs';
const quoteSchema = z.object({ items: checkoutSchema.shape.items, postcode: ukPostcodeSchema });

/** Read-only quote. This never creates a booking, hold or payment. */
export async function POST(req: Request) {
  const parsed = quoteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_quote', message: 'Choose your tyres and fitting postcode.' }, { status: 400 });
  try {
    const resolved = await resolvePostcode(parsed.data.postcode);
    if (!resolved) return NextResponse.json({ ok: false, error: 'invalid_postcode', message: 'Enter a valid fitting postcode.' }, { status: 400 });
    const coverage = await checkCoverage(resolved.postcode);
    if (!coverage.covered || !coverage.zone) return NextResponse.json({ ok: false, error: 'outside_coverage', message: coverage.message }, { status: 400 });
    const data = await calculatePrice(parsed.data.items, coverage.zone.callout_charge);
    return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof PricingError ? error.code : 'service_unavailable',
      message: error instanceof PricingError ? error.message : 'Pricing unavailable. Cannot continue.',
    }, { status: error instanceof PricingError ? 409 : 503 });
  }
}
