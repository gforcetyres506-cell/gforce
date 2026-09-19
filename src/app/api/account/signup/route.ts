import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient, isSupabaseConfigured } from '@/lib/supabase';
import { emailSchema, ukPhoneSchema } from '@/lib/validation';

export const runtime = 'nodejs';

const signupSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters.').max(100),
  name: z.string().min(2, 'Name must be at least 2 characters.').max(80),
  phone: ukPhoneSchema,
  address: z.string().max(120).optional().or(z.literal('')),
  postcode: z.string().max(10).optional().or(z.literal('')),
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: 'validation_failed',
          message: parsed.error.errors[0]?.message ?? 'Invalid registration details.',
        },
        { status: 400 },
      );
    }

    const { email, password, name, phone, address, postcode } = parsed.data;
    const lowerEmail = email.toLowerCase().trim();

    // 1. Create user in Supabase Auth (using service client to avoid public SMTP rate limits)
    let userId: string | undefined;

    if (isSupabaseConfigured()) {
      const serviceClient = createServiceClient();
      
      // Check if user already exists
      const { data: listData } = await serviceClient.auth.admin.listUsers();
      const existingUser = listData?.users?.find(
        (u) => u.email?.toLowerCase() === lowerEmail,
      );

      if (existingUser) {
        return NextResponse.json(
          {
            ok: false,
            error: 'user_exists',
            message: 'An account with this email address already exists. Please sign in.',
          },
          { status: 400 },
        );
      }

      const { data: createData, error: createErr } = await serviceClient.auth.admin.createUser({
        email: lowerEmail,
        password,
        email_confirm: true,
        user_metadata: { name, phone },
      });

      if (createErr || !createData.user) {
        return NextResponse.json(
          {
            ok: false,
            error: 'auth_error',
            message: createErr?.message || 'Unable to register account with that email.',
          },
          { status: 400 },
        );
      }

      userId = createData.user.id;

      // 2. Ensure customer profile exists in database
      try {
        const { data: existingCust } = await serviceClient
          .from('customers')
          .select('id')
          .eq('email', lowerEmail)
          .maybeSingle();

        if (existingCust) {
          await serviceClient
            .from('customers')
            .update({
              name,
              phone,
              address_line1: address || undefined,
              postcode: postcode || undefined,
            })
            .eq('id', existingCust.id);
        } else {
          await serviceClient.from('customers').insert({
            email: lowerEmail,
            name,
            phone,
            address_line1: address || null,
            postcode: postcode || null,
          });
        }
      } catch (err) {
        console.warn('[signup] Customer profile sync warning:', err);
      }
    } else {
      // Local fallback
      userId = 'local-user-' + Date.now();
    }

    return NextResponse.json({
      ok: true,
      message: 'Account registered successfully.',
      user: {
        id: userId,
        email: lowerEmail,
        name,
      },
    });
  } catch (err) {
    console.error('[signup] error:', err);
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Failed to complete registration.' },
      { status: 500 },
    );
  }
}
