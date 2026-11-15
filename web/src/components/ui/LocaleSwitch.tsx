'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Icon } from './Icon';
import { LOCALES, swapLocale, type Locale } from '@/lib/i18n';
import styles from './IconButton.module.css';

/**
 * Two languages, so this is a toggle rather than a dropdown. The choice is kept
 * in a cookie the middleware reads, so a later visit to `/` lands on the right
 * language without asking again.
 */
export function LocaleSwitch({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const next = (LOCALES.find((l) => l !== locale) ?? locale) as Locale;

  function switchTo() {
    document.cookie = `flang=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.push(swapLocale(pathname, next));
  }

  return (
    <button
      type="button"
      className={styles.button}
      onClick={switchTo}
      aria-label={`${label}: ${next.toUpperCase()}`}
      title={`${label}: ${next.toUpperCase()}`}
    >
      <Icon name="globe" size={18} />
      <span className={styles.label}>{next}</span>
    </button>
  );
}
