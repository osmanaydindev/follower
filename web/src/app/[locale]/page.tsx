import { Faq } from '@/components/landing/Faq';
import { Features } from '@/components/landing/Features';
import { Footer } from '@/components/landing/Footer';
import { Hero } from '@/components/landing/Hero';
import { InstallGuide } from '@/components/landing/InstallGuide';
import { Nav } from '@/components/landing/Nav';
import { TrustSection } from '@/components/landing/TrustSection';
import { readPending, readSessionId } from '@/lib/server/session';
import { dict, toLocale } from '@/lib/i18n';

// The page is static apart from one bit: whether the visitor is already signed
// in, which decides where the call to action points.
export const dynamic = 'force-dynamic';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = dict(locale);
  const signedIn = Boolean(await readSessionId()) && !(await readPending());

  return (
    <>
      <Nav locale={locale} t={t} signedIn={signedIn} />
      <main id="main">
        <Hero locale={locale} t={t} signedIn={signedIn} />
        <Features t={t} />
        <TrustSection locale={locale} t={t} />
        <InstallGuide t={t} />
        <Faq t={t} />
      </main>
      <Footer locale={locale} t={t} />
    </>
  );
}
