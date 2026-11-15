import type { MetadataRoute } from 'next';
import { href, LOCALES, type RouteName } from '@/lib/i18n';

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
