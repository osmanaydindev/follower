import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { api, ApiError, isThrottled } from './api';
import { COLLECTOR_JS, IG_WEB_UA, parseCollectorMessage } from './collector';
import type { CollectPhase } from './collector';
import type { Analysis, User } from './types';

// The Instagram browser that paginates the two lists — owned by App, not by a
// screen.
//
// It used to live inside CollectScreen, which made leaving that screen cancel
// the collection: the WebView went away with the screen and its injected script
// died with it. A list of a few thousand accounts takes minutes (deliberately —
// see collector.ts for the pacing), so "stare at a spinner or lose your
// progress" was the whole interaction. Mounted at the root instead, the
// collection survives navigation and the screen becomes just one view of it.
//
// What this still cannot do is run in the background: iOS suspends WKWebView
// JavaScript the moment the app leaves the foreground. The app has to stay open
// — but it no longer has to stay on one screen.

const IG_URL = 'https://www.instagram.com/';

type Props = {
  sessionId: string;
  onProgress: (phase: CollectPhase, count: number) => void;
  // Collection finished; the lists are now being diffed by the backend.
  onSaving: () => void;
  onComplete: (a: Analysis) => void;
  onThrottled: (message: string) => void;
  onError: (message: string) => void;
};

export function CollectorHost({
  sessionId,
  onProgress,
  onSaving,
  onComplete,
  onThrottled,
  onError,
}: Props) {
  // Pages stream in one at a time; refs (not state) because every page would
  // otherwise re-render the tree and we only want the counters to move.
  const followers = useRef<User[]>([]);
  const following = useRef<User[]>([]);
  const injected = useRef(false);
  const finished = useRef(false);
  const webRef = useRef<WebView | null>(null);

  async function submit() {
    if (finished.current) return;
    finished.current = true;
    onSaving();
    try {
      onComplete(await api.ingest(sessionId, followers.current, following.current));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Sonuçlar kaydedilemedi');
    }
  }

  // The WebView has no Instagram session — which is also exactly what mock mode
  // looks like. Fall back to the server-side path so the mock provider (and the
  // sidecar, if it is healthy) keeps the app working end to end.
  async function fallbackToServer() {
    if (finished.current) return;
    finished.current = true;
    onSaving();
    try {
      onComplete(await api.analysis(sessionId));
    } catch (e) {
      if (isThrottled(e)) {
        onThrottled(e instanceof Error ? e.message : 'Instagram istekleri sınırladı');
        return;
      }
      onError(
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
        onProgress(msg.phase, msg.count);
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
        onError(msg.message);
        break;
    }
  }

  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        ref={webRef}
        source={{ uri: IG_URL }}
        userAgent={IG_WEB_UA}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        style={styles.fill}
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
  // The wrapper is what has to be out of flow, not the WebView: react-native-
  // webview applies `style` to the inner view and keeps `flex: 1` on the
  // container it wraps around it. Styling only the WebView therefore left a
  // full-flex box in the column, which quietly ate half the screen — the
  // progress screen's content was squeezed into the top half and overflowed
  // across the header.
  hidden: { position: 'absolute', top: 0, left: 0, width: 1, height: 1, opacity: 0, overflow: 'hidden' },
  fill: { flex: 1 },
});
