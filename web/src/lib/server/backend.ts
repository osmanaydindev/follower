/**
 * The only place the Go backend is spoken to. The browser never reaches it
 * directly: every call is made from a route handler, which is what lets the
 * session id live in an httpOnly cookie instead of in JavaScript.
 *
 * Status codes are forwarded verbatim, because they carry meaning the UI acts on
 * (`backend/internal/instagram/errors.go`):
 *   401 — the Instagram session is dead, collect again from the browser
 *   403 — the session is waiting on a challenge
 *   429 — Instagram rate-limited us; park, do not retry
 *   502 — our side (or the sidecar) is broken
 */

import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from 'undici';

export const BACKEND_URL = (process.env.BACKEND_URL ?? 'http://127.0.0.1:8080').replace(/\/$/, '');

/**
 * Node's global fetch gives up after five minutes of silence from the server
 * (undici's default `headersTimeout`/`bodyTimeout`), and the Go backend sends
 * nothing until the whole list is collected. On a large account the sidecar's
 * deliberate pagination pauses take longer than that, so the default would kill
 * a perfectly healthy analysis at the five-minute mark.
 *
 * Those timeouts are switched off here; the real bound is the explicit
 * `AbortSignal.timeout` on each call, which is per-endpoint and intentional.
 *
 * undici's own `fetch` is used rather than the global one: a dispatcher from the
 * npm package handed to Node's built-in fetch fails with "invalid
 * onRequestStart method", because the two carry different undici versions.
 * Importing both from the same package keeps them in step.
 */
const dispatcher = new Agent({
  headersTimeout: 0,
  bodyTimeout: 0,
  connectTimeout: 10_000,
  keepAliveTimeout: 30_000,
});

export type BackendOk<T> = { ok: true; status: number; data: T };
export type BackendFail = { ok: false; status: number; error: string };
export type BackendResult<T> = BackendOk<T> | BackendFail;

type CallOptions = {
  method?: 'GET' | 'POST';
  query?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
};

export async function callBackend<T>(
  path: string,
  { method = 'GET', query, body, timeoutMs = 30_000 }: CallOptions = {},
): Promise<BackendResult<T>> {
  const url = new URL(BACKEND_URL + path);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);

  const init: UndiciRequestInit = {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
    dispatcher,
  };

  let res: Awaited<ReturnType<typeof undiciFetch>>;
  try {
    res = await undiciFetch(url, init);
  } catch {
    // Status 0 is the client's signal for "the server could not be reached" —
    // distinct from a rejected session, which must not log the user out.
    return { ok: false, status: 0, error: 'backend unreachable' };
  }

  const text = await res.text();
  if (!res.ok) {
    let message = `request failed (${res.status})`;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      /* non-JSON error body: keep the generic message */
    }
    return { ok: false, status: res.status, error: message };
  }

  try {
    return { ok: true, status: res.status, data: JSON.parse(text) as T };
  } catch {
    return { ok: false, status: 502, error: 'invalid response from backend' };
  }
}

/** Turns a failed backend call into the response the browser receives. */
export function failResponse(fail: BackendFail): Response {
  // A transport failure has no HTTP status; 503 is what the browser should see,
  // and the body keeps `status: 0` so the client can tell the two apart.
  const httpStatus = fail.status === 0 ? 503 : fail.status;
  return Response.json({ error: fail.error, status: fail.status }, { status: httpStatus });
}
