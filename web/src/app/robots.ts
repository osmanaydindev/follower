import type { MetadataRoute } from 'next';

// Same reason as the sitemap: the `Sitemap:` line depends on SITE_URL, which is
// a deployment setting rather than a build-time one.
export const dynamic = 'force-dynamic';

/**
 * The marketing pages are meant to be found; the panel and the sign-in page
 * are not. They are also `noindex` in their own metadata — this just saves
 * crawlers the request.
 */
export default function robots(): MetadataRoute.Robots {
  const site = process.env.SITE_URL;
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/tr/panel', '/en/panel', '/tr/giris', '/en/giris', '/api/'],
    },
    ...(site ? { sitemap: `${site}/sitemap.xml` } : {}),
  };
}
