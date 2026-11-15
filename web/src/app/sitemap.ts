import type { MetadataRoute } from 'next';
import { href, LOCALES, type RouteName } from '@/lib/i18n';

/*
 * Per request, not per build. SITE_URL is a deployment setting that is only
 * known once the domain exists — baking this at build time produced an empty
 * sitemap on the live site, because the image had been built before there was
 * a domain to put in it.
 */
export const dynamic = 'force-dynamic';

/*
 * `viewers` is deliberately absent. Nothing links to that page any more — the
 * question it answers is one nobody arrives asking, and raising it unprompted
 * only plants a doubt. The page itself stays reachable so old links still work.
 */
const PUBLIC_ROUTES: RouteName[] = ['home', 'install', 'privacy', 'terms', 'deletion'];

/** Only the pages a stranger should land on. The panel is deliberately absent. */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.SITE_URL;
  if (!site) return [];

  return LOCALES.flatMap((locale) =>
    PUBLIC_ROUTES.map((route) => ({
      url: `${site}${href(locale, route)}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: route === 'home' ? 1 : 0.6,
    })),
  );
}
