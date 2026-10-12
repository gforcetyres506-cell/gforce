import 'server-only';

import { forbidden, redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getRequestOrigin } from '@/lib/request-origin';
import { permits, type AdminPermission, type AdminRole } from './permissions';

export type { AdminRole } from './permissions';

export interface AdminProfile {
  id: string;
  user_id: string;
  name: string;
  role: AdminRole;
  active: boolean;
}

export interface AdminContext {
  user: User;
  profile: AdminProfile;
  supabase: SupabaseClient;
  sessionId: string;
}

export class AdminAccessError extends Error {
  constructor(
    public readonly status: 401 | 403 | 503,
    message: string,
  ) {
    super(message);
    this.name = 'AdminAccessError';
  }
}

export async function requireAdmin(permission: AdminPermission = 'operate'): Promise<AdminContext> {
  let supabase: SupabaseClient;

  try {
    supabase = await createClient();
  } catch {
    throw new AdminAccessError(503, 'Admin authentication is not configured.');
  }

  return authorizeAdminClient(supabase, permission);
}

export async function authorizeAdminClient(supabase: SupabaseClient, permission: AdminPermission): Promise<AdminContext> {

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new AdminAccessError(401, 'Authentication required.');
  }

  const session = await supabase.rpc('has_live_session');
  if (session.error) throw new AdminAccessError(503, 'Session validation unavailable.');
  if (session.data !== true) throw new AdminAccessError(401, 'Session has been revoked.');

  const { data, error } = await supabase.rpc('admin_session_context');

  if (error) {
    throw new AdminAccessError(503, 'Admin authorization is temporarily unavailable.');
  }

  const profile = (Array.isArray(data) && data.length === 1 ? data[0] : null) as
    (AdminProfile & { session_id: string }) | null;
  if (!profile || profile.user_id !== authData.user.id || !profile.active ||
    !profile.session_id || !permits(profile.role, permission)) {
    throw new AdminAccessError(403, 'Access denied.');
  }

  return { user: authData.user, profile, supabase, sessionId: profile.session_id };
}

export async function requireAdminPage(): Promise<AdminContext> {
  try {
    return await requireAdmin('read');
  } catch (error) {
    if (error instanceof AdminAccessError) {
      if (error.status === 401 || error.status === 503) redirect('/admin/login');
      forbidden();
    }
    throw error;
  }
}

export function adminErrorResponse(error: unknown): NextResponse {
  if (error instanceof AdminAccessError) {
    return NextResponse.json(
      { ok: false, error: error.status === 401 ? 'unauthorized' : error.status === 503 ? 'service_unavailable' : 'forbidden' },
      { status: error.status },
    );
  }

  return NextResponse.json(
    { ok: false, error: 'server_error', message: 'The request could not be completed.' },
    { status: 500 },
  );
}

/** Browsers supply Origin for mutations. Cross-origin cookie use is denied. */
export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (request.headers.get('sec-fetch-site') === 'cross-site' ||
    (origin && origin !== getRequestOrigin(request))) {
    throw new AdminAccessError(403, 'Cross-origin request denied.');
  }
}
