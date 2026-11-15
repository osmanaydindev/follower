import { NextResponse, type NextRequest } from 'next/server';
import { callBackend, failResponse } from '@/lib/server/backend';
import { writeSession, writeUsername } from '@/lib/server/session';
import type { LoginResponse, WebLoginResult } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * The password crosses this handler once and is never written anywhere — not to
 * a log line, not into the response. The backend keeps it in memory only while a
 * challenge is pending (`Session.Password json:"-"`) and drops it after.
 *
 * The session id the backend returns stays here too: it goes straight into an
 * httpOnly cookie, so page JavaScript never holds a credential.
 */
export async function POST(req: NextRequest): Promise<Response> {
  let username = '';
  let password = '';
  try {
    const body = (await req.json()) as { username?: unknown; password?: unknown };
    username = typeof body.username === 'string' ? body.username.trim() : '';
    password = typeof body.password === 'string' ? body.password : '';
  } catch {
    /* fall through to the missing-field check */
  }

  if (!username || !password) {
    return NextResponse.json({ error: 'missing credentials' }, { status: 400 });
  }

  const result = await callBackend<LoginResponse>('/api/login', {
    method: 'POST',
    body: { username, password },
    timeoutMs: 60_000,
  });

  if (!result.ok) return failResponse(result);

  const payload: WebLoginResult = {
    challenge: result.data.challenge,
    username: result.data.username || username,
    profile: result.data.profile ?? null,
  };

  const res = NextResponse.json(payload);
  writeSession(res, result.data.sessionId, result.data.challenge);
  writeUsername(res, payload.username);
  return res;
}
