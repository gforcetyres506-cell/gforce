import PolicyPage from '@/components/content/PolicyPage';
import { utilityMetadata } from '@/lib/site';
export const metadata = utilityMetadata('Privacy Policy', 'Privacy information for G Force Tyres Mobile. Contact the business for the full policy before providing booking details.');
export default function PrivacyPage() {
  return <PolicyPage title="Privacy policy">
    <section><h2 className="text-lg font-bold text-ink-1 mb-2">Website technology</h2><p>Sign-in uses session cookies. The booking form asks for contact, vehicle and fitting-location information. No advertising or audience-analytics scripts are currently integrated into this website.</p></section>
    <p>Ask the business for its data-controller identity, purposes, retention periods and privacy-request contact before providing personal information.</p>
  </PolicyPage>;
}
