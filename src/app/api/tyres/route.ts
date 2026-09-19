import { NextResponse } from 'next/server';
import { getTyres } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/tyres
 * Query tyres catalogue with optional filters:
 * ?w=225&p=45&r=18&tier=premium&season=summer
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const width = searchParams.get('w') ? Number(searchParams.get('w')) : undefined;
    const profile = searchParams.get('p') ? Number(searchParams.get('p')) : undefined;
    const rim = searchParams.get('r') ? Number(searchParams.get('r')) : undefined;
    const tier = searchParams.get('tier') ?? undefined;
    const season = searchParams.get('season') ?? undefined;

    const tyres = await getTyres({ width, profile, rim, tier, season });

    return NextResponse.json({ ok: true, data: tyres });
  } catch (err) {
    console.error('[api/tyres] failed to load catalogue:', err);
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Could not load tyre catalogue.' },
      { status: 500 },
    );
  }
}
