import Link from 'next/link';
import { href, type Dict, type Locale } from '@/lib/i18n';
import styles from './Footer.module.css';

export function Footer({ locale, t }: { locale: Locale; t: Dict }) {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.outer}>
      <div className={`page ${styles.inner}`}>
        <div className={styles.brandCol}>
          <p className={styles.brand}>{t.nav.brand}</p>
          <p className={styles.tagline}>{t.footer.tagline}</p>
        </div>

        <nav className={styles.cols} aria-label={t.footer.legal}>
          <div className={styles.col}>
            <p className={styles.colTitle}>{t.footer.product}</p>
            <ul className={styles.list}>
              <li>
                <Link href={href(locale, 'install')}>{t.nav.install}</Link>
              </li>
              <li>
                <Link href={href(locale, 'collect')}>{t.nav.analyze}</Link>
              </li>
            </ul>
          </div>

          <div className={styles.col}>
            <p className={styles.colTitle}>{t.footer.legal}</p>
            <ul className={styles.list}>
              <li>
                <Link href={href(locale, 'privacy')}>{t.footer.privacy}</Link>
              </li>
              <li>
                <Link href={href(locale, 'terms')}>{t.footer.terms}</Link>
              </li>
              <li>
                <Link href={href(locale, 'deletion')}>{t.footer.deletion}</Link>
              </li>
            </ul>
          </div>
        </nav>

        <p className={styles.disclaimer}>{t.footer.disclaimer}</p>
        <p className={styles.rights}>
          © {year} {t.nav.brand}. {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}
