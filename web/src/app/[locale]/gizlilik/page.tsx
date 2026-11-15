import type { Metadata } from 'next';
import { PageShell } from '@/components/landing/PageShell';
import { ProseDoc } from '@/components/landing/Prose';
import { dict, toLocale } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return { title: dict(toLocale((await params).locale)).privacy.title };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = dict(locale);

  return (
    <PageShell locale={locale} t={t}>
      <ProseDoc title={t.privacy.title} updated={t.privacy.updated} sections={t.privacy.sections} />
    </PageShell>
  );
}
