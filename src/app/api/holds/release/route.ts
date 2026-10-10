import { NextResponse } from 'next/server';
import { z } from 'zod';
import { releaseSlotHold } from '@/lib/db';

export const runtime = 'nodejs';
const schema = z.object({ session_token: z.string().min(8).max(200), slot_id: z.string().uuid().optional() });
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_hold' }, { status: 400 });
  try {
    await releaseSlotHold(parsed.data.session_token, parsed.data.slot_id);
    return NextResponse.json({ ok: true, data: { released: true } });
  } catch {
    return NextResponse.json({ ok: false, error: 'service_unavailable', message: 'Hold release could not be confirmed.' }, { status: 503 });
  }
}
