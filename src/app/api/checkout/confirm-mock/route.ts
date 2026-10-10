import { NextResponse } from 'next/server';

/** Retired. Synthetic payment confirmation must never write business records. */
export async function POST() {
  return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
}
