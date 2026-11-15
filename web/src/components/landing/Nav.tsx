import Link from 'next/link';
import { LinkButton } from '../ui/Button';
import { LocaleSwitch } from '../ui/LocaleSwitch';
import { ThemeToggle } from '../ui/ThemeToggle';
import { href, type Dict, type Locale } from '@/lib/i18n';
import styles from './Nav.module.css';

/**
 * No hamburger: four in-page anchors do not justify a menu that hides them. On a
 * narrow screen the links drop away and the sections are simply scrolled to.
 */
export function Nav({ locale, t, signedIn }: { locale: Locale; t: Dict; signedIn: boolean }) {
  return (
    <header className={styles.bar}>
      <nav className={`page ${styles.inner}`} aria-label={t.nav.brand}>
        <Link href={href(locale, 'home')} className={styles.brand}>
          {t.nav.brand}
        </Link>

        <ul className={styles.links}>
          <li>
            <a href="#what">{t.nav.what}</a>
          </li>
          <li>
            <a href="#trust">{t.nav.trust}</a>
          </li>
          <li>
            <a href="#install">{t.nav.install}</a>
          </li>
          <li>
            <a href="#faq">{t.nav.faq}</a>
          </li>
        </ul>

        <div className={styles.actions}>
          <LocaleSwitch locale={locale} label={t.common.language} />
          <ThemeToggle
            label={t.common.theme}
            lightLabel={t.common.themeLight}
            darkLabel={t.common.themeDark}
          />
          <LinkButton href={href(locale, signedIn ? 'panel' : 'login')} size="sm">
            {signedIn ? t.nav.panel : t.nav.analyze}
          </LinkButton>
        </div>
      </nav>
    </header>
  );
}
