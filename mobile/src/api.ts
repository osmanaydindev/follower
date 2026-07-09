import { API_URL } from './config';
import type { Analysis, LoginResponse, Profile, User } from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error(
      `Sunucuya ulaşılamadı (${API_URL}). Backend çalışıyor mu ve aynı ağda mısın?`,
    );
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(data?.error ?? `İstek başarısız (${res.status})`);
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

  // Robust path: authenticate with a sessionid cookie captured from the in-app
  // Instagram browser login (see WebViewLoginScreen).
  loginSessionId(sessionid: string) {
    return request<LoginResponse>('/api/login_sessionid', {
      method: 'POST',
      body: JSON.stringify({ sessionid }),
    });
  },

  challenge(sessionId: string, code: string) {
    return request<LoginResponse>('/api/challenge', {
      method: 'POST',
      body: JSON.stringify({ sessionId, code }),
    });
  },

  profile(sessionId: string) {
    return request<Profile>(`/api/profile?sessionId=${encodeURIComponent(sessionId)}`);
  },

  analysis(sessionId: string) {
    return request<Analysis>(`/api/analysis?sessionId=${encodeURIComponent(sessionId)}`);
  },

  followers(sessionId: string) {
    return request<User[]>(`/api/followers?sessionId=${encodeURIComponent(sessionId)}`);
  },

  following(sessionId: string) {
    return request<User[]>(`/api/following?sessionId=${encodeURIComponent(sessionId)}`);
  },
};
