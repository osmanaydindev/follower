import { NextResponse, type NextRequest } from 'next/server';
import { callBackend, failResponse } from '@/lib/server/backend';
import { readSessionId } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

type Spec = {
  method: 'GET' | 'POST';
  backendPath: string;
  /** Where the backend expects the session id: query string (GET) or body (POST). */
  auth: 'query' | 'body';
  timeoutMs: number;
  /** Query parameters forwarded from the incoming request. */
  forwardQuery?: string[];
  /** Body keys forwarded from the incoming request; anything else is dropped. */
  forwardBody?: string[];
};

/*
 * A whitelist, not a pass-through. Anything not listed here 404s, so this route
 * can never be used to reach an unintended backend path.
 *
 * Note the field-name trap in the backend: every endpoint takes `sessionId`
 * except POST /api/login_sessionid, which takes all-lowercase `sessionid`. That
 * one is not proxied (the WebView hand-off has no browser equivalent), so every
 * entry below uses `sessionId`.
 */
const ENDPOINTS: Record<string, Spec> = {
  profile: { method: 'GET', backendPath: '/api/profile', auth: 'query', timeoutMs: 30_000 },

  // The list calls can legitimately take minutes: the sidecar paginates with
  // deliberate pauses so the account does not get flagged. The Go side allows
  // 10 minutes, so this must not be shorter. Behind nginx this also needs
  // `proxy_read_timeout 900s`, or the proxy cuts it at 60 seconds.
  followers: { method: 'GET', backendPath: '/api/followers', auth: 'query', timeoutMs: 600_000 },
  following: { method: 'GET', backendPath: '/api/following', auth: 'query', timeoutMs: 600_000 },
  analysis: { method: 'GET', backendPath: '/api/analysis', auth: 'query', timeoutMs: 600_000 },

  'user-detail': {
    method: 'GET',
    backendPath: '/api/user-detail',
    auth: 'query',
    timeoutMs: 60_000,
    forwardQuery: ['pk'],
  },

  // Diff + snapshot only; this one makes no Instagram request at all.
  ingest: {
    method: 'POST',
    backendPath: '/api/ingest',
    auth: 'body',
    timeoutMs: 120_000,
    forwardBody: ['followers', 'following'],
  },

  unfollow: {
    method: 'POST',
    backendPath: '/api/unfollow',
    auth: 'body',
    timeoutMs: 60_000,
    forwardBody: ['pk'],
  },
  'remove-follower': {
    method: 'POST',
    backendPath: '/api/remove-follower',
    auth: 'body',
    timeoutMs: 60_000,
    forwardBody: ['pk'],
  },
  'snapshot-forget': {
    method: 'POST',
    backendPath: '/api/snapshot-forget',
    auth: 'body',
    timeoutMs: 30_000,
    forwardBody: ['pk'],
  },
};

async function handle(
  req: NextRequest,
  params: Promise<{ path: string[] }>,
  method: 'GET' | 'POST',
): Promise<Response> {
  const { path } = await params;
  const key = path.join('/');
  const spec = ENDPOINTS[key];
  if (!spec || spec.method !== method) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const sessionId = await readSessionId();
  if (!sessionId) {
    return NextResponse.json({ error: 'no session', status: 401 }, { status: 401 });
  }

  const query: Record<string, string> = {};
  if (spec.auth === 'query') query.sessionId = sessionId;
  for (const name of spec.forwardQuery ?? []) {
    const value = req.nextUrl.searchParams.get(name);
    if (value !== null) query[name] = value;
  }

  let body: Record<string, unknown> | undefined;
  if (method === 'POST') {
    let incoming: Record<string, unknown> = {};
    try {
      incoming = (await req.json()) as Record<string, unknown>;
    } catch {
      incoming = {};
    }
    body = {};
    if (spec.auth === 'body') body.sessionId = sessionId;
    for (const name of spec.forwardBody ?? []) {
      if (name in incoming) body[name] = incoming[name];
    }
  }

  const result = await callBackend<unknown>(spec.backendPath, {
    method: spec.method,
    query,
    body,
    timeoutMs: spec.timeoutMs,
  });

  if (!result.ok) return failResponse(result);
  return NextResponse.json(result.data);
}

export function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, ctx.params, 'GET');
}

export function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, ctx.params, 'POST');
}
