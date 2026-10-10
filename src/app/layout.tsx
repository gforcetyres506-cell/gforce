import type { Metadata } from 'next';
import { Bebas_Neue, Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { BusinessContactProvider, MobileContactBar } from '@/components/layout/BusinessContact';
import { createBusinessContact } from '@/lib/business-contact';

const displayFont = Bebas_Neue({ weight: '400', subsets: ['latin'], variable: '--font-brand-display', display: 'swap' });
const bodyFont = Inter({ subsets: ['latin'], variable: '--font-brand-body', display: 'swap' });

export const metadata: Metadata = {
  applicationName: 'G Force Tyres Mobile',
  title: {
    default: 'G Force Tyres — Mobile Tyre Fitting',
    template: '%s | G Force Tyres',
  },
  description:
    'Find tyres for your vehicle and arrange mobile tyre fitting with G Force Tyres.',
  icons: {
    icon: [{ url: '/icon.png', type: 'image/png', sizes: '512x512' }],
    apple: [{ url: '/apple-icon.png', type: 'image/png', sizes: '180x180' }],
  },
  openGraph: {
    title: 'G Force Tyres — Mobile Tyre Fitting',
    description: 'Find tyres for your vehicle and arrange mobile tyre fitting with G Force Tyres.',
    type: 'website',
    locale: 'en_GB',
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: '#0D0D0D',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const contact = createBusinessContact(process.env.BUSINESS_PHONE, process.env.BUSINESS_WHATSAPP);
  const hasContact = Boolean(contact.phone || contact.whatsapp);
  return (
    <html lang="en-GB" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className={hasContact ? 'has-contact-bar' : undefined}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-brand focus:text-ink-inverse focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <BusinessContactProvider contact={contact}>
          <Header />
          <main id="main" className="min-w-0">{children}</main>
          <Footer />
          <MobileContactBar />
        </BusinessContactProvider>
      </body>
    </html>
  );
}
