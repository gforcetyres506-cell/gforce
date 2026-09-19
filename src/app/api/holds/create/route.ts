import { NextResponse } from 'next/server';
import { createSlotHold } from '@/lib/db';
import { createHoldSchema } from '@/lib/validation';

export const runtime = 'nodejs';

/**
 * POST /api/holds/create
 * Soft-locks a slot for 15 minutes while the customer pays.
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

  const parsed = createHoldSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'validation_failed', message: 'Invalid slot.' },
      { status: 400 },
    );
  }

  const { slot_id, session_token } = parsed.data;

  try {
    const hold = await createSlotHold(slot_id, session_token, 15);
    if (!hold) {
      return NextResponse.json(
        { ok: false, error: 'slot_full', message: 'Someone just took that slot. Pick another.' },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: { hold_id: hold.hold_id, slot_id, expires_at: hold.expires_at },
    });
  } catch (err) {
    console.error('[holds/create] error:', err);
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Could not create reservation.' },
      { status: 500 },
    );
  }
}
