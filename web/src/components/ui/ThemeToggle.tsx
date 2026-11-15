'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { THEME_KEY } from './ThemeScript';
import styles from './IconButton.module.css';

type Theme = 'light' | 'dark';

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Flips between light and dark by stamping `data-theme` on <html>, which the
 * token file lets win over `prefers-color-scheme` in both directions. Until the
 * user touches this, nothing is stamped and the system preference rules.
 */
export function ThemeToggle({ label, lightLabel, darkLabel }: { label: string; lightLabel: string; darkLabel: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    setTheme(stored === 'light' || stored === 'dark' ? stored : systemTheme());
  }, []);

  function toggle() {
    const next: Theme = (theme ?? systemTheme()) === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.style.colorScheme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* private mode: the choice simply does not persist */
    }
  }

  // Before the effect runs we do not know the theme; render a stable neutral
  // icon rather than guessing and flipping on hydration.
  const next = theme === 'dark' ? lightLabel : darkLabel;

  return (
    <button
      type="button"
      className={styles.button}
      onClick={toggle}
      aria-label={theme ? next : label}
      title={theme ? next : label}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} />
    </button>
  );
}
