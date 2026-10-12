import type { Metadata } from 'next';
import { Bebas_Neue, Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { BusinessContactProvider, MobileContactBar } from '@/components/layout/BusinessContact';
import { headers } from 'next/headers';
import { SecurityNonceProvider } from '@/components/SecurityNonce';
import { SITE_NAME, SITE_ORIGIN } from '@/lib/site';
import { getBusinessFacts } from '@/lib/business-entity';

const displayFont = Bebas_Neue({ weight: '400', subsets: ['latin'], variable: '--font-brand-display', display: 'swap' });
const bodyFont = Inter({ subsets: ['latin'], variable: '--font-brand-body', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    'Check your postcode and tyre size with G Force Tyres Mobile.',
  icons: {
    icon: [{ url: '/icon.png', type: 'image/png', sizes: '512x512' }],
    apple: [{ url: '/apple-icon.png', type: 'image/png', sizes: '180x180' }],
  },
  // Indexable pages opt in with their own canonical and social metadata.
  robots: { index: false, follow: true },
};

export const viewport = {
  themeColor: '#0D0D0D',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonces require request-time rendering. Never cache nonce-bearing HTML.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const { contact } = getBusinessFacts();
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
        <SecurityNonceProvider nonce={nonce}><BusinessContactProvider contact={contact}>
          <Header />
          <main id="main" className="min-w-0">{children}</main>
          <Footer />
          <MobileContactBar />
        </BusinessContactProvider></SecurityNonceProvider>
      </body>
    </html>
  );
}
