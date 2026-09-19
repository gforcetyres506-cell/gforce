import { NextResponse } from 'next/server';
import { getSlots, generateSlots } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/slots?date=YYYY-MM-DD
 * Returns all active booking slots and their current remaining capacity.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') ?? undefined;

    let slots = await getSlots(date);

    // If no slots exist for the next 14 days, auto-generate them
    if (slots.length === 0 && !date) {
      const todayStr = new Date().toISOString().split('T')[0];
      await generateSlots(todayStr, 14);
      slots = await getSlots(date);
    }

    return NextResponse.json({ ok: true, data: slots });
  } catch (err) {
    console.error('[api/slots] Error fetching slots:', err);
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Could not fetch availability.' },
      { status: 500 },
    );
  }
}
