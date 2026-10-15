import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminErrorResponse, requireAdmin, requireSameOrigin } from '@/lib/auth/admin';
import { emailBankInstructions } from '@/lib/bank-email';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  let actor;
  try { requireSameOrigin(request); actor = await requireAdmin(); } catch (error) { return adminErrorResponse(error); }
  const input = z.object({ booking_id: z.string().uuid() }).strict().safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 });
  try {
    const result = await emailBankInstructions(actor, input.data.booking_id);
    return NextResponse.json({ ok: true, status: result, message: 'Email accepted by the provider. Inbox delivery is not confirmed.' });
  } catch {
    return NextResponse.json({ ok: false, error: 'email_not_confirmed', message: 'Email acceptance could not be confirmed. Check email configuration and refresh before retrying.' }, { status: 503 });
  }
}
