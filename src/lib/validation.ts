import { z } from 'zod';

/**
 * UK registration formats accepted:
 *   Current  (2001-)  AB12 CDE
 *   Prefix   (1983-2001) A123 BCD
 *   Suffix   (1963-1983) ABC 123A
 *   Dateless          ABC 123 / 123 ABC
 * Spaces are stripped before matching.
 */
const UK_REG_PATTERNS = [
  /^[A-Z]{2}[0-9]{2}[A-Z]{3}$/,        // AB12CDE
  /^[A-Z][0-9]{1,3}[A-Z]{3}$/,         // A123BCD
  /^[A-Z]{3}[0-9]{1,3}[A-Z]$/,         // ABC123A
  /^[A-Z]{1,3}[0-9]{1,4}$/,            // ABC1234
  /^[0-9]{1,4}[A-Z]{1,3}$/,            // 1234ABC
];

export function isValidUkReg(reg: string): boolean {
  const clean = reg.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length < 2 || clean.length > 8) return false;
  return UK_REG_PATTERNS.some((p) => p.test(clean));
}

export const ukRegSchema = z
  .string()
  .min(2)
  .max(10)
  .refine(isValidUkReg, { message: 'That does not look like a UK registration.' });

/** Loose UK postcode shape — Postcodes.io does the authoritative check. */
export const ukPostcodeSchema = z
  .string()
  .min(5)
  .max(9)
  .refine(
    (v) => /^(?:[A-Z]{1,2}[0-9][A-Z0-9]?|GIR)[0-9][A-Z]{2}$/.test(v.toUpperCase().replace(/\s+/g, '')),
    { message: 'Enter a full UK postcode.' }
  );

/** Blocks the obvious throwaway domains. Not exhaustive by design. */
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', '10minutemail.com',
  'throwawaymail.com', 'yopmail.com', 'trashmail.com', 'sharklasers.com',
  'getnada.com', 'temp-mail.org', 'fakeinbox.com', 'maildrop.cc',
]);

export const emailSchema = z
  .string()
  .email('Enter a valid email address.')
  .refine((v) => !DISPOSABLE_DOMAINS.has(v.split('@')[1]?.toLowerCase() ?? ''), {
    message: 'Please use a permanent email address.',
  });

export const ukPhoneSchema = z
  .string()
  .min(10)
  .max(16)
  .refine((v) => /^(\+?44|0)[0-9]{9,10}$/.test(v.replace(/[\s-()]/g, '')), {
    message: 'Enter a valid UK phone number.',
  });

export const tyreSizeSchema = z.object({
  width: z.coerce.number().int().min(115).max(355),
  profile: z.coerce.number().int().min(20).max(85),
  rim: z.coerce.number().int().min(12).max(24),
});

// ── Request schemas for API routes ──

export const vrmLookupSchema = z.object({
  registration: ukRegSchema,
  postcode: ukPostcodeSchema,
  email: emailSchema.optional(),
  turnstileToken: z.string().max(2048).optional(),
});

export const createHoldSchema = z.object({
  slot_id: z.string().uuid(),
  session_token: z.string().uuid(),
});

export const releaseHoldSchema = z.object({
  slot_id: z.string().min(1),
  session_token: z.string().min(8).max(64),
});

export const checkoutSchema = z.object({
  slot_id: z.string().uuid(),
  session_token: z.string().uuid(),
  customer: z.object({
    name: z.string().min(2).max(80),
    email: emailSchema,
    phone: ukPhoneSchema,
    address_line1: z.string().min(3).max(120),
    address_line2: z.string().max(120).optional().or(z.literal('')),
    city: z.string().max(60).optional().or(z.literal('')),
    postcode: ukPostcodeSchema,
  }).strict(),
  vehicle: z.object({
    reg: z.string().max(10).optional().or(z.literal('')),
    make: z.string().max(60).optional().or(z.literal('')),
    model: z.string().max(60).optional().or(z.literal('')),
  }).strict(),
  // Only IDs and quantities cross the wire. Prices are looked up server-side.
  items: z
    .array(z.object({ tyre_id: z.string().uuid(), quantity: z.number().int().min(1).max(8) }).strict())
    .min(1)
    .max(6),
  notes: z.string().max(500).optional().or(z.literal('')),
}).strict();
