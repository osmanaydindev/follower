import { useEffect, useRef } from 'react';
import { useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
} from 'react-native';
import CookieManager from '@react-native-cookies/cookies';
import { colors } from './src/theme';
import { api } from './src/api';
import type { ListKind, Route } from './src/navigation';
import type { Analysis, LoginResponse, Profile, User } from './src/types';
import { LoginScreen } from './src/screens/LoginScreen';
import { WebViewLoginScreen } from './src/screens/WebViewLoginScreen';
import { ChallengeScreen } from './src/screens/ChallengeScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { ListScreen } from './src/screens/ListScreen';
import { ProfileViewersScreen } from './src/screens/ProfileViewersScreen';

// Stack depth per screen — drives the transition direction (deeper = slide in
// from the right, shallower = slide in from the left, like a native stack).
const DEPTH: Record<string, number> = {
  login: 0,
  webviewLogin: 1,
  challenge: 1,
  home: 1,
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
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  function goHome(r: LoginResponse) {
    setProfile(r.profile);
    setAnalysis(null);
    setAnalyzeError(null);
    setLastUpdated(null);
    setHome({ sessionId: r.sessionId, username: r.username });
    setRoute({ name: 'home', sessionId: r.sessionId, username: r.username });
  }

  function logout() {
    // Clear the WebView's Instagram cookies so the next login can use a different
    // account (otherwise the embedded browser stays signed in to the old one).
    CookieManager.clearAll(true).catch(() => {});
    setProfile(null);
    setAnalysis(null);
    setAnalyzeError(null);
    setLastUpdated(null);
    setHome(null);
    setRoute({ name: 'login' });
  }

  async function analyze(sessionId: string) {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const a = await api.analysis(sessionId);
      setAnalysis(a);
      setLastUpdated(Date.now());
      // Keep the header counts in sync with the fresh analysis.
      setProfile((p) =>
        p ? { ...p, followersCount: a.followersCount, followingCount: a.followingCount } : p,
      );
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : 'Analiz başarısız');
    } finally {
      setAnalyzing(false);
    }
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

  const backHome = () => {
    if (home) setRoute({ name: 'home', sessionId: home.sessionId, username: home.username });
  };

  // Where "back" goes from each screen. Returns true if we handled it (so the
  // Android hardware back button doesn't exit the app on inner screens).
  function goBack(): boolean {
    switch (route.name) {
      case 'list':
      case 'profileViewers':
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
            analyzing={analyzing}
            error={analyzeError}
            lastUpdated={lastUpdated}
            onAnalyze={() => analyze(route.sessionId)}
            onOpenList={(kind: ListKind) =>
              setRoute({ name: 'list', sessionId: route.sessionId, kind })
            }
            onOpenProfileViewers={() => setRoute({ name: 'profileViewers' })}
            onLogout={logout}
          />
        )}

        {route.name === 'list' && (
          <ListScreen kind={route.kind} users={listUsers(route.kind)} onBack={backHome} />
        )}

        {route.name === 'profileViewers' && <ProfileViewersScreen onBack={backHome} />}
      </AnimatedRoute>
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
});
