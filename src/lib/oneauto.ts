import 'server-only';
import type { VRMResult } from '@/types';
import { ukRegSchema } from './validation';

/**
 * BLOCKED: no current G Force account contract or sandbox evidence supplied.
 * The former /tyres?vrm= request and permissive response guesses are retired.
 * Public provider documentation is recorded in 03_GATE1_REAL_DATA.md; it does
 * not establish this account's entitlement or response contract. Keep manual
 * entry until the account adapter is implemented and sandbox tested.
 */
export async function lookupVRM(registration: string): Promise<VRMResult | null> {
  if (!ukRegSchema.safeParse(registration).success) return null;
  return null;
}
