import { NextResponse } from 'next/server';
import { adminErrorResponse, requireAdmin } from '@/lib/auth/admin';
import { getAllTyresAdmin } from '@/lib/db';

export const runtime = 'nodejs';
export async function GET() {
  try { await requireAdmin(); } catch (error) { return adminErrorResponse(error); }
  try {
    return NextResponse.json({ ok: true, data: await getAllTyresAdmin() });
  } catch {
    return NextResponse.json({ ok: false, error: 'service_unavailable', message: 'Inventory unavailable.' }, { status: 503 });
  }
}
async function unavailable() {
  try { await requireAdmin(); } catch (error) { return adminErrorResponse(error); }
  return NextResponse.json({ ok: false, error: 'service_unavailable',
    message: 'Inventory changes are unavailable until persistent admin workflows are verified. No change has been made.',
  }, { status: 503 });
}
export const POST = unavailable;
export const PATCH = unavailable;
