import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/prototype/', '/preview/', '/test/'] },
    // Token paths are deliberately absent. Authentication and route noindex
    // protect private content; robots.txt is public and is not access control.
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
