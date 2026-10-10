export interface BusinessContact {
  phone: { display: string; href: string } | null;
  whatsapp: { href: string } | null;
}

// Only explicit, owner-approved configuration belongs here. In particular, do
// not supply a number when verified business contact configuration is absent.
function internationalNumber(value?: string): string | null {
  if (!value || !/^\+[\d\s().-]+$/.test(value.trim())) return null;
  const number = value.replace(/[\s().-]/g, '');
  return /^\+[1-9]\d{6,14}$/.test(number) ? number : null;
}

export function createBusinessContact(phone?: string, whatsapp?: string): BusinessContact {
  const phoneNumber = internationalNumber(phone);
  const whatsappNumber = internationalNumber(whatsapp);
  return {
    phone: phoneNumber ? { display: phone!.trim(), href: `tel:${phoneNumber}` } : null,
    whatsapp: whatsappNumber ? { href: `https://wa.me/${whatsappNumber.slice(1)}` } : null,
  };
}
