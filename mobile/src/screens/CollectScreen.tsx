import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Header } from '../components/Header';
import { api, ApiError, isThrottled } from '../api';
import { COLLECTOR_JS, IG_WEB_UA, parseCollectorMessage } from '../collector';
import type { CollectPhase } from '../collector';
import { colors, spacing } from '../theme';
import type { Analysis, User } from '../types';

// Any Instagram page works as the origin; the home feed is the one a signed-in
// browser would be sitting on anyway.
const IG_URL = 'https://www.instagram.com/';

type Props = {
  sessionId: string;
  // Rough targets from the cached profile, so progress can show "412 / 922"
  // instead of a number climbing towards nothing.
  expectedFollowers?: number;
  expectedFollowing?: number;
  onComplete: (a: Analysis) => void;
  onThrottled: (message: string) => void;
  onCancel: () => void;
};

const PHASE_LABEL: Record<CollectPhase, string> = {
  followers: 'Takipçiler',
  following: 'Takip edilenler',
};

// Collects the two lists inside the app's own Instagram browser and hands them
// to the backend, which does the diff. The server never talks to Instagram on
// this path — see collector.ts for why that is the point.
export function CollectScreen({
  sessionId,
  expectedFollowers,
  expectedFollowing,
  onComplete,
  onThrottled,
  onCancel,
}: Props) {
  const [phase, setPhase] = useState<CollectPhase>('followers');
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Pages stream in one at a time; refs (not state) because every page would
  // otherwise re-render the screen and we only want the counters to move.
  const followers = useRef<User[]>([]);
  const following = useRef<User[]>([]);
  const injected = useRef(false);
  const finished = useRef(false);
  const webRef = useRef<WebView | null>(null);

  async function submit() {
    if (finished.current) return;
    finished.current = true;
    setSaving(true);
    try {
      const a = await api.ingest(sessionId, followers.current, following.current);
      onComplete(a);
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : 'Sonuçlar kaydedilemedi');
    }
  }

  // The WebView has no Instagram session — which is also exactly what mock mode
  // looks like. Fall back to the server-side path so the mock provider (and the
  // sidecar, if it is healthy) keeps the app working end to end.
  async function fallbackToServer() {
    if (finished.current) return;
    finished.current = true;
    setSaving(true);
    try {
      onComplete(await api.analysis(sessionId));
    } catch (e) {
      setSaving(false);
      if (isThrottled(e)) {
        onThrottled(e instanceof Error ? e.message : 'Instagram istekleri sınırladı');
        return;
      }
      setError(
        e instanceof ApiError && e.status === 401
          ? 'Instagram oturumu geçersiz. Tekrar giriş yapman gerekiyor.'
          : e instanceof Error
            ? e.message
            : 'Analiz başarısız',
      );
    }
  }

  function onMessage(raw: string) {
    const msg = parseCollectorMessage(raw);
    if (!msg || finished.current) return;

    switch (msg.type) {
      case 'page':
        (msg.phase === 'followers' ? followers : following).current.push(...msg.users);
        break;
      case 'progress':
        setPhase(msg.phase);
        setCounts((c) => ({ ...c, [msg.phase]: msg.count }));
        break;
      case 'done':
        submit();
        break;
      case 'throttled':
        finished.current = true;
        onThrottled(msg.message);
        break;
      case 'auth':
        fallbackToServer();
        break;
      case 'error':
        finished.current = true;
        setError(msg.message);
        break;
    }
  }

  const done = phase === 'followers' ? counts.followers : counts.following;
  const target = phase === 'followers' ? expectedFollowers : expectedFollowing;
  const pct = target && target > 0 ? Math.min(100, Math.round((done / target) * 100)) : null;

  return (
    <View style={styles.flex}>
      <Header title="Analiz" onBack={onCancel} />

      <View style={styles.body}>
        {error ? (
          <>
            <Text style={styles.error}>{error}</Text>
            <TouchableOpacity style={styles.button} onPress={onCancel}>
              <Text style={styles.buttonText}>Geri dön</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.phase}>
              {saving ? 'Sonuçlar hesaplanıyor…' : `${PHASE_LABEL[phase]} çekiliyor…`}
            </Text>
            <Text style={styles.count}>
              {target ? `${done} / ${target}` : String(done)}
              {pct != null ? `  ·  %${pct}` : ''}
            </Text>
            <Text style={styles.hint}>
              Listeler senin tarayıcı oturumunla, sayfa sayfa ve aralarında beklemeyle
              çekiliyor. Hesabının işaretlenmemesi için bu yavaşlık bilerek var —
              uygulamayı açık bırak.
            </Text>
            <TouchableOpacity style={styles.cancel} onPress={onCancel}>
              <Text style={styles.cancelText}>Durdur</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Mounted but out of sight: WKWebView only runs scripts while it is in the
          view tree, and there is nothing here for the user to look at. */}
      <WebView
        ref={webRef}
        source={{ uri: IG_URL }}
        userAgent={IG_WEB_UA}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        style={styles.hidden}
        onMessage={(e) => onMessage(e.nativeEvent.data)}
        onLoadEnd={() => {
          // Instagram is a SPA and fires this more than once; the script also
          // guards itself, but there is no reason to inject it twice.
          if (injected.current) return;
          injected.current = true;
          webRef.current?.injectJavaScript(COLLECTOR_JS);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  phase: { fontSize: 17, fontWeight: '700', color: colors.text },
  count: { fontSize: 15, color: colors.textMuted },
  hint: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },
  error: { fontSize: 14, color: colors.danger, textAlign: 'center' },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancel: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  cancelText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  // 1×1 and invisible: present in the tree so its JavaScript runs, invisible so
  // the progress UI owns the screen.
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
