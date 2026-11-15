import type { Metadata } from 'next';
import { InstallGuide } from '@/components/landing/InstallGuide';
import { PageShell } from '@/components/landing/PageShell';
import { dict, toLocale } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const t = dict(toLocale((await params).locale));
  return { title: t.install.title, description: t.install.subtitle };
}

/** The same guide as on the home page, on its own URL so it can be linked to. */
export default async function InstallPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = dict(locale);

  return (
    <PageShell locale={locale} t={t} wide>
      <InstallGuide t={t} />
    </PageShell>
  );
}
