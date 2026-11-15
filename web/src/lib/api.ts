import type { Analysis, Profile, User, UserDetail, WebLoginResult } from './types';

/**
 * The browser only ever talks to our own origin. `/api/ig/*` and `/api/auth/*`
 * are route handlers that attach the session cookie server-side and forward to
 * the Go backend, so nothing here carries a credential.
 *
 * Status semantics are the backend's, deliberately identical to the mobile
 * client (`mobile/src/api.ts`):
 *   0   — server unreachable; keep the session, this is not a rejection
 *   401 — Instagram session dead -> sign in again
 *   403 — session is waiting on a challenge
 *   429 — rate-limited -> park for THROTTLE_COOLDOWN_MS, never retry
 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function isThrottled(e: unknown): e is ApiError {
  return e instanceof ApiError && e.status === 429;
}

export function isSessionDead(e: unknown): e is ApiError {
  return e instanceof ApiError && (e.status === 401 || e.status === 403);
}

export function isOffline(e: unknown): e is ApiError {
  return e instanceof ApiError && e.status === 0;
}

export const THROTTLE_COOLDOWN_MS = 15 * 60 * 1000;

type RequestInitLite = {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
};

async function request<T>(path: string, init: RequestInitLite = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? 'GET',
      headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
      credentials: 'same-origin',
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError('network', 0);
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    const parsed = (data ?? {}) as { error?: string; status?: number };
    // The proxy reports an unreachable backend as HTTP 503 with status 0 in the
    // body — that distinction is what stops a dead backend from logging the
    // user out.
    const status = typeof parsed.status === 'number' ? parsed.status : res.status;
    throw new ApiError(parsed.error ?? `request failed (${res.status})`, status);
  }

  return data as T;
}

export const api = {
  login(username: string, password: string) {
    return request<WebLoginResult>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    });
  },
  challenge(code: string) {
    return request<WebLoginResult>('/api/auth/challenge', { method: 'POST', body: { code } });
  },
  logout() {
    return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
  },

  profile(signal?: AbortSignal) {
    return request<Profile>('/api/ig/profile', { signal });
  },
  followers(signal?: AbortSignal) {
    return request<User[]>('/api/ig/followers', { signal });
  },
  following(signal?: AbortSignal) {
    return request<User[]>('/api/ig/following', { signal });
  },
  /** Diff + snapshot of lists the client already holds. No Instagram request. */
  ingest(followers: User[], following: User[], signal?: AbortSignal) {
    return request<Analysis>('/api/ig/ingest', {
      method: 'POST',
      body: { followers, following },
      signal,
    });
  },
  /** One-shot fallback: the backend fetches both lists itself. */
  analysis(signal?: AbortSignal) {
    return request<Analysis>('/api/ig/analysis', { signal });
  },

  userDetail(pk: string, signal?: AbortSignal) {
    return request<UserDetail>(`/api/ig/user-detail?pk=${encodeURIComponent(pk)}`, { signal });
  },
  unfollow(pk: string) {
    return request<{ ok: boolean }>('/api/ig/unfollow', { method: 'POST', body: { pk } });
  },
  removeFollower(pk: string) {
    return request<{ ok: boolean }>('/api/ig/remove-follower', { method: 'POST', body: { pk } });
  },
  snapshotForget(pk: string) {
    return request<{ ok: boolean }>('/api/ig/snapshot-forget', { method: 'POST', body: { pk } });
  },
};
