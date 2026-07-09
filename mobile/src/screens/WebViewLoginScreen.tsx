import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import CookieManager from '@react-native-cookies/cookies';
import { Header } from '../components/Header';
import { api } from '../api';
import { colors, spacing } from '../theme';
import type { LoginResponse } from '../types';

const IG_LOGIN_URL = 'https://www.instagram.com/accounts/login/';
const UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
// Instagram scopes its sessionid cookie to a few hosts; check them all.
const COOKIE_URLS = ['https://www.instagram.com', 'https://instagram.com', 'https://i.instagram.com'];

type Props = { onLoggedIn: (r: LoginResponse) => void; onCancel: () => void };

// The user logs into Instagram in a real embedded browser (2FA/checkpoint handled
// by Instagram's own UI). Instagram's web app is a SPA, so we POLL for the
// `sessionid` cookie (read natively; it's HttpOnly so JS can't) and proceed
// automatically the moment it appears. No password ever touches our app.
export function WebViewLoginScreen({ onLoggedIn, onCancel }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const handled = useRef(false);

  // Clear Instagram's cookies BEFORE loading, every time this screen opens. iOS
  // keeps them in a shared persistent store (needed so CookieManager can read
  // sessionid), so without this the WebView stays signed in to the previous
  // account. We render the WebView only after clearing → always a fresh login.
  useEffect(() => {
    (async () => {
      try {
        await CookieManager.clearAll(true);
        await CookieManager.clearAll(false);
      } catch {
        // best effort
      }
      handled.current = false;
      setReady(true);
    })();
  }, []);

  async function readSessionId(): Promise<string | null> {
    for (const url of COOKIE_URLS) {
      try {
        const c = await CookieManager.get(url, true);
        if (c?.sessionid?.value) return c.sessionid.value;
      } catch {
        // try next host
      }
    }
    return null;
  }

  async function proceed(sessionid: string) {
    if (handled.current) return;
    handled.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = await api.loginSessionId(sessionid);
      onLoggedIn(r);
    } catch (e) {
      handled.current = false;
      setBusy(false);
      setError(e instanceof Error ? e.message : 'Giriş tamamlanamadı');
    }
  }

  // Auto-detect: poll every 1.5s once cookies are cleared and the page is live.
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(async () => {
      if (handled.current) return;
      const sid = await readSessionId();
      if (sid) proceed(sid);
    }, 1500);
    return () => clearInterval(id);
  }, [ready]);

  return (
    <View style={styles.flex}>
      <Header title="Instagram ile giriş" onBack={onCancel} />
      {error && <Text style={styles.error}>{error}</Text>}

      {ready ? (
        <WebView
          source={{ uri: IG_LOGIN_URL }}
          userAgent={UA}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          onLoadEnd={async () => {
            if (handled.current) return;
            const sid = await readSessionId();
            if (sid) proceed(sid);
          }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.overlay}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
        />
      ) : (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.overlayText}>Hazırlanıyor…</Text>
        </View>
      )}

      {busy && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.overlayText}>Giriş doğrulanıyor…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  error: { color: colors.danger, fontSize: 13, padding: spacing.md, textAlign: 'center' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    gap: spacing.md,
  },
  overlayText: { color: colors.text, fontSize: 15 },
});
