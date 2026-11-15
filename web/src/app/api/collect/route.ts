import { NextResponse, type NextRequest } from 'next/server';
import { callBackend, failResponse } from '@/lib/server/backend';
import {
  readCollectMode,
  readSessionId,
  readUsername,
  writeCollectMode,
  writeSession,
  writeUsername,
} from '@/lib/server/session';
import type { Analysis, User } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Where the browser collector's lists land.
 *
 * The request is same-origin: the collector runs on instagram.com and cannot
 * reach us directly (their `connect-src` excludes our origin), so it hands the
 * lists to our own page over postMessage and that page posts them here.
 *
 * No Instagram credential is involved anywhere on this path. We open a session
 * that carries only the account name — the key the follower snapshot is stored
 * under — and run the same diff the app has always run.
 */

/** The lists arrive from a page we do not control, so nothing is trusted. */
function sanitize(input: unknown, cap = 50_000): User[] {
  if (!Array.isArray(input)) return [];
  const out: User[] = [];
  for (const raw of input.slice(0, cap)) {
    if (!raw || typeof raw !== 'object') continue;
    const u = raw as Record<string, unknown>;
    const pk = typeof u.pk === 'string' ? u.pk : String(u.pk ?? '');
    const username = typeof u.username === 'string' ? u.username : '';
    if (!pk || !username) continue;
    out.push({
      pk: pk.slice(0, 32),
      username: username.slice(0, 64),
      fullName: typeof u.fullName === 'string' ? u.fullName.slice(0, 128) : '',
      isPrivate: Boolean(u.isPrivate),
      isVerified: Boolean(u.isVerified),
      // Instagram CDN URLs are signed and commonly exceed 512 characters.
      // Truncating them turns a valid picture into a guaranteed 403.
      profilePicUrl: typeof u.profilePicUrl === 'string' ? u.profilePicUrl.slice(0, 4096) : '',
    });
  }
  return out;
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'gecersiz govde' }, { status: 400 });
  }

  const username = (typeof body.username === 'string' ? body.username : '').trim().slice(0, 64);
  const followers = sanitize(body.followers);
  const following = sanitize(body.following);

  if (!username) {
    return NextResponse.json({ error: 'kullanici adi gerekli' }, { status: 400 });
  }
  // An empty collection is a failed collection, not an empty account. Storing
  // it would wipe the snapshot and report everyone as having unfollowed next
  // time. The backend rejects it too; failing here keeps the message specific.
  if (followers.length === 0 && following.length === 0) {
    return NextResponse.json({ error: 'bos liste kaydedilmez' }, { status: 400 });
  }

  // Reuse only a collector session for this exact account. A website cookie
  // can outlive an Instagram account switch in another tab; reusing it would
  // attach the new lists to the wrong account's snapshot.
  const [currentId, currentMode, currentUsername] = await Promise.all([
    readSessionId(),
    readCollectMode(),
    readUsername(),
  ]);
  let sessionId =
    currentMode && currentUsername.toLowerCase() === username.toLowerCase() ? currentId : undefined;
  let fresh = false;
  if (!sessionId) {
    const created = await callBackend<{ sessionId: string; username: string }>(
      '/api/collect-session',
      { method: 'POST', body: { username }, timeoutMs: 15_000 },
    );
    if (!created.ok) return failResponse(created);
    sessionId = created.data.sessionId;
    fresh = true;
  }

  const result = await callBackend<Analysis>('/api/ingest', {
    method: 'POST',
    body: { sessionId, followers, following },
    timeoutMs: 120_000,
  });

  // A session the backend no longer knows (restart, expiry) — open a new one
  // and try once more rather than making the user collect all over again.
  if (!result.ok && result.status === 401 && !fresh) {
    const created = await callBackend<{ sessionId: string }>('/api/collect-session', {
      method: 'POST',
      body: { username },
      timeoutMs: 15_000,
    });
    if (!created.ok) return failResponse(created);
    const retry = await callBackend<Analysis>('/api/ingest', {
      method: 'POST',
      body: { sessionId: created.data.sessionId, followers, following },
      timeoutMs: 120_000,
    });
    if (!retry.ok) return failResponse(retry);
    const res = NextResponse.json(retry.data);
    writeSession(res, created.data.sessionId, false);
    writeUsername(res, username);
    writeCollectMode(res);
    return res;
  }

  if (!result.ok) return failResponse(result);

  const res = NextResponse.json(result.data);
  writeSession(res, sessionId, false);
  writeUsername(res, username);
  writeCollectMode(res);
  return res;
}
