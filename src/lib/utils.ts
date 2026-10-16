import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Pence -> "£149.00". The only place money becomes a string. */
export function formatPrice(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100);
}

/** "225/45 R18 95Y" */
export function formatTyreSize(t: {
  width: number; profile: number; rim: number;
  load_index?: string | null; speed_rating?: string | null;
  is_xl?: boolean;
}): string {
  const base = `${t.width}/${t.profile} R${t.rim}`;
  const rating = [t.load_index, t.speed_rating].filter(Boolean).join('');
  return [base, rating, t.is_xl ? 'XL' : null].filter(Boolean).join(' ');
}

/** "AB21ABC" -> "AB21 ABC" for display. */
export function formatReg(reg: string): string {
  const clean = reg.toUpperCase().replace(/\s+/g, '');
  if (clean.length === 7) return `${clean.slice(0, 4)} ${clean.slice(4)}`;
  return clean;
}

/** Strip spaces + uppercase. Use this before every DB write or API call. */
export function normaliseReg(reg: string): string {
  return reg.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** "SW1A 1AA" -> "SW1A1AA" */
export function normalisePostcode(pc: string): string {
  return pc.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** "09:00:00" -> "9:00am" */
export function formatSlotTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, '0')}${period}`;
}

/** Crypto-random session token for slot holds. */
export function makeSessionToken(): string {
  return crypto.randomUUID();
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Safely extracts an inventory record whether returned by PostgREST as a 1:1 object relation
 * or as an array of rows. Returns null only if no inventory record is present.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractInventory<T = Record<string, any>>(inv: unknown): T | null {
  if (!inv) return null;
  if (Array.isArray(inv)) return inv.length > 0 ? (inv[0] as T) : null;
  if (typeof inv === 'object') return inv as T;
  return null;
}
