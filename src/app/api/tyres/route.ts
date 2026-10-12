import { NextResponse } from 'next/server';
import { getTyres } from '@/lib/db';
import { z } from 'zod';

export const runtime = 'nodejs';
const filtersSchema = z.object({
  w: z.coerce.number().int().min(115).max(355).optional(),
  p: z.coerce.number().int().min(20).max(85).optional(),
  r: z.coerce.number().int().min(12).max(24).optional(),
  tier: z.enum(['budget', 'standard', 'premium']).optional(),
  season: z.enum(['summer', 'all-season', 'winter']).optional(),
}).strict();

/**
 * GET /api/tyres
 * Query tyres catalogue with optional filters:
 * ?w=225&p=45&r=18&tier=premium&season=summer
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = filtersSchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_filters', message: 'Check the tyre size and filters.' }, { status: 400 });
    const { w: width, p: profile, r: rim, tier, season } = parsed.data;
    const tyres = await getTyres({ width, profile, rim, tier, season });

    return NextResponse.json({ ok: true, data: tyres });
  } catch {
    console.error('[api/tyres] catalogue unavailable');
    return NextResponse.json(
      { ok: false, error: 'service_unavailable', message: 'Inventory unavailable. Please try again later.' },
      { status: 503 },
    );
  }
}
