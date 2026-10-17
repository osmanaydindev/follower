import { API_URL } from './config';
import type { Analysis, LoginResponse, Profile, User, UserDetail, WebSession } from './types';

// ApiError carries the HTTP status so callers can tell "this session is dead"
// (401/403 → log out) from "the backend isn't reachable" (status 0 → keep the
// session, it's the network's fault, not the login's).
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Instagram is rate-limiting us (the backend forwards the sidecar's 429). The
// only correct reaction is to stop asking for a while — retrying is what keeps
// the limit alive.
export function isThrottled(e: unknown): e is ApiError {
  return e instanceof ApiError && e.status === 429;
}

// How long to sit still after a throttle. Instagram doesn't tell us, so this is
// our own conservative guess, matching the wait the message suggests.
export const THROTTLE_COOLDOWN_MS = 15 * 60 * 1000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(
      `Sunucuya ulaşılamadı (${API_URL}). Backend çalışıyor mu ve aynı ağda mısın?`,
      0,
    );
  }
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // Not JSON (e.g. a plain 404 page from an old backend build).
    if (!res.ok) throw new ApiError(`İstek başarısız (${res.status})`, res.status);
  }
  if (!res.ok) {
    throw new ApiError(data?.error ?? `İstek başarısız (${res.status})`, res.status);
  }
  return data as T;
}

export const api = {
  login(username: string, password: string) {
    return request<LoginResponse>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  // Robust path: authenticate with the cookies captured from the in-app Instagram
  // browser login (see WebViewLoginScreen). The whole jar and the WebView's
  // User-Agent go with it — Instagram checks that a session keeps being used by
  // the browser it was issued to.
  loginSessionId(web: WebSession) {
    return request<LoginResponse>('/api/login_sessionid', {
      method: 'POST',
      body: JSON.stringify(web),
    });
  },

  challenge(sessionId: string, code: string) {
    return request<LoginResponse>('/api/challenge', {
      method: 'POST',
      body: JSON.stringify({ sessionId, code }),
    });
  },

  logout(sessionId: string) {
    return request<{ ok: boolean }>('/api/logout', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  },

  profile(sessionId: string) {
    return request<Profile>(`/api/profile?sessionId=${encodeURIComponent(sessionId)}`);
  },

  analysis(sessionId: string) {
    return request<Analysis>(`/api/analysis?sessionId=${encodeURIComponent(sessionId)}`);
  },

  // Hand the backend lists the app collected itself, inside the Instagram
  // WebView, and get the same analysis back. No Instagram request happens on the
  // server for this call — it only diffs against the stored snapshot.
  ingest(sessionId: string, followers: User[], following: User[]) {
    return request<Analysis>('/api/ingest', {
      method: 'POST',
      body: JSON.stringify({ sessionId, followers, following }),
    });
  },

  followers(sessionId: string) {
    return request<User[]>(`/api/followers?sessionId=${encodeURIComponent(sessionId)}`);
  },

  following(sessionId: string) {
    return request<User[]>(`/api/following?sessionId=${encodeURIComponent(sessionId)}`);
  },

  // One account's counts + a fresh picture URL. Called per visible list row, so
  // it stays one private-API request per account the user actually looks at.
  userDetail(sessionId: string, pk: string) {
    return request<UserDetail>(
      `/api/user-detail?sessionId=${encodeURIComponent(sessionId)}&pk=${encodeURIComponent(pk)}`,
    );
  },

  // Stop following them.
  unfollow(sessionId: string, pk: string) {
    return request<{ ok: boolean }>('/api/unfollow', {
      method: 'POST',
      body: JSON.stringify({ sessionId, pk }),
    });
  },

  // Remove them from my followers.
  removeFollower(sessionId: string, pk: string) {
    return request<{ ok: boolean }>('/api/remove-follower', {
      method: 'POST',
      body: JSON.stringify({ sessionId, pk }),
    });
  },
};
