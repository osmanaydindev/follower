import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { CollectClient } from '@/components/app/CollectClient';
import { PageShell } from '@/components/landing/PageShell';
import { dict, toLocale } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const t = dict(toLocale((await params).locale));
  return { title: t.collect.title, robots: { index: false, follow: false } };
}

/**
 * The bookmarklet has to carry an absolute URL back to us, and the deployment
 * may be reached by more than one name. Prefer the configured SITE_URL and fall
 * back to the host the request actually arrived on.
 */
async function siteOrigin(): Promise<string> {
  const configured = process.env.SITE_URL?.replace(/\/$/, '');
  if (configured) return configured;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export default async function CollectPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  return (
    <PageShell locale={locale} t={dict(locale)}>
      <CollectClient locale={locale} t={dict(locale)} origin={await siteOrigin()} />
    </PageShell>
  );
}
