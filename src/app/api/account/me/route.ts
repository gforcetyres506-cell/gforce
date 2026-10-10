import { NextResponse } from 'next/server';

// V1 is guest checkout. Supabase Auth is reserved for provisioned operators.
export async function GET() {
  return NextResponse.json({ ok: false, error: 'not_available', message: 'Customer accounts are unavailable in V1.' }, { status: 404 });
}
