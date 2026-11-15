import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { dict, isLocale, LOCALES, type Locale } from '@/lib/i18n';
import { ThemeScript } from '@/components/ui/ThemeScript';
import { ServiceWorker } from '@/components/ui/ServiceWorker';
import '@/styles/globals.css';

/*
 * Fonts live in public/fonts and are declared in styles/fonts.css. They used to
 * come through next/font/google, which fetches them during `next build` — that
 * made an external service a build dependency, and a flaky response from it
 * failed CI and held up an unrelated deploy. See web/CLAUDE.md.
 *
 * Newsreader (serif) carries the headlines and nothing else. A single serif
 * voice at display size is what keeps the page from reading like a template.
 */

// This is the root layout: the locale is the first segment, so <html lang> can
// only be correct if the element itself lives inside the dynamic segment.
export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = dict(locale);
  const site = process.env.SITE_URL;

  return {
    title: { default: t.meta.title, template: `%s · ${t.nav.brand}` },
    description: t.meta.description,
    applicationName: t.nav.brand,
    ...(site ? { metadataBase: new URL(site) } : {}),
    alternates: {
      canonical: `/${locale}`,
      languages: { tr: '/tr', en: '/en' },
    },
    openGraph: {
      type: 'website',
      locale: t.localeTag,
      title: t.meta.title,
      description: t.meta.description,
      siteName: t.nav.brand,
    },
    appleWebApp: { capable: true, title: t.nav.brand, statusBarStyle: 'default' },
    manifest: '/manifest.webmanifest',
    icons: {
      icon: [
        { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      ],
      apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
    },
    // Honest tool, but the panel holds personal data — keep crawlers off it via
    // the per-page metadata there; the marketing pages are indexable.
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // viewportFit lets the page paint under the notch; safe-area insets are used
  // where it matters (the sticky top bar and the panel's bottom padding).
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f6f8' },
    { media: '(prefers-color-scheme: dark)', color: '#0e0e11' },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = dict(locale as Locale);

  return (
    <html lang={t.htmlLang} suppressHydrationWarning>
      <head>
        {/* The two faces above the fold. Without this the browser only
            discovers them after the stylesheet parses, and the headline
            visibly reflows. */}
        <link
          rel="preload"
          href="/fonts/plus-jakarta-sans-normal-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/newsreader-normal-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <ThemeScript />
        <a className="skipLink" href="#main">
          {t.common.skipToContent}
        </a>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
