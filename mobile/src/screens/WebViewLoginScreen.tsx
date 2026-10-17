import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import CookieManager from '@react-native-cookies/cookies';
import { Header } from '../components/Header';
import { IG_WEB_UA, PROFILE_JS } from '../collector';
import { api } from '../api';
import { colors, spacing } from '../theme';
import type { LoginResponse, Profile, WebSession } from '../types';

const IG_LOGIN_URL = 'https://www.instagram.com/accounts/login/';
// Shared with the collector WebView and kept in sync with the sidecar's WEB_UA
// and X-IG-App-ID. The session Instagram issues here is later used by both; if
// the login was made as mobile-web but the requests claim the desktop web app —
// or vice versa — Instagram sees an inconsistent client and answers "please wait
// a few minutes".
const UA = IG_WEB_UA;
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
  // A failed hand-off parks the poller instead of re-arming it. Retrying is the
  // user's call, never a timer's: the cookie is still there, so an automatic
  // retry would re-send the same request every 1.5s — and if the failure came
  // from Instagram (429/checkpoint) that loop is exactly what deepens a flag.
  const [failed, setFailed] = useState(false);
  const handled = useRef(false);
  const webRef = useRef<WebView | null>(null);
  // The cookie jar waiting for the page to say who it belongs to. Cleared the
  // moment it is sent, so the profile reply and the timeout cannot both fire it.
  const pending = useRef<WebSession | null>(null);
  const profileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Read the WHOLE Instagram cookie jar, not just sessionid. Instagram ties a
  // session to the browser that created it (csrftoken, mid, ig_did + the exact
  // User-Agent); handing the backend only sessionid makes every later request
  // look like a stolen cookie, which Instagram answers with "please wait a few
  // minutes". So the backend gets the full identity and replays it.
  async function readWebSession(): Promise<WebSession | null> {
    const jar: Record<string, string> = {};
    for (const url of COOKIE_URLS) {
      try {
        const c = await CookieManager.get(url, true);
        for (const [name, cookie] of Object.entries(c ?? {})) {
          if (cookie?.value && !jar[name]) jar[name] = cookie.value;
        }
      } catch {
        // try next host
      }
    }
    if (!jar.sessionid) return null;
    return { sessionid: jar.sessionid, cookies: jar, userAgent: UA };
  }

  // Cookies are in hand. Before handing them over, ask the PAGE who it is — see
  // PROFILE_JS. That makes the backend's side of signing in a pure bookkeeping
  // step with no Instagram request of its own, which is the only version of this
  // that survives a throttled account.
  function beginHandoff(web: WebSession) {
    if (handled.current) return;
    handled.current = true;
    pending.current = web;
    setBusy(true);
    setError(null);
    webRef.current?.injectJavaScript(PROFILE_JS);
    // The in-page read is an optimisation, not a requirement. If the page does
    // not answer, go on without it and let the backend fall back.
    profileTimer.current = setTimeout(() => proceed(web), 8000);
  }

  async function proceed(web: WebSession) {
    if (profileTimer.current) {
      clearTimeout(profileTimer.current);
      profileTimer.current = null;
    }
    if (pending.current === null) return; // already sent
    pending.current = null;
    setBusy(true);
    setError(null);
    try {
      const r = await api.loginSessionId(web);
      onLoggedIn(r);
    } catch (e) {
      // handled stays true on purpose — see `failed` above. Only retry() re-arms.
      setBusy(false);
      setFailed(true);
      setError(e instanceof Error ? e.message : 'Giriş tamamlanamadı');
    }
  }

  function onMessage(raw: string) {
    let msg: { type?: string; profile?: Profile | null };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type !== 'profile') return;
    const web = pending.current;
    if (!web) return;
    proceed({ ...web, profile: msg.profile ?? null });
  }

  function retry() {
    handled.current = false;
    pending.current = null;
    setFailed(false);
    setError(null);
  }

  // Auto-detect: poll every 1.5s once cookies are cleared and the page is live.
  useEffect(() => {
    if (!ready || failed) return;
    const id = setInterval(async () => {
      if (handled.current) return;
      const web = await readWebSession();
      if (web) beginHandoff(web);
    }, 1500);
    return () => clearInterval(id);
  }, [ready, failed]);

  return (
    <View style={styles.flex}>
      <Header title="Instagram ile giriş" onBack={onCancel} />
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.retry} onPress={retry}>
            <Text style={styles.retryText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      )}

      {ready ? (
        <WebView
          ref={webRef}
          source={{ uri: IG_LOGIN_URL }}
          userAgent={UA}
          onMessage={(e) => onMessage(e.nativeEvent.data)}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          onLoadEnd={async () => {
            if (handled.current) return;
            const web = await readWebSession();
            if (web) beginHandoff(web);
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
  errorBox: { padding: spacing.md, gap: spacing.sm, alignItems: 'center' },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  retry: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    gap: spacing.md,
  },
  overlayText: { color: colors.text, fontSize: 15 },
});
