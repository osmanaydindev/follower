import type { MetadataRoute } from 'next';

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
