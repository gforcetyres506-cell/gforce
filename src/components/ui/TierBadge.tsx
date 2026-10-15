// Canonical persisted tiers are budget/standard/premium. Historical input
// aliases affect display only; literal classes survive the Tailwind build.
const TIERS = {
  budget: { label: 'Budget', className: 'badge badge-budget' },
  standard: { label: 'Standard', className: 'badge badge-standard' },
  premium: { label: 'Premium', className: 'badge badge-premium' },
};

export function displayTier(tier: string): keyof typeof TIERS {
  return tier === 'mid' || tier === 'standard' ? 'standard' : tier === 'premium' ? 'premium' : 'budget';
}

export default function TierBadge({ tier }: { tier: string }) {
  const presentation = TIERS[displayTier(tier)];
  return <span className={presentation.className}>{presentation.label}</span>;
}
