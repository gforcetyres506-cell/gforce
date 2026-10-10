import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSameOrigin, adminErrorResponse } from '@/lib/auth/admin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try { requireSameOrigin(request); } catch (error) { return adminErrorResponse(error); }
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  } catch {
    return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
