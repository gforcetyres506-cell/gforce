import { NextResponse } from 'next/server';
import { adminErrorResponse, requireAdmin } from '@/lib/auth/admin';

export const runtime = 'nodejs';

/** No in-memory scheduling or implicit business opening hours. */
export async function POST() {
  try { await requireAdmin(); } catch (error) { return adminErrorResponse(error); }
  return NextResponse.json({ ok: false, error: 'service_unavailable',
    message: 'Scheduling changes are unavailable until persistent availability workflows are verified. No change has been made.',
  }, { status: 503 });
}
