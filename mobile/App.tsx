import { useEffect, useMemo, useRef } from 'react';
import { useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import CookieManager from '@react-native-cookies/cookies';
import { colors } from './src/theme';
import { api, ApiError, THROTTLE_COOLDOWN_MS } from './src/api';
import { clearSession, loadSession, saveSession } from './src/storage';
import { CollectorHost } from './src/collectorHost';
import { newCollection, type CollectionState } from './src/collection';
import type { CollectPhase } from './src/collector';
import type { ListKind, Route, RowAction } from './src/navigation';
import type { Analysis, LoginResponse, Profile, User } from './src/types';
import { LoginScreen } from './src/screens/LoginScreen';
import { WebViewLoginScreen } from './src/screens/WebViewLoginScreen';
import { ChallengeScreen } from './src/screens/ChallengeScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { CollectScreen } from './src/screens/CollectScreen';
import { ListScreen } from './src/screens/ListScreen';
import { ProfileViewersScreen } from './src/screens/ProfileViewersScreen';

// Stack depth per screen — drives the transition direction (deeper = slide in
// from the right, shallower = slide in from the left, like a native stack).
const DEPTH: Record<string, number> = {
  login: 0,
  webviewLogin: 1,
  challenge: 1,
  home: 1,
  collect: 2,
  list: 2,
  profileViewers: 2,
};

function screenId(r: Route): string {
  return r.name === 'list' ? `list:${r.kind}` : r.name;
}

export default function App() {
  // Simple stack: `route` is the current screen, `home` remembers the logged-in
  // session so pushed screens (lists, info) can return to it.
  const [route, setRoute] = useState<Route>({ name: 'login' });
  const [home, setHome] = useState<{ sessionId: string; username: string } | null>(null);

  // Cheap profile (picture + counts) arrives with login and shows immediately.
  const [profile, setProfile] = useState<Profile | null>(null);
  // Analysis (diff + full lists) is fetched ONCE on button press and cached, so
  // every list view is instant and we never re-hit Instagram per screen.
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  // Instagram threw a 429 at us: no analysis until this passes. Retrying through
  // a rate limit is what makes it last longer, so the UI has to actually stop.
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  // True until the stored session has been read back from the Keychain, so we
  // never flash the login screen at someone who is already signed in.
  const [restoring, setRestoring] = useState(true);
  // The running collection, owned here so it survives navigation — the user can
  // go back and read the previous results while the new lists are paginating.
  // Null means nothing is running.
  const [collection, setCollection] = useState<CollectionState | null>(null);
  // Set when a collection finishes while the user is somewhere else, so the
  // dashboard can say so instead of silently swapping the numbers out.
  const [freshResult, setFreshResult] = useState(false);

  function goHome(r: LoginResponse) {
    setProfile(r.profile);
    setAnalysis(null);
    setAnalyzeError(null);
    setLastUpdated(null);
    setHome({ sessionId: r.sessionId, username: r.username });
    setRoute({ name: 'home', sessionId: r.sessionId, username: r.username });
    // Survive app restarts and rebuilds: the session id is all we need to pick
    // up where we left off, and the backend keeps its side on disk too.
    // The password/challenge login paths return no profile; the dashboard fills
    // it in on the next launch validation.
    saveSession({ sessionId: r.sessionId, username: r.username, profile: r.profile ?? null });
  }

  // Wipe every local trace of the signed-in account and go back to login.
  function resetToLogin() {
    // Clear the WebView's Instagram cookies so the next login can use a different
    // account (otherwise the embedded browser stays signed in to the old one).
    CookieManager.clearAll(true).catch(() => {});
    clearSession();
    setProfile(null);
    setAnalysis(null);
    setAnalyzeError(null);
    setLastUpdated(null);
    setHome(null);
    setRoute({ name: 'login' });
  }

  // Deliberate sign-out. Takes no arguments — it is wired straight to onPress,
  // which would otherwise hand it a gesture event.
  function logout() {
    // Drop the server-side session too: it now survives restarts, so leaving it
    // behind would leave a usable handle on the account.
    if (home) api.logout(home.sessionId).catch(() => {});
    resetToLogin();
  }

  // On launch: restore the stored session, show the dashboard straight away with
  // the cached profile, then check with the backend whether it still works.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadSession();
      if (cancelled) return;
      if (!stored) {
        setRestoring(false);
        return;
      }
      setProfile(stored.profile ?? null);
      setHome({ sessionId: stored.sessionId, username: stored.username });
      setRoute({ name: 'home', sessionId: stored.sessionId, username: stored.username });
      setRestoring(false);

      // Put the last analysis back on screen. It is replayed from the server's
      // disk — no Instagram request — so a relaunch no longer means sitting
      // through another collection to see numbers we already had.
      api
        .lastAnalysis(stored.sessionId)
        .then(({ analysis: a, updatedAt }) => {
          if (cancelled) return;
          setAnalysis(a);
          setLastUpdated(updatedAt * 1000);
        })
        .catch(() => {}); // 404 on a first run is the normal case

      try {
        const p = await api.profile(stored.sessionId);
        if (cancelled) return;
        setProfile(p);
        saveSession({ sessionId: stored.sessionId, username: stored.username, profile: p });
      } catch (e) {
        // Only a rejected session sends the user back to login. A backend that is
        // merely down (status 0) must not wipe a perfectly good session.
        if (!cancelled && e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          console.log('[restore] session reddedildi, tekrar giris gerekiyor');
          resetToLogin(); // the backend already rejected it; nothing to delete there
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start a collection: the lists are paginated inside the app's own Instagram
  // browser (mounted at the root, below) and only the finished lists reach the
  // backend. Refuses to start during a cooldown — a retry through a rate limit
  // is what keeps the limit alive.
  function startAnalyze(sessionId: string, username: string) {
    if (collection) {
      setRoute({ name: 'collect', sessionId, username });
      return;
    }
    const left = cooldownUntil != null ? cooldownUntil - Date.now() : 0;
    if (left > 0) {
      setAnalyzeError(
        `Instagram istekleri geçici olarak sınırladı. ${Math.ceil(left / 60000)} dk sonra tekrar dene.`,
      );
      return;
    }
    setAnalyzeError(null);
    setFreshResult(false);
    setCollection(newCollection(profile?.followersCount, profile?.followingCount));
    setRoute({ name: 'collect', sessionId, username });
  }

  // Stop for good (the user pressed "Durdur", or an error ended the run).
  // Unmounting the host tears down the WebView, which is what stops the script.
  function stopCollection() {
    setCollection(null);
    if (route.name === 'collect') backHome();
  }

  function applyAnalysis(a: Analysis) {
    setAnalysis(a);
    setLastUpdated(Date.now());
    // Keep the header counts in sync with the fresh analysis.
    setProfile((p) =>
      p ? { ...p, followersCount: a.followersCount, followingCount: a.followingCount } : p,
    );
    setCollection(null);
    // Only pull the user back if they stayed to watch. Yanking someone out of a
    // list they are reading is exactly the rudeness this refactor removes.
    if (route.name === 'collect') backHome();
    else setFreshResult(true);
  }

  // Instagram said slow down — anywhere in the collection. Park the button for a
  // cooldown instead of bouncing the user back to a screen that invites a retry.
  function onThrottled(message: string) {
    setCooldownUntil(Date.now() + THROTTLE_COOLDOWN_MS);
    setAnalyzeError(message);
    setCollection(null);
    if (route.name === 'collect') backHome();
  }

  function onCollectError(message: string) {
    setAnalyzeError(message);
    setCollection(null);
    if (route.name === 'collect') backHome();
  }

  function onCollectProgress(phase: CollectPhase, count: number) {
    setCollection((c) => (c ? { ...c, phase, [phase]: count } : c));
  }

  function listUsers(kind: ListKind): User[] {
    if (!analysis) return [];
    switch (kind) {
      case 'followers':
        return analysis.followers;
      case 'following':
        return analysis.following;
      case 'mutuals':
        return analysis.mutuals;
      case 'notFollowingBack':
        return analysis.notFollowingBack;
      case 'unfollowed':
        return analysis.unfollowed;
      case 'newFollowers':
        return analysis.newFollowers;
      case 'fans':
      default:
        return analysis.fans;
    }
  }

  // Accounts I currently follow — the "unfollowed" list is a snapshot diff, so it
  // needs this to know which of those rows I can still unfollow.
  const followingPks = useMemo(
    () => new Set((analysis?.following ?? []).map((u) => u.pk)),
    [analysis],
  );

  // A row action succeeded on Instagram; move the account between the cached
  // lists so every screen (and the dashboard counts) matches reality without
  // re-running the whole analysis.
  function applyAction(user: User, action: RowAction) {
    setAnalysis((a) => {
      if (!a) return a;
      const drop = (list: User[]) => list.filter((u) => u.pk !== user.pk);
      const wasMutual = a.mutuals.some((u) => u.pk === user.pk);

      if (action === 'unfollow') {
        return {
          ...a,
          following: drop(a.following),
          followingCount: Math.max(0, a.followingCount - 1),
          mutuals: wasMutual ? drop(a.mutuals) : a.mutuals,
          mutualsCount: wasMutual ? Math.max(0, a.mutualsCount - 1) : a.mutualsCount,
          // A mutual I just unfollowed still follows me → they become a fan.
          fans: wasMutual ? [user, ...a.fans] : a.fans,
          notFollowingBack: drop(a.notFollowingBack),
        };
      }
      return {
        ...a,
        followers: drop(a.followers),
        followersCount: Math.max(0, a.followersCount - 1),
        mutuals: wasMutual ? drop(a.mutuals) : a.mutuals,
        mutualsCount: wasMutual ? Math.max(0, a.mutualsCount - 1) : a.mutualsCount,
        // A mutual I removed is still someone I follow → not following me back.
        notFollowingBack: wasMutual ? [user, ...a.notFollowingBack] : a.notFollowingBack,
        fans: drop(a.fans),
        newFollowers: drop(a.newFollowers),
      };
    });
    setProfile((p) =>
      !p
        ? p
        : action === 'unfollow'
          ? { ...p, followingCount: Math.max(0, p.followingCount - 1) }
          : { ...p, followersCount: Math.max(0, p.followersCount - 1) },
    );
  }

  const backHome = () => {
    if (home) setRoute({ name: 'home', sessionId: home.sessionId, username: home.username });
  };

  // Where "back" goes from each screen. Returns true if we handled it (so the
  // Android hardware back button doesn't exit the app on inner screens).
  function goBack(): boolean {
    switch (route.name) {
      case 'list':
      case 'profileViewers':
      case 'collect':
        backHome();
        return true;
      case 'webviewLogin':
      case 'challenge':
        setRoute({ name: 'login' });
        return true;
      default:
        return false; // login / home → let the OS handle it (exit)
    }
  }

  // Wire the Android hardware/gesture back button to our navigation.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => sub.remove();
  });

  const topInset = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;

  // Reading the Keychain takes a moment; hold on a blank screen rather than
  // showing a login form that is about to be replaced.
  if (restoring) {
    return (
      <SafeAreaView style={[styles.safe, { paddingTop: topInset }]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <View style={styles.boot}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { paddingTop: topInset }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <AnimatedRoute id={screenId(route)} depth={DEPTH[route.name] ?? 1}>
        {route.name === 'login' && (
          <LoginScreen
            onLoggedIn={goHome}
            onWebViewLogin={() => setRoute({ name: 'webviewLogin' })}
            onChallenge={(r) =>
              setRoute({ name: 'challenge', sessionId: r.sessionId, username: r.username })
            }
          />
        )}

        {route.name === 'webviewLogin' && (
          <WebViewLoginScreen onLoggedIn={goHome} onCancel={() => setRoute({ name: 'login' })} />
        )}

        {route.name === 'challenge' && (
          <ChallengeScreen
            sessionId={route.sessionId}
            username={route.username}
            onVerified={goHome}
            onCancel={() => setRoute({ name: 'login' })}
          />
        )}

        {route.name === 'home' && (
          <DashboardScreen
            username={route.username}
            profile={profile}
            analysis={analysis}
            collection={collection}
            freshResult={freshResult}
            onDismissFresh={() => setFreshResult(false)}
            onOpenCollect={() =>
              setRoute({ name: 'collect', sessionId: route.sessionId, username: route.username })
            }
            error={analyzeError}
            cooldownUntil={cooldownUntil}
            lastUpdated={lastUpdated}
            onAnalyze={() => startAnalyze(route.sessionId, route.username)}
            onOpenList={(kind: ListKind) =>
              setRoute({ name: 'list', sessionId: route.sessionId, kind })
            }
            onLogout={logout}
          />
        )}

        {route.name === 'collect' && collection && (
          <CollectScreen state={collection} onBackground={backHome} onStop={stopCollection} />
        )}

        {route.name === 'list' && (
          <ListScreen
            kind={route.kind}
            sessionId={route.sessionId}
            users={listUsers(route.kind)}
            followingPks={followingPks}
            // Two Instagram browsers making requests at once is exactly the
            // pattern we are pacing against, so the row bridge stands down
            // while a collection is running.
            collecting={collection != null}
            onApplied={applyAction}
            onBack={backHome}
          />
        )}

        {route.name === 'profileViewers' && <ProfileViewersScreen onBack={backHome} />}
      </AnimatedRoute>

      {/* Outside the animated route on purpose: this is what lets the user
          navigate away without cancelling the collection. */}
      {collection && home && (
        <CollectorHost
          sessionId={home.sessionId}
          onProgress={onCollectProgress}
          onSaving={() => setCollection((c) => (c ? { ...c, saving: true } : c))}
          onComplete={applyAnalysis}
          onThrottled={onThrottled}
          // A failed collection reports where the user can act on it — the
          // dashboard, which already owns the error line and the retry button.
          onError={onCollectError}
        />
      )}
    </SafeAreaView>
  );
}

// AnimatedRoute cross-fades + slides the active screen whenever it changes,
// giving a lightweight native-stack feel without a navigation library. Direction
// follows stack depth: forward slides in from the right, back from the left.
function AnimatedRoute({
  id,
  depth,
  children,
}: {
  id: string;
  depth: number;
  children: React.ReactNode;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const prevDepth = useRef(depth);

  useEffect(() => {
    const dir = depth >= prevDepth.current ? 1 : -1;
    prevDepth.current = depth;
    opacity.setValue(0);
    translateX.setValue(dir * 28);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <Animated.View style={[styles.flex, { opacity, transform: [{ translateX }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
