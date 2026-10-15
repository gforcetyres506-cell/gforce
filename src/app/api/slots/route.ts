import { NextResponse } from 'next/server';
import { getSlots } from '@/lib/db';
import { z } from 'zod';

export const runtime = 'nodejs';
const date = z.string().date();
const rangeSchema = z.object({ from: date.optional(), to: date.optional() }).strict()
  .refine(v => !v.from || !v.to || v.from <= v.to);
/** Read-only availability. Empty schedules are never populated on a GET. */
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const parsed = rangeSchema.safeParse(Object.fromEntries(params));
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_dates', message: 'Check the fitting dates.' }, { status: 400 });
    const data = await getSlots(parsed.data.from, parsed.data.to);
    return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'service_unavailable', message: 'Fitting availability unavailable. Please try again later.' }, { status: 503 });
  }
}
