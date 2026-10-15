import type { MetadataRoute } from 'next';
import { SEARCH_PAGES, SITE_ORIGIN } from '@/lib/site';

export const dynamic = 'force-dynamic';
export default function sitemap(): MetadataRoute.Sitemap {
  // Deliberate allowlist; no query strings, token paths, legal drafts or empty
  // catalogue. No invented lastModified, priorities or ranking promises.
  return SEARCH_PAGES.map((path) => ({ url: path === '/' ? SITE_ORIGIN : new URL(path, SITE_ORIGIN).href }));
}
