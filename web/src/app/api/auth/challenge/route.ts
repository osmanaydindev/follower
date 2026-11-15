import { NextResponse, type NextRequest } from 'next/server';
import { callBackend, failResponse } from '@/lib/server/backend';
import { readSessionId, writeSession, writeUsername } from '@/lib/server/session';
import type { LoginResponse, WebLoginResult } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Second step of a password login: Instagram asked for a code (2FA or a
 * checkpoint). The pending session already exists server-side; verifying it
 * replaces the session id, so the cookie is rewritten.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const sessionId = await readSessionId();
  if (!sessionId) {
    return NextResponse.json({ error: 'no session', status: 401 }, { status: 401 });
  }

  let code = '';
  try {
    const body = (await req.json()) as { code?: unknown };
    code = typeof body.code === 'string' ? body.code.trim() : '';
  } catch {
    /* fall through */
  }
  if (!code) return NextResponse.json({ error: 'missing code' }, { status: 400 });

  const result = await callBackend<LoginResponse>('/api/challenge', {
    method: 'POST',
    body: { sessionId, code },
    timeoutMs: 60_000,
  });

  if (!result.ok) return failResponse(result);

  const payload: WebLoginResult = {
    challenge: false,
    username: result.data.username,
    profile: result.data.profile ?? null,
  };

  const res = NextResponse.json(payload);
  writeSession(res, result.data.sessionId, false);
  if (payload.username) writeUsername(res, payload.username);
  return res;
}
