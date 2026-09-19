import { NextResponse } from 'next/server';
import { releaseSlotHold } from '@/lib/db';
import { releaseHoldSchema } from '@/lib/validation';

export const runtime = 'nodejs';

/**
 * POST /api/holds/release — free the slot when the user backs out.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'bad_request', message: 'Invalid request.' },
      { status: 400 },
    );
  }

  const parsed = releaseHoldSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'validation_failed', message: 'Invalid slot.' },
      { status: 400 },
    );
  }

  const { slot_id, session_token } = parsed.data;

  try {
    await releaseSlotHold(slot_id, session_token);
    return NextResponse.json({ ok: true, data: { released: true } });
  } catch (err) {
    console.warn('[holds/release] release failed:', err);
    return NextResponse.json({ ok: true, data: { released: true } });
  }
}
