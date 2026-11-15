import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/landing/PageShell';
import { Icon } from '@/components/ui/Icon';
import { dict, href, toLocale } from '@/lib/i18n';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const t = dict(toLocale((await params).locale));
  return { title: t.viewers.title, description: t.viewers.lead };
}

/**
 * The one feature this app will never have. Every competitor claims it, so
 * saying plainly why it is impossible does more for trust than any feature
 * could.
 */
export default async function ViewersPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = dict(locale);

  return (
    <PageShell locale={locale} t={t}>
      <article className={styles.doc}>
        <span className={styles.icon}>
          <Icon name="eyeOff" size={26} strokeWidth={1.7} />
        </span>
        <h1>{t.viewers.title}</h1>
        <p className={styles.lead}>{t.viewers.lead}</p>

        {t.viewers.body.map((paragraph) => (
          <p key={paragraph} className={styles.paragraph}>
            {paragraph}
          </p>
        ))}

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{t.viewers.listTitle}</h2>
          <ul className={styles.list}>
            {t.viewers.list.map((item) => (
              <li key={item}>
                <Icon name="close" size={15} strokeWidth={2.2} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <Link className={styles.back} href={href(locale, 'home')}>
          <Icon name="arrowLeft" size={16} strokeWidth={2} />
          <span>{t.viewers.back}</span>
        </Link>
      </article>
    </PageShell>
  );
}
