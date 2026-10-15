'use client';

import { createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, Phone } from 'lucide-react';
import type { BusinessContact } from '@/lib/business-contact';

const ContactContext = createContext<BusinessContact>({ phone: null, whatsapp: null });

export function BusinessContactProvider({ contact, children }: {
  contact: BusinessContact;
  children: React.ReactNode;
}) {
  return <ContactContext.Provider value={contact}>{children}</ContactContext.Provider>;
}

export function ContactActions({ className = '', showNumber = false, onAction }: {
  className?: string;
  showNumber?: boolean;
  onAction?: () => void;
}) {
  const { phone, whatsapp } = useContext(ContactContext);
  if (!phone && !whatsapp) return null;

  return (
    <div className={`contact-actions ${className}`}>
      {phone && (
        <a href={phone.href} className="btn btn-secondary btn-sm" data-critical-action onClick={onAction}>
          <Phone size={16} aria-hidden="true" />
          <span>Call to book{showNumber && <span className="block text-xs normal-case tracking-normal">{phone.display}</span>}</span>
        </a>
      )}
      {whatsapp && (
        <a href={whatsapp.href} className="btn btn-secondary btn-sm" data-critical-action onClick={onAction}>
          <MessageCircle size={16} aria-hidden="true" /> WhatsApp
        </a>
      )}
    </div>
  );
}

export function MobileContactBar() {
  const { phone, whatsapp } = useContext(ContactContext);
  const pathname = usePathname();
  if ((!phone && !whatsapp) || pathname.startsWith('/admin')) return null;
  return (
    <aside aria-label="Contact G Force Tyres" className="mobile-contact-bar lg:hidden">
      <ContactActions />
    </aside>
  );
}
