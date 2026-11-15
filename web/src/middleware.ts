import { NextResponse, type NextRequest } from 'next/server';

const LOCALES = ['tr', 'en'] as const;
const DEFAULT_LOCALE = 'tr';
const COOKIE = 'flang';

/**
 * Everything user-facing lives under /tr or /en. A bare path picks a locale once
 * — from the cookie the switcher writes, otherwise from Accept-Language — and
 * redirects. API routes and static assets are left alone.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE)?.value;
  const chosen =
    LOCALES.find((l) => l === cookie) ?? pickFromHeader(req.headers.get('accept-language'));

  const url = req.nextUrl.clone();
  url.pathname = `/${chosen}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url);
}

function pickFromHeader(header: string | null): (typeof LOCALES)[number] {
  if (!header) return DEFAULT_LOCALE;
  // "tr-TR,tr;q=0.9,en;q=0.8" -> first supported tag wins.
  for (const part of header.split(',')) {
    const tag = part.split(';')[0]?.trim().toLowerCase() ?? '';
    const base = tag.split('-')[0];
    const hit = LOCALES.find((l) => l === base);
    if (hit) return hit;
  }
  return DEFAULT_LOCALE;
}

export const config = {
  // Skip API routes, build output, and anything that looks like a file (a dot in
  // the last segment). Without the file rule, /offline.html and /sw.js would be
  // redirected to /tr/offline.html — which is a 404, and would make the service
  // worker's install step fail silently.
  matcher: ['/((?!api/|_next/|.*\\.[^/]+$).*)'],
};
