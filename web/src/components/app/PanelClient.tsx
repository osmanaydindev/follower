'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnalyzeProgress } from './AnalyzeProgress';
import { Notice } from './Notice';
import { ProfileHeader, type StatTarget } from './ProfileHeader';
import { SummaryCard, type CardTone } from './SummaryCard';
import { Tabs, type TabItem } from './Tabs';
import { UserList } from './UserList';
import { Button, LinkButton } from '../ui/Button';
import { Card } from '../ui/Card';
import { Icon, type IconName } from '../ui/Icon';
import { LocaleSwitch } from '../ui/LocaleSwitch';
import { Spinner } from '../ui/Spinner';
import { ThemeToggle } from '../ui/ThemeToggle';
import { api, ApiError, isOffline, isThrottled, THROTTLE_COOLDOWN_MS } from '@/lib/api';
import { EmptyCollectionError, runAnalysis, type AnalyzeProgress as Progress } from '@/lib/analyze';
import { fmtDateTime, minutesLeft } from '@/lib/format';
import { fill, href, type Dict, type Locale } from '@/lib/i18n';
import { platform } from '@/lib/platforms';
import {
  usersFor,
  type Analysis,
  type ListKind,
  type Profile,
  type RowAction,
  type User,
} from '@/lib/types';
import styles from './PanelClient.module.css';

type Stored = { analysis: Analysis; at: number };

function storageKey(username: string) {
  return `follower.analysis.${username}`;
}

/** sessionStorage, not localStorage: this is someone's follower list. */
function loadStored(username: string): Stored | null {
  try {
    const raw = sessionStorage.getItem(storageKey(username));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    return parsed.analysis ? parsed : null;
  } catch {
    return null;
  }
}

function saveStored(username: string, value: Stored) {
  try {
    sessionStorage.setItem(storageKey(username), JSON.stringify(value));
  } catch {
    /* quota or private mode: the result simply does not survive a reload */
  }
}

