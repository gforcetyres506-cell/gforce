import 'server-only';
import { Resend } from 'resend';
import { SITE_NAME, SITE_ORIGIN } from './site';
import { formatPrice, formatSlotTime } from './utils';
import type { BookingWithDetails } from '@/types';

let cached: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cached) cached = new Resend(key);
  return cached;
}

const FROM = process.env.EMAIL_FROM;
const SITE = SITE_ORIGIN;

/**
 * Email is best-effort. A failed send must NEVER fail a paid booking —
 * the customer's money is already taken and the booking is confirmed.
 * Log and move on.
 */
async function send(to: string, subject: string, html: string): Promise<void> {
  const resend = getResend();
  if (!resend || !FROM || /onboarding@resend\.dev/i.test(FROM)) {
    console.warn('[email] approved sender configuration unavailable');
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch {
    console.error('[email] provider send failed');
  }
}

function shell(heading: string, body: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0D0D0D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0D;padding:32px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;background:#141414;border:1px solid #2A2A2A;border-radius:8px;overflow:hidden;">
  <tr><td style="padding:28px 32px;border-bottom:1px solid #2A2A2A;">
    <div style="font-size:20px;font-weight:700;color:#F5F5F5;letter-spacing:-0.02em;">G FORCE <span style="color:#38BDF8;">TYRES</span></div>
  </td></tr>
  <tr><td style="padding:32px;">
    <h1 style="margin:0 0 20px;font-size:22px;color:#F5F5F5;font-weight:700;">${heading}</h1>
    ${body}
  </td></tr>
  <tr><td style="padding:20px 32px;border-top:1px solid #2A2A2A;color:#6B6B6B;font-size:12px;">
    ${SITE_NAME} · Mobile tyre fitting
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;color:#A3A3A3;font-size:14px;">${escapeHtml(label)}</td>
    <td style="padding:8px 0;color:#F5F5F5;font-size:14px;text-align:right;font-weight:600;">${value}</td>
  </tr>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function bookingTable(b: BookingWithDetails): string {
  const when = b.slot
    ? `${new Date(b.slot.slot_date).toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long',
      })}, ${formatSlotTime(b.slot.start_time)}–${formatSlotTime(b.slot.end_time)}`
    : 'To be confirmed';

  const items = b.items
    .map((i) => row(`${i.quantity} × ${i.tyre_label}`, formatPrice(i.line_total)))
    .join('');

  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
    ${row('Reference', `<span style="font-family:monospace;color:#38BDF8;">${escapeHtml(b.booking_ref)}</span>`)}
    ${row('Appointment', when)}
    ${b.fitting_address ? row('Address', escapeHtml(`${b.fitting_address}, ${b.fitting_postcode ?? ''}`)) : ''}
    ${b.vehicle_reg ? row('Vehicle', escapeHtml(`${b.vehicle_reg} ${b.vehicle_make ?? ''} ${b.vehicle_model ?? ''}`)) : ''}
    <tr><td colspan="2" style="padding-top:12px;border-top:1px solid #2A2A2A;"></td></tr>
    ${items}
    ${row('Mobile fitting', formatPrice(b.fitting_fee))}
    ${b.callout_charge > 0 ? row('Call-out', formatPrice(b.callout_charge)) : ''}
    <tr><td colspan="2" style="padding-top:12px;border-top:1px solid #2A2A2A;"></td></tr>
    ${row('Total', formatPrice(b.total_amount))}
    ${row('Deposit paid', `<span style="color:#22C55E;">${formatPrice(b.deposit_amount)}</span>`)}
    ${row('Balance on the day', formatPrice(b.balance_due))}
  </table>`;
}

function manageButton(token: string): string {
  return `<a href="${SITE}/manage/${token}"
    style="display:inline-block;background:#38BDF8;color:#0D0D0D;text-decoration:none;
    padding:14px 28px;font-weight:700;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;">
    Manage your booking</a>`;
}

export async function sendBookingConfirmed(b: BookingWithDetails): Promise<void> {
  if (!b.customer?.email) return;
  await send(
    b.customer.email,
    `Booking confirmed — ${b.booking_ref}`,
    shell(
      'Your fitting is booked',
      `<p style="color:#A3A3A3;font-size:15px;line-height:1.6;margin:0 0 8px;">
         Thanks${b.customer.name ? `, ${escapeHtml(b.customer.name.split(' ')[0])}` : ''}. Your deposit is received
         and your slot is reserved. Check your private management link for the recorded details.
       </p>
       ${bookingTable(b)}
       <p style="margin:24px 0 0;">${manageButton(b.manage_token)}</p>`
    )
  );
}

export async function sendBookingReminder(b: BookingWithDetails): Promise<void> {
  if (!b.customer?.email) return;
  await send(
    b.customer.email,
    `Tomorrow: your tyre fitting — ${b.booking_ref}`,
    shell(
      'See you tomorrow',
      `<p style="color:#A3A3A3;font-size:15px;line-height:1.6;">
         A reminder that your mobile tyre fitting is tomorrow. Please make sure the vehicle
         is accessible and unlocked when our fitter arrives.
       </p>
       ${bookingTable(b)}
       <p style="margin:24px 0 0;">${manageButton(b.manage_token)}</p>`
    )
  );
}

export async function sendCancellation(b: BookingWithDetails, refundPence: number): Promise<void> {
  if (!b.customer?.email) return;
  await send(
    b.customer.email,
    `Booking cancelled — ${b.booking_ref}`,
    shell(
      'Your booking is cancelled',
      `<p style="color:#A3A3A3;font-size:15px;line-height:1.6;">
         Booking <strong style="color:#F5F5F5;">${escapeHtml(b.booking_ref)}</strong> has been cancelled.
         ${refundPence > 0
           ? `Recorded refund amount: <strong style="color:#22C55E;">${formatPrice(refundPence)}</strong>. Contact us to check payment status and timing.`
           : 'Contact us for the applicable cancellation and refund information.'}
       </p>`
    )
  );
}

export async function sendJobCompleted(b: BookingWithDetails): Promise<void> {
  if (!b.customer?.email) return;
  await send(
    b.customer.email,
    `All done — ${b.booking_ref}`,
    shell(
      'Fitting complete',
      `<p style="color:#A3A3A3;font-size:15px;line-height:1.6;">
         Your fitting has been recorded as complete. Follow the vehicle and tyre
         manufacturers’ instructions and the fitter’s guidance for aftercare.
       </p>
       ${bookingTable(b)}`
    )
  );
}
