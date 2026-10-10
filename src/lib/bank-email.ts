import 'server-only';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase';
import type { AdminContext } from '@/lib/auth/admin';
import { bankDetailsSchema, paymentInstructions } from './bank-payments';

const outboxSchema = z.object({ id: z.string().uuid(), recipient: z.string().email(), deduplication_key: z.string().min(1).max(256),
  status: z.enum(['processing', 'sent']), attempts: z.number().int().positive(),
  payload: z.object({ reference: z.string().min(1), amount_pence: z.number().int().positive(), bank_details: bankDetailsSchema,
    expires_at: z.string().datetime({ offset: true }), manage_token: z.string().uuid() }),
});
/** Staff-requested only. Provider acknowledgement and inbox delivery are distinct. */
export async function emailBankInstructions(actor: AdminContext, bookingId: string): Promise<'accepted' | 'already_accepted'> {
  const key = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM, site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!key || !from || !site || !site.startsWith('https://') || /onboarding@resend\.dev/i.test(from)) throw new Error('Email configuration required');
  const db = createServiceClient();
  const result = await db.rpc('admin_claim_bank_email', { p_actor_user_id: actor.user.id, p_session_id: actor.sessionId, p_booking_id: bookingId });
  if (result.error) throw new Error('Instructions could not be queued');
  const parsed = outboxSchema.safeParse(Array.isArray(result.data) ? result.data[0] : result.data);
  if (!parsed.success) throw new Error('Instructions unavailable');
  const queued = parsed.data;
  if (queued.status === 'sent') return 'already_accepted';
  let providerId: string | null = null;
  try {
    if (Date.parse(queued.payload.expires_at) <= Date.now()) throw new Error('Reservation expired');
    const p = queued.payload;
    const text = paymentInstructions({ provider: 'manual', payment_method: 'bank_transfer', status: 'pending',
      amount_pence: p.amount_pence, currency: 'gbp', reference: p.reference, bank_details: p.bank_details, paid_at: null, verified: false }, p.expires_at)
      + '\nManage your booking: ' + new URL('/manage/' + p.manage_token, site).href;
    // Resend's documented endpoint and idempotency header. Plain text avoids HTML injection.
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'Idempotency-Key': queued.deduplication_key },
      body: JSON.stringify({ from, to: [queued.recipient], subject: 'Bank transfer instructions — ' + p.reference, text }),
    });
    const body = await response.json();
    if (!response.ok || !z.string().uuid().safeParse(body.id).success) throw new Error('Provider did not acknowledge email');
    providerId = body.id;
  } finally {
    const complete = await db.rpc('finish_bank_email', { p_outbox_id: queued.id, p_attempt: queued.attempts, p_message_id: providerId });
    if (complete.error || complete.data !== true) throw new Error('Email acceptance could not be recorded; retry uses the same request');
  }
  if (!providerId) throw new Error('Email acceptance unconfirmed');
  return 'accepted';
}
