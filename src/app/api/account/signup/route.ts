import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { emailSchema, ukPhoneSchema } from '@/lib/validation';

export const runtime = 'nodejs';
const schema = z.object({
  email: emailSchema, password: z.string().min(8).max(100), name: z.string().min(2).max(80),
  phone: ukPhoneSchema, address: z.string().max(120).optional(), postcode: z.string().max(10).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'validation_failed', message: 'Check your registration details.' }, { status: 400 });
  try {
    const { email, password, name, phone, address, postcode } = parsed.data;
    const supabase = await createClient();
    // Use the real signup/verification flow. Never mark an unverified email
    // verified using the privileged admin API, or invent a customer/user ID.
    const { error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(), password,
      options: { data: { name, phone, address_line1: address, postcode } },
    });
    if (error) throw error;
    // Supabase deliberately obscures existing users. Do not claim a new account
    // was created or email delivered based solely on a successful API envelope.
    return NextResponse.json({ ok: true, message: 'Registration request received. Follow any email verification instructions before signing in.' });
  } catch {
    return NextResponse.json({ ok: false, error: 'service_unavailable', message: 'Registration unavailable. Please try again later.' }, { status: 503 });
  }
}
