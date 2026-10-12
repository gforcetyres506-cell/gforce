import 'server-only';
import { approvedBusinessFacts } from '@/data/business-facts';
import { createBusinessContact } from '@/lib/business-contact';

export function getBusinessFacts() {
  return {
    ...approvedBusinessFacts,
    contact: createBusinessContact(process.env.BUSINESS_PHONE, process.env.BUSINESS_WHATSAPP),
  };
}

export function organizationSchema() {
  const facts = getBusinessFacts();
  return {
    '@context': 'https://schema.org', '@type': 'Organization', '@id': `${facts.url}/#organization`,
    name: facts.name, url: facts.url, logo: facts.logo,
    ...(facts.contact.phone && { telephone: facts.contact.phone.href.slice(4) }),
    ...(facts.email && { email: facts.email }),
    ...(facts.socialProfiles.length > 0 && { sameAs: facts.socialProfiles }),
    ...(facts.serviceAreas.length > 0 && { areaServed: facts.serviceAreas }),
  };
}
