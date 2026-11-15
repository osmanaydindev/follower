import type { Locale } from './i18n';

/** Thousands separator per locale: 12.345 in Turkish, 12,345 in English. */
export function fmtNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-GB').format(n);
}

/**
 * Short counts for the tight row under a username. Turkish uses B for "bin"
 * (thousand) and a comma as the decimal separator, so this cannot be a single
 * formatter for both languages.
 */
export function fmtCompact(n: number, locale: Locale): string {
  const unit = locale === 'tr' ? { k: 'B', m: 'M' } : { k: 'K', m: 'M' };
  const dec = locale === 'tr' ? ',' : '.';
  const trim = (s: string) => s.replace(/\.0$/, '').replace('.', dec);
  if (n >= 1_000_000) return trim((n / 1_000_000).toFixed(1)) + unit.m;
  if (n >= 10_000) return String(Math.round(n / 1000)) + unit.k;
  if (n >= 1_000) return trim((n / 1000).toFixed(1)) + unit.k;
  return String(n);
}

export function fmtDateTime(ms: number, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

export function minutesLeft(until: number): number {
  return Math.max(1, Math.ceil((until - Date.now()) / 60_000));
}
