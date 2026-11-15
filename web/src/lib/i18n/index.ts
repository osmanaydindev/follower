import { en } from './en';
import { tr } from './tr';
import { DEFAULT_LOCALE, isLocale, LOCALES, type Dict, type Locale } from './types';

const dicts: Record<Locale, Dict> = { tr, en };

export function dict(locale: Locale): Dict {
  return dicts[locale];
}

/** Resolves an unknown route segment to a supported locale. */
export function toLocale(value: string | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Fills `{name}` placeholders. Deliberately dumb — the dictionary holds whole
 * sentences, so this is the only interpolation the UI ever needs.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/**
 * One route tree, Turkish slugs, locale as the first segment. Translating the
 * slugs too would mean a second set of directories and rewrite rules for no real
 * gain — links are built through `href()`, so nothing hardcodes a path anyway.
 */
const paths = {
  tr: {
    home: '/tr',
    login: '/tr/giris',
    panel: '/tr/panel',
    install: '/tr/kurulum',
    viewers: '/tr/profil-goruntuleme',
    privacy: '/tr/gizlilik',
    terms: '/tr/kosullar',
    deletion: '/tr/veri-silme',
  },
  en: {
    home: '/en',
    login: '/en/giris',
    panel: '/en/panel',
    install: '/en/kurulum',
    viewers: '/en/profil-goruntuleme',
    privacy: '/en/gizlilik',
    terms: '/en/kosullar',
    deletion: '/en/veri-silme',
  },
} as const;

export type RouteName = keyof (typeof paths)['tr'];

export function href(locale: Locale, route: RouteName): string {
  return paths[locale][route];
}

/** The same page in the other language, for the language switcher. */
export function swapLocale(pathname: string, next: Locale): string {
  const rest = pathname.replace(/^\/(tr|en)(?=\/|$)/, '');
  return `/${next}${rest}`;
}

export { DEFAULT_LOCALE, isLocale, LOCALES };
export type { Dict, Locale };
