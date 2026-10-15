import 'server-only';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabasePublicEnv } from '@/lib/env';

export async function createClient() {
  const env = getSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: { secure: process.env.NODE_ENV === 'production', sameSite: 'lax', httpOnly: true },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot write cookies. Route handlers and server
            // actions can, and should be used whenever a session is refreshed.
          }
        },
      },
    },
  );
}
