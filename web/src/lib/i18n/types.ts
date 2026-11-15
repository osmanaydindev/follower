import type { tr } from './tr';

// The Turkish file is the schema. Any key it has and another language lacks is a
// type error at build time, so a half-translated page can never ship.
export type Dict = typeof tr;

export const LOCALES = ['tr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'tr';

export function isLocale(value: string | undefined): value is Locale {
  return value === 'tr' || value === 'en';
}
