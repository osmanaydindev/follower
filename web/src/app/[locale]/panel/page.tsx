import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PanelClient } from '@/components/app/PanelClient';
import { callBackend } from '@/lib/server/backend';
import { readPending, readSessionId, readUsername } from '@/lib/server/session';
import { dict, href, toLocale } from '@/lib/i18n';
import type { Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const t = dict(toLocale((await params).locale));
  // Someone's follower data: never indexed.
  return { title: t.meta.panelTitle, robots: { index: false, follow: false } };
}

export default async function PanelPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const sessionId = await readSessionId();
  if (!sessionId) redirect(href(locale, 'login'));
  if (await readPending()) redirect(href(locale, 'login'));

  // Rendering with the real profile avoids a loading flash. A rejected session
  // sends the user back to sign in; an unreachable backend does NOT — a server
  // that is merely down must never cost someone a working session, because
  // signing in again is the riskiest thing this app does.
  const result = await callBackend<Profile>('/api/profile', {
    query: { sessionId: sessionId! },
    timeoutMs: 20_000,
  });

  // Via the route handler, so the dead cookie is actually deleted — redirecting
  // straight to the sign-in page would leave it in place and bounce back here.
  if (!result.ok && (result.status === 401 || result.status === 403)) {
    redirect(`/api/auth/expired?locale=${locale}`);
  }

  const profile = result.ok ? result.data : null;

  return (
    <PanelClient
      locale={locale}
      t={dict(locale)}
      profile={profile}
      username={profile?.username ?? (await readUsername())}
      backendDown={!result.ok}
    />
  );
}
