import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch {
    return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
