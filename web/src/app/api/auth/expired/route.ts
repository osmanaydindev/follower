import { NextResponse, type NextRequest } from 'next/server';
import { clearSession } from '@/lib/server/session';
import { href, toLocale } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/**
 * Where a rejected session is sent. The cookie has to be *deleted*, not merely
 * ignored: the panel redirects to collection when the backend returns 401, and
 * the collection page redirects an already-signed-in visitor to the panel — so leaving
 * a dead cookie in place bounces the two off each other forever and the user
 * sees a blank page with no way out.
 *
 * A server component cannot clear a cookie while rendering, which is why this
 * is a route handler.
 */
export function GET(req: NextRequest): Response {
  const locale = toLocale(req.nextUrl.searchParams.get('locale') ?? undefined);

  // A relative Location rather than NextResponse.redirect(): behind nginx the
  // request's own origin is the internal one, and rebuilding an absolute URL
  // from it would bounce the user to http://localhost:3000 — or downgrade https
  // to http, which a Secure cookie would not survive.
  const res = new NextResponse(null, {
    status: 307,
    headers: { Location: `${href(locale, 'collect')}?expired=1` },
  });
  clearSession(res);
  return res;
}
