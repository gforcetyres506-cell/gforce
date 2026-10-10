import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSlotHold } from '@/lib/db';

export const runtime = 'nodejs';
const schema = z.object({ slot_id: z.string().uuid(), session_token: z.string().min(8).max(200) });
const message = 'That fitting time could not be reserved. Please choose another.';

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_hold', message }, { status: 400 });
  try {
    const data = await createSlotHold(parsed.data.slot_id, parsed.data.session_token);
    return NextResponse.json({ ok: true, data });
  } catch {
    return NextResponse.json({ ok: false, error: 'hold_unavailable', message }, { status: 503 });
  }
}
