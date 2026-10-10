import { NextResponse } from 'next/server';
import { validatePostcode, checkCoverage } from '@/lib/postcodes';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({
  postcode: z.string().min(2).max(12),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'invalid_format', message: 'Please enter a valid UK postcode format.' },
        { status: 400 }
      );
    }

    const { postcode } = parsed.data;

    // 1. Postcodes.io validation
    const isValidUk = await validatePostcode(postcode);
    if (!isValidUk) {
      return NextResponse.json(
        { ok: false, error: 'invalid_uk_postcode', message: 'That does not appear to be a valid UK postcode.' },
        { status: 400 }
      );
    }

    // 2. Service zones coverage check
    const coverage = await checkCoverage(postcode);
    if (!coverage.covered || !coverage.zone) {
      return NextResponse.json(
        {
          ok: false,
          error: 'outside_coverage',
          covered: false,
          message: coverage.message || "Sorry, we don't currently cover this postcode.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      ok: true,
      covered: true,
      data: {
        zone: coverage.zone,
        callout_charge: coverage.zone.callout_charge,
        message: coverage.message,
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'service_unavailable', message: 'Fitting area verification unavailable. Please try again later.' },
      { status: 503 }
    );
  }
}
