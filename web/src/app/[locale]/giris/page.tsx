import { redirect } from 'next/navigation';
import { href, toLocale } from '@/lib/i18n';

/**
 * Kept for bookmarks and links from the former password-login flow.
 * Collection now happens in the user's signed-in Instagram browser, so the
 * old address has one canonical successor rather than a dead end.
 */
export default async function LegacyLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  redirect(href(toLocale((await params).locale), 'collect'));
}
