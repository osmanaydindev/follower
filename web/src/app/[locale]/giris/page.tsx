import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/app/LoginForm';
import { Icon } from '@/components/ui/Icon';
import { readPending, readSessionId } from '@/lib/server/session';
import { dict, href, toLocale } from '@/lib/i18n';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const t = dict(toLocale((await params).locale));
  return { title: t.meta.loginTitle, robots: { index: false, follow: false } };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ expired?: string }>;
}) {
  const locale = toLocale((await params).locale);
  const t = dict(locale);
  const { expired } = await searchParams;

  const sessionId = await readSessionId();
  const pending = await readPending();
  // An already-signed-in visitor has no business on this page; signing in again
  // is the single riskiest thing the app does. `expired` is the exception and
  // must stay one: it means the panel just rejected this session, so bouncing
  // back there would loop.
  if (sessionId && !pending && expired !== '1') redirect(href(locale, 'panel'));

  return (
    <main id="main" className={styles.main}>
      <Link href={href(locale, 'home')} className={styles.back}>
        <Icon name="arrowLeft" size={17} />
        <span>{t.nav.brand}</span>
      </Link>
      <LoginForm
        locale={locale}
        t={t}
        initialStep={pending ? 'challenge' : 'credentials'}
        expired={expired === '1'}
      />
    </main>
  );
}
