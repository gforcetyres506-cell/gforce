import type { Metadata } from 'next';

// The owner-specified public identity. Never derive search URLs from request
// headers, APP_URL, tracking parameters or a customer's booking URL.
export const SITE_ORIGIN = 'https://www.gforcetyres-mobile.co.uk';
export const SITE_NAME = 'G Force Tyres Mobile';
export const SEARCH_PAGES = [
  '/',
  '/mobile-tyre-fitting',
  '/how-it-works',
  '/coverage',
  '/contact',
  '/guides',
  '/guides/tyre-size',
  '/guides/puncture-repair',
  '/guides/mobile-fitting-checklist',
  '/guides/tyre-replacement-signs',
  '/guides/load-speed-ratings',
] as const;

export function publicMetadata(path: string, title: string, description: string): Metadata {
  const url = path === '/' ? SITE_ORIGIN : new URL(path, SITE_ORIGIN).href;
  const fullTitle = `${title} | ${SITE_NAME}`;
  return {
    title: { absolute: fullTitle }, description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title: fullTitle, description, url, siteName: SITE_NAME, type: 'website', locale: 'en_GB',
      images: [{ url: `${SITE_ORIGIN}/opengraph-image`, width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: { card: 'summary_large_image', title: fullTitle, description, images: [`${SITE_ORIGIN}/opengraph-image`] },
  };
}

export function utilityMetadata(title: string, description: string, follow = true): Metadata {
  // No inherited canonical or social URL on private/token-bearing routes.
  return { title, description, robots: { index: false, follow }, alternates: { canonical: null }, openGraph: null, twitter: null };
}
