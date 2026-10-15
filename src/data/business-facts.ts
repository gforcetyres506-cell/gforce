import { SITE_NAME, SITE_ORIGIN } from '@/lib/site';

// Publish additional facts only after written owner approval. An empty value
// is intentional, never an invitation to use seed data or guess a location.
// Public phone/WhatsApp use the existing owner-approved environment settings.
export const approvedBusinessFacts = {
  name: SITE_NAME,
  url: SITE_ORIGIN,
  service: 'Mobile tyre fitting',
  logo: `${SITE_ORIGIN}/brand/g-force-tyres-logo.webp`,
  serviceAreas: [] as string[],
  email: null as string | null,
  socialProfiles: [] as string[],
  openingHours: null as string | null,
  // A private/residential base must never be added as a public address.
  publicAddress: null as string | null,
};
