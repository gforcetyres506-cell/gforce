/**
 * Shared types for G Force Tyres.
 *
 * MONEY RULE: every monetary value in this codebase is an integer
 * number of PENCE. £149.00 is 14900. Never introduce a float.
 * Use formatPrice() from lib/utils to display.
 */

// ─────────────────────────────────────────────────────────────
// Catalogue
// ─────────────────────────────────────────────────────────────

export type TyreTier = 'budget' | 'standard' | 'premium';
export type TyreSeason = 'summer' | 'all-season' | 'winter';

export interface Tyre {
  id: string;
  brand: string;
  model: string;
  sku: string;
  width: number;
  profile: number;
  rim: number;
  load_index: string | null;
  speed_rating: string | null;
  is_run_flat: boolean;
  is_xl: boolean;
  season: TyreSeason;
  tier: TyreTier;
  sell_price: number;
  stock: number;
  wet_grip: string | null;
  fuel_economy: string | null;
  noise_db: number | null;
  image_url: string | null;
  active: boolean;
  created_at: string;
}

export interface TyreSize {
  width: number;
  profile: number;
  rim: number;
}

// ─────────────────────────────────────────────────────────────
// Coverage
// ─────────────────────────────────────────────────────────────

export interface ServiceZone {
  id: string;
  postcode_prefix: string;
  zone_name: string;
  callout_charge: number;
  active: boolean;
}

export interface CoverageResult {
  covered: boolean;
  zone?: ServiceZone;
  message: string;
}

// ─────────────────────────────────────────────────────────────
// Vehicle lookup
// ─────────────────────────────────────────────────────────────

export interface VehicleTyreSpec {
  width: number;
  profile: number;
  rim: number;
  load_index?: string;
  speed_rating?: string;
  is_run_flat?: boolean;
  pressure_psi?: number;
}

export interface VRMResult {
  registration: string;
  make: string;
  model: string;
  derivative?: string;
  year?: number;
  front: VehicleTyreSpec;
  /** Present only when the vehicle runs a staggered (different rear) setup. */
  rear?: VehicleTyreSpec;
  isStaggered: boolean;
  /** Where the data came from — surfaced in dev, not to customers. */
  source: 'oneauto';
}

export type VRMErrorCode =
  | 'invalid_reg'
  | 'outside_coverage'
  | 'rate_limited'
  | 'bot_check_failed'
  | 'lookup_failed'
  | 'not_configured';

// ─────────────────────────────────────────────────────────────
// Slots & booking
// ─────────────────────────────────────────────────────────────

export interface BookingSlot {
  id: string;
  slot_date: string;   // YYYY-MM-DD
  start_time: string;  // HH:MM:SS
  end_time: string;
  max_bookings: number;
  active: boolean;
  created_at?: string;
}

export interface SlotWithAvailability extends BookingSlot {
  remaining: number;
  available: boolean;
}

export interface SlotHold {
  hold_id: string;
  slot_id: string;
  expires_at: string;
}

export type BookingStatus =
  | 'AWAITING_BANK_PAYMENT'
  | 'EXPIRED'
  | 'pending_payment'
  | 'confirmed'
  | 'tyres_reserved'
  | 'fitter_assigned'
  | 'en_route'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'payment_failed';

export const BOOKING_STATUS_FLOW: BookingStatus[] = [
  'pending_payment',
  'confirmed',
  'tyres_reserved',
  'fitter_assigned',
  'en_route',
  'completed',
];

export interface Customer {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  created_at: string;
}

export interface BookingItem {
  id: string;
  booking_id: string;
  tyre_id: string | null;
  tyre_label: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface Booking {
  id: string;
  booking_ref: string;
  manage_token: string;
  customer_id: string | null;
  slot_id: string | null;
  fitter_id: string | null;

  vehicle_reg: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_derivative: string | null;

  fitting_address: string | null;
  fitting_postcode: string | null;
  customer_notes: string | null;
  admin_notes: string | null;

  status: BookingStatus;

  tyres_total: number;
  fitting_fee: number;
  callout_charge: number;
  total_amount: number;
  deposit_amount: number;
  balance_due: number;

  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  deposit_paid_at: string | null;
  bank_payment_expires_at?: string | null;

  created_at: string;
  updated_at: string;
}

export interface BookingWithDetails extends Booking {
  customer: Customer | null;
  slot: BookingSlot | null;
  items: BookingItem[];
}

// ─────────────────────────────────────────────────────────────
// Pricing
// ─────────────────────────────────────────────────────────────

export interface CartLine {
  tyre_id: string;
  quantity: number;
}

export interface PriceBreakdown {
  lines: Array<{
    tyre_id: string;
    label: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  tyres_total: number;
  fitting_fee: number;
  callout_charge: number;
  total_amount: number;
  deposit_amount: number;
  balance_due: number;
}

export interface AppSettings {
  deposit_mode: 'fixed' | 'percent';
  deposit_fixed: number;
  deposit_percent: number;
  fitting_fee: number;
  job_duration_mins: number;
  cancellation_policy: string;
  business_phone: string | null;
}

// ─────────────────────────────────────────────────────────────
// API envelopes
// ─────────────────────────────────────────────────────────────

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: string; message: string };
export type ApiResponse<T> = ApiOk<T> | ApiErr;