export function PanelClient({
  locale,
  t,
  profile: initialProfile,
  username,
  backendDown,
  collectMode,
}: {
  locale: Locale;
  t: Dict;
  profile: Profile | null;
  username: string;
  /** The page loaded but the backend could not be reached — do not sign out. */
  backendDown: boolean;
  collectMode: boolean;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const [tab, setTab] = useState<ListKind>('notFollowingBack');
  const [loggingOut, setLoggingOut] = useState(false);
  // Bumped on every fresh analysis so the frozen list remounts with new rows.
  const [version, setVersion] = useState(0);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const stored = loadStored(username);
    if (stored) {
      setAnalysis(stored.analysis);
      setLastUpdated(stored.at);
    }
  }, [username]);

  // Persisting here rather than at each mutation site keeps the state updaters
  // pure — React calls them twice in development, and a write inside one would
  // run twice with it.
  useEffect(() => {
    if (analysis && lastUpdated) saveStored(username, { analysis, at: lastUpdated });
  }, [analysis, lastUpdated, username]);

  // Cooldowns are wall-clock, so a tick is enough to re-render the countdown.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (cooldownUntil === null && blockedUntil === null) return;
    const id = setInterval(() => {
      forceTick((n) => n + 1);
      if (cooldownUntil !== null && Date.now() >= cooldownUntil) setCooldownUntil(null);
      if (blockedUntil !== null && Date.now() >= blockedUntil) setBlockedUntil(null);
    }, 20_000);
    return () => clearInterval(id);
  }, [cooldownUntil, blockedUntil]);

  useEffect(() => () => abort.current?.abort(), []);

  const cooling = cooldownUntil !== null && Date.now() < cooldownUntil;
  const blocked = blockedUntil !== null && Date.now() < blockedUntil;
  const analyzing = progress !== null;

  const describe = useCallback(
    (e: unknown): string => {
      if (e instanceof EmptyCollectionError) return t.panel.errorEmpty;
      if (isThrottled(e)) return t.panel.errorThrottled;
      if (isOffline(e)) return t.panel.errorNetwork;
      if (e instanceof ApiError && (e.status === 401 || e.status === 403))
        return t.panel.errorSession;
      if (e instanceof ApiError && e.message) return e.message;
      return t.panel.errorGeneric;
    },
    [t],
  );

  const signOut = useCallback(async () => {
    setLoggingOut(true);
    try {
      sessionStorage.removeItem(storageKey(username));
    } catch {
      /* ignore */
    }
    try {
      await api.logout();
    } catch {
      /* the cookie is cleared server-side regardless */
    }
    router.replace(href(locale, 'home'));
  }, [locale, router, username]);

  async function analyze() {
    if (analyzing || cooling) return;
    setError(null);
    const controller = new AbortController();
    abort.current = controller;

    try {
      const result = await runAnalysis({
        profile,
        onProgress: setProgress,
        signal: controller.signal,
      });
      setAnalysis(result);
      setLastUpdated(Date.now());
      setVersion((v) => v + 1);
      // Counts can drift from the cached profile; the analysis is the fresher
      // source for the two it reports.
      setProfile((p) =>
        p
          ? { ...p, followersCount: result.followersCount, followingCount: result.followingCount }
          : p,
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      if (isThrottled(e)) setCooldownUntil(Date.now() + THROTTLE_COOLDOWN_MS);
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        // A full navigation, not router.replace: the target is a route handler
        // that clears the dead cookie before redirecting to sign-in.
        window.location.assign(`/api/auth/expired?locale=${locale}`);
        return;
      }
      setError(describe(e));
    } finally {
      setProgress(null);
      abort.current = null;
    }
  }

  /**
   * Applies a successful row action to the cached analysis instead of re-running
   * it — one unfollow must not cost another full collection. Mirrors
   * `applyAction` in the mobile app, including the cross-list moves: unfollowing
   * a mutual makes them a fan, removing a mutual makes them someone you follow
   * one-sidedly.
   */
  const applyAction = useCallback(
    (user: User, action: RowAction) => {
      setAnalysis((prev) => {
        if (!prev) return prev;
        const without = (list: User[]) => list.filter((u) => u.pk !== user.pk);
        const wasMutual = prev.mutuals.some((u) => u.pk === user.pk);
        const next: Analysis = { ...prev };

        if (action === 'unfollow') {
          next.following = without(prev.following);
          next.notFollowingBack = without(prev.notFollowingBack);
          next.followingCount = Math.max(0, prev.followingCount - 1);
          if (wasMutual) {
            next.mutuals = without(prev.mutuals);
            next.fans = [user, ...prev.fans];
          }
        } else {
          next.followers = without(prev.followers);
          next.fans = without(prev.fans);
          next.newFollowers = without(prev.newFollowers);
          next.followersCount = Math.max(0, prev.followersCount - 1);
          if (wasMutual) {
            next.mutuals = without(prev.mutuals);
            next.notFollowingBack = [user, ...prev.notFollowingBack];
          }
        }
        next.mutualsCount = next.mutuals.length;
        return next;
      });
      setProfile((p) =>
        p
          ? {
              ...p,
              followingCount:
                action === 'unfollow' ? Math.max(0, p.followingCount - 1) : p.followingCount,
              followersCount:
                action === 'removeFollower' ? Math.max(0, p.followersCount - 1) : p.followersCount,
            }
          : p,
      );
    },
    [],
  );

  const runRowAction = useCallback(
    async (user: User, action: RowAction) => {
      if (action === 'unfollow') await api.unfollow(user.pk);
      else await api.removeFollower(user.pk);
      applyAction(user, action);
    },
    [applyAction],
  );

  /**
   * On the collector path there is no credential to read a profile with, so the
   * header is built from what the collection itself reports. Posts and the
   * picture are genuinely unknown here and are left out rather than faked.
   */
  const headerProfile: Profile | null = useMemo(() => {
    if (profile) return profile;
    if (!analysis || !username) return null;
    return {
      username,
      fullName: '',
      profilePicUrl: '',
      followersCount: analysis.followersCount,
      followingCount: analysis.followingCount,
      mediaCount: 0,
      isPrivate: false,
      isVerified: false,
    };
  }, [profile, analysis, username]);

  const followingPks = useMemo(
    () => new Set((analysis?.following ?? []).map((u) => u.pk)),
    [analysis],
  );

  const tabs: TabItem<ListKind>[] = useMemo(() => {
    if (!analysis) return [];
    const { baseTabs, historyTabs } = platform();
    const kinds = analysis.hasHistory ? [...baseTabs, ...historyTabs] : baseTabs;
    return kinds.map((kind) => ({
      value: kind,
      label: t.panel.tabs[kind],
      count: usersFor(analysis, kind).length,
    }));
  }, [analysis, t]);

  // Keep the selected tab valid when history appears or disappears.
  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((item) => item.value === tab)) {
      setTab(tabs[0]!.value);
    }
  }, [tabs, tab]);

  const summary: { kind: ListKind; title: string; hint: string; tone: CardTone; icon: IconName }[] =
    [
      {
        kind: 'mutuals',
        title: t.panel.cardMutuals,
        hint: t.panel.cardMutualsHint,
        tone: 'success',
        icon: 'handshake',
      },
      {
        kind: 'notFollowingBack',
        title: t.panel.cardNotBack,
        hint: t.panel.cardNotBackHint,
        tone: 'danger',
        icon: 'userMinus',
      },
      {
        kind: 'fans',
        title: t.panel.cardFans,
        hint: t.panel.cardFansHint,
        tone: 'info',
        icon: 'heart',
      },
    ];

  const history: typeof summary = [
    {
      kind: 'unfollowed',
      title: t.panel.cardUnfollowed,
      hint: t.panel.cardUnfollowedHint,
      tone: 'danger',
      icon: 'userMinus',
    },
    {
      kind: 'newFollowers',
      title: t.panel.cardNewFollowers,
      hint: t.panel.cardNewFollowersHint,
      tone: 'success',
      icon: 'trend',
    },
  ];

  function openTab(kind: ListKind) {
    setTab(kind);
    document.getElementById('lists')?.scrollIntoView({ block: 'start' });
  }

  function onStat(target: StatTarget) {
    if (!analysis) {
      void analyze();
      return;
    }
    openTab(target);
  }

  return (
    <>
      <header className={styles.topbar}>
        <div className={`page ${styles.topbarInner}`}>
          <Link href={href(locale, 'home')} className={styles.brand}>
            {t.nav.brand}
          </Link>
          <div className={styles.topbarActions}>
            <LocaleSwitch locale={locale} label={t.common.language} />
            <ThemeToggle
              label={t.common.theme}
              lightLabel={t.common.themeLight}
              darkLabel={t.common.themeDark}
            />
            <Button variant="ghost" size="sm" onClick={() => void signOut()} disabled={loggingOut}>
              {loggingOut ? <Spinner size={14} /> : <Icon name="logout" size={17} />}
              <span>{loggingOut ? t.panel.loggingOut : t.panel.logout}</span>
            </Button>
          </div>
        </div>
      </header>

      <main id="main" className={`page ${styles.main}`}>
        {/* The backend is unreachable but the session is untouched — the user
            stays signed in and whatever was analysed earlier stays on screen. */}
        {backendDown ? <Notice tone="warning" title={t.panel.errorNetwork} role="status" /> : null}

        <Card className={styles.hero}>
          {headerProfile ? (
            <ProfileHeader profile={headerProfile} locale={locale} t={t} onStat={onStat} />
          ) : (
            <p className={styles.heroFallback}>@{username}</p>
          )}
        </Card>

        {analyzing ? (
          <Card>
            <AnalyzeProgress progress={progress!} locale={locale} t={t} />
          </Card>
        ) : null}

        {!analysis && !analyzing ? (
          <Card className={styles.cta}>
            <span className={styles.ctaIcon}>
              <Icon name="users" size={26} strokeWidth={1.6} />
            </span>
            <h2 className={styles.ctaTitle}>{t.panel.ctaTitle}</h2>
            <p className={styles.ctaBody}>{t.panel.ctaBody}</p>
            {error ? (
              <Notice tone="danger" title={t.common.errorTitle} role="alert">
                {error}
              </Notice>
            ) : null}
            {cooling ? (
              <Notice tone="warning" role="status">
                {t.panel.cooldownReason}
              </Notice>
            ) : null}
            {collectMode ? (
              <LinkButton href={href(locale, 'collect')} size="lg">
                {t.collect.title}
              </LinkButton>
            ) : (
              <Button size="lg" onClick={() => void analyze()} disabled={cooling}>
                {cooling
                  ? fill(t.panel.cooldown, { m: minutesLeft(cooldownUntil!) })
                  : t.panel.analyze}
              </Button>
            )}
          </Card>
        ) : null}

        {analysis ? (
          <>
            <div className={styles.updatedRow}>
              <p className={styles.updated}>
                {lastUpdated
                  ? `${t.panel.lastUpdated}: ${fmtDateTime(lastUpdated, locale)}`
                  : t.panel.summaryTitle}
              </p>
              {collectMode ? (
                <LinkButton href={href(locale, 'collect')} variant="outlineAccent" size="sm">
                  <Icon name="refresh" size={15} strokeWidth={2} />
                  <span>{t.panel.reanalyze}</span>
                </LinkButton>
              ) : (
              <Button
                variant="outlineAccent"
                size="sm"
                onClick={() => void analyze()}
                disabled={analyzing || cooling}
              >
                {analyzing ? (
                  <Spinner size={14} />
                ) : (
                  <Icon name="refresh" size={15} strokeWidth={2} />
                )}
                <span>
                  {cooling
                    ? fill(t.panel.cooldown, { m: minutesLeft(cooldownUntil!) })
                    : t.panel.reanalyze}
                </span>
              </Button>
              )}
            </div>

            {error ? (
              <Notice tone="danger" title={t.common.errorTitle} role="alert">
                {error}
              </Notice>
            ) : null}

            {blocked ? (
              <Notice tone="warning" role="status">
                {fill(t.panel.blockedNotice, { m: minutesLeft(blockedUntil!) })}
              </Notice>
            ) : null}

            {collectMode ? (
              <Notice tone="info" title={t.collect.limitsTitle}>
                {t.collect.limitsBody}
              </Notice>
            ) : null}

            <div className={styles.cards}>
              {summary.map((card) => (
                <SummaryCard
                  key={card.kind}
                  count={
                    card.kind === 'mutuals'
                      ? analysis.mutualsCount
                      : usersFor(analysis, card.kind).length
                  }
                  title={card.title}
                  hint={card.hint}
                  tone={card.tone}
                  icon={card.icon}
                  locale={locale}
                  selected={tab === card.kind}
                  onClick={() => openTab(card.kind)}
                />
              ))}
            </div>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>{t.panel.historyTitle}</h2>
              {analysis.hasHistory ? (
                <div className={styles.cards}>
                  {history.map((card) => (
                    <SummaryCard
                      key={card.kind}
                      count={usersFor(analysis, card.kind).length}
                      title={card.title}
                      hint={card.hint}
                      tone={card.tone}
                      icon={card.icon}
                      locale={locale}
                      selected={tab === card.kind}
                      onClick={() => openTab(card.kind)}
                    />
                  ))}
                </div>
              ) : (
                <Notice tone="info" title={t.panel.firstRunTitle}>
                  {t.panel.firstRunBody}
                </Notice>
              )}
            </section>

            <section className={styles.section} id="lists">
              <Tabs
                items={tabs}
                value={tab}
                onChange={setTab}
                label={t.panel.tabsLabel}
                locale={locale}
                controls="list-panel"
              />
              <div id="list-panel" role="tabpanel" aria-label={t.panel.tabs[tab]}>
                <UserList
                  key={`${tab}-${version}`}
                  kind={tab}
                  users={usersFor(analysis, tab)}
                  locale={locale}
                  t={t}
                  followingPks={followingPks}
                  blocked={blocked || collectMode}
                  detailsEnabled={
                    !analyzing &&
                    (platform().lists[tab].stats || platform().lists[tab].refreshAvatar)
                  }
                  onAction={runRowAction}
                  onThrottled={() => setBlockedUntil(Date.now() + THROTTLE_COOLDOWN_MS)}
                />
              </div>
            </section>
          </>
        ) : null}
      </main>
    </>
  );
}
