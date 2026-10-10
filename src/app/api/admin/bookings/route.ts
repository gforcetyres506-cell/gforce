import { NextResponse } from 'next/server';
import { adminErrorResponse, requireAdmin } from '@/lib/auth/admin';
import { getAllBookings } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try { await requireAdmin('read'); } catch (error) { return adminErrorResponse(error); }
  try {
    const params = new URL(req.url).searchParams;
    const data = await getAllBookings({ status: params.get('status') ?? undefined, query: params.get('q') ?? undefined });
    return NextResponse.json({ ok: true, data });
  } catch {
    return NextResponse.json({ ok: false, error: 'service_unavailable', message: 'Booking service unavailable.' }, { status: 503 });
  }
}

async function unavailable() {
  try { await requireAdmin(); } catch (error) { return adminErrorResponse(error); }
  return NextResponse.json({ ok: false, error: 'service_unavailable',
    message: 'Booking changes are unavailable until persistent booking and payment workflows are verified. No change has been made.',
  }, { status: 503 });
}
export const POST = unavailable;
export const PATCH = unavailable;
