import * as SecureStore from 'expo-secure-store';
import type { Profile } from './types';

// The session id is a bearer token for someone's Instagram account data, so it
// lives in the Keychain/Keystore rather than plain storage — same rule as the
// rest of the app: never keep credentials in the clear. The cached profile next
// to it is only there so a relaunch can paint the dashboard before the network
// answers.
const KEY = 'follower.session';

export type StoredSession = {
  sessionId: string;
  username: string;
  profile: Profile | null;
};

// Storage is a convenience, never a hard dependency: if the Keychain is
// unavailable the app just falls back to asking for a login.
export async function saveSession(s: StoredSession): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(s));
  } catch (e) {
    console.warn('[storage] session kaydedilemedi', e);
  }
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    return s?.sessionId ? s : null;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // nothing to clean up
  }
}
