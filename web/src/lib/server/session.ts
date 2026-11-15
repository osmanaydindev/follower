import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

export const SESSION_COOKIE = 'fsid';
export const PENDING_COOKIE = 'fpend';
export const USER_COOKIE = 'fuser';
export const MODE_COOKIE = 'fmode';
export const LANG_COOKIE = 'flang';

// Matches the backend's own session TTL (`session.Store`, 60 days) — a cookie
// that outlives the server-side record would just produce a confusing 401.
const MAX_AGE = 60 * 24 * 60 * 60;

/**
 * `Secure` is driven by env, not by NODE_ENV: the first deployment runs on a
 * plain http://IP:port address (no domain yet), and a Secure cookie would never
 * be sent back — the user would appear signed out forever. Flip COOKIE_SECURE to
 * true the moment the certificate is in place.
 */
function secure(): boolean {
  return process.env.COOKIE_SECURE === 'true';
}

export type CookieWriter = Pick<NextResponse, 'cookies'>;

export function writeSession(res: CookieWriter, sessionId: string, pending: boolean): void {
  res.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secure(),
    path: '/',
    maxAge: MAX_AGE,
  });
  if (pending) {
    // Readable by the client on purpose: it only says "a code is being awaited",
    // which the login page needs in order to render the right step after a
    // reload. It grants nothing on its own.
    res.cookies.set(PENDING_COOKIE, '1', {
      httpOnly: false,
      sameSite: 'lax',
      secure: secure(),
      path: '/',
      maxAge: 60 * 30,
    });
  } else {
    clearPending(res);
  }
}

/**
 * The username is not a credential, so it stays readable. It gives the panel an
 * identity even when the backend is unreachable — which is what keeps a cached
 * analysis on screen during an outage instead of an empty page.
 */
export function writeUsername(res: CookieWriter, username: string): void {
  res.cookies.set(USER_COOKIE, username, {
    httpOnly: false,
    sameSite: 'lax',
    secure: secure(),
    path: '/',
    maxAge: MAX_AGE,
  });
}

/**
 * Marks the session as collector-made: it carries no Instagram credential, so
 * anything that would call Instagram (per-row counts, unfollowing, a re-analysis
 * from the server) is not available and the panel must say so rather than
 * offering buttons that cannot work.
 */
export function writeCollectMode(res: CookieWriter): void {
  res.cookies.set(MODE_COOKIE, 'collect', {
    httpOnly: true,
    sameSite: 'lax',
    secure: secure(),
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function readCollectMode(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(MODE_COOKIE)?.value === 'collect';
}

export function clearPending(res: CookieWriter): void {
  res.cookies.set(PENDING_COOKIE, '', { path: '/', maxAge: 0 });
}

export function clearSession(res: CookieWriter): void {
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0, httpOnly: true });
  res.cookies.set(USER_COOKIE, '', { path: '/', maxAge: 0 });
  res.cookies.set(MODE_COOKIE, '', { path: '/', maxAge: 0 });
  clearPending(res);
}

/** Server components and route handlers read the session through this. */
export async function readSessionId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export async function readPending(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(PENDING_COOKIE)?.value === '1';
}

export async function readUsername(): Promise<string> {
  const jar = await cookies();
  return jar.get(USER_COOKIE)?.value ?? '';
}
