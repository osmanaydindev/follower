import { NextResponse } from 'next/server';
import { callBackend } from '@/lib/server/backend';
import { clearSession, readSessionId } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

/**
 * Signing out has to delete the server-side record too — the backend persists
 * sessions to disk, so clearing the cookie alone would leave a usable Instagram
 * session lying around. The cookie is cleared regardless of what the backend
 * says: if it is unreachable, the user still gets signed out locally.
 */
export async function POST(): Promise<Response> {
  const sessionId = await readSessionId();
  const res = NextResponse.json({ ok: true });

  if (sessionId) {
    await callBackend<{ ok: boolean }>('/api/logout', {
      method: 'POST',
      body: { sessionId },
      timeoutMs: 15_000,
    });
  }

  clearSession(res);
  return res;
}
