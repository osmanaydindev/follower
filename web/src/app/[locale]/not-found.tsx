import Link from 'next/link';
import { dict, href, DEFAULT_LOCALE } from '@/lib/i18n';
import styles from './not-found.module.css';

/**
 * The middleware sends every unmatched path through a locale segment, so this is
 * what a wrong URL actually hits. It cannot read params (Next renders not-found
 * outside the segment), so it answers in the default language.
 */
export default function NotFound() {
  const t = dict(DEFAULT_LOCALE);

  return (
    <main id="main" className={styles.main}>
      <h1 className={styles.title}>{t.notFound.title}</h1>
      <p className={styles.body}>{t.notFound.body}</p>
      <Link className={styles.link} href={href(DEFAULT_LOCALE, 'home')}>
        {t.notFound.home}
      </Link>
    </main>
  );
}
