import { NextResponse } from 'next/server';
import { getSlots } from '@/lib/db';

export const runtime = 'nodejs';
/** Read-only availability. Empty schedules are never populated on a GET. */
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const data = await getSlots(params.get('from') ?? undefined, params.get('to') ?? undefined);
    return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'service_unavailable', message: 'Fitting availability unavailable. Please try again later.' }, { status: 503 });
  }
}
