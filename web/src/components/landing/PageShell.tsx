import { Footer } from './Footer';
import { Nav } from './Nav';
import { readPending, readSessionId } from '@/lib/server/session';
import type { Dict, Locale } from '@/lib/i18n';
import styles from './PageShell.module.css';

export async function isSignedIn(): Promise<boolean> {
  return Boolean(await readSessionId()) && !(await readPending());
}

/** Nav + prose column + footer, shared by every content page. */
export async function PageShell({
  locale,
  t,
  children,
  wide = false,
}: {
  locale: Locale;
  t: Dict;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const signedIn = await isSignedIn();

  return (
    <>
      <Nav locale={locale} t={t} signedIn={signedIn} />
      <main id="main" className={wide ? undefined : `page ${styles.main}`}>
        {children}
      </main>
      <Footer locale={locale} t={t} />
    </>
  );
}
