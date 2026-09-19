import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(254),
  password: z.string().min(1, 'Password is required.').max(100),
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: 'validation_failed',
          message: parsed.error.errors[0]?.message ?? 'Invalid credentials.',
        },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;
    const lowerEmail = email.toLowerCase().trim();

    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: lowerEmail,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          ok: false,
          error: 'invalid_credentials',
          message: 'Invalid email or password.',
        },
        { status: 401 },
      );
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name: authData.user.user_metadata?.name ?? '',
      },
    });
  } catch (err) {
    console.error('[customer/login] error:', err);
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sign in is temporarily unavailable.' },
      { status: 500 },
    );
  }
}
