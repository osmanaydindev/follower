import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Header } from '../components/Header';
import { UserRow } from '../components/UserRow';
import { api, isThrottled, THROTTLE_COOLDOWN_MS } from '../api';
import { IgBridge, igCall, igWhenReady, IgError } from '../igBridge';
import { useUserDetails } from '../useUserDetails';
import { colors, radius, spacing } from '../theme';
import { actionLabels, listConfig, listTitles, type ListKind, type RowAction } from '../navigation';
import type { User } from '../types';

type Props = {
  kind: ListKind;
  sessionId: string;
  users: User[];
  // The accounts I currently follow — decides whether an "unfollow" button makes
  // sense on the snapshot-derived "unfollowed" list.
  followingPks: Set<string>;
  // A collection is paginating the lists right now. Two Instagram browsers
  // making requests at once is the opposite of the pacing discipline, so the
  // row bridge stands down until it finishes.
  collecting: boolean;
  // Reports a completed action so the cached analysis (and the dashboard counts)
  // stay in sync without re-hitting Instagram.
  onApplied: (user: User, action: RowAction) => void;
  onBack: () => void;
};

// ListScreen displays a pre-fetched list (from the cached analysis) with a
// client-side search — no network for the list itself, so it opens instantly.
// The only network calls it makes are per-row: lazily loading the counts/picture
// of visible rows, and the unfollow / remove-follower actions.
export function ListScreen({
  kind,
  sessionId,
  users,
  followingPks,
  collecting,
  onApplied,
  onBack,
}: Props) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});
  // Instagram blocked a write. Every further attempt deepens the block, so the
  // buttons go away until it passes rather than inviting the next tap.
  const [blockedUntil, setBlockedUntil] = useState(0);
  const blocked = blockedUntil > Date.now();

  const config = listConfig[kind];
  const { details, failed, request } = useUserDetails(
    sessionId,
    !collecting && (config.stats || config.refreshAvatar),
  );

  // The cached analysis drops an account the instant its action succeeds, so the
  // row would vanish from under the finger that pressed it. Freeze the list for
  // this visit: the row stays put and turns into "✓ Çıkıldı". Re-opening the
  // screen picks up the updated analysis.
  const [rows] = useState(users);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (u) => u.username.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q),
    );
  }, [rows, query]);

  async function run(user: User, action: RowAction) {
    setBusy((b) => ({ ...b, [user.pk]: true }));
    try {
      // Wait for the bridge rather than race it: pressed in the first seconds
      // after the screen opens, this used to fall through to the server path and
      // come back 429 — the one call Instagram reliably refuses.
      if (await igWhenReady()) {
        // The page acts on its own account. Our server-side version of this call
        // is the one Instagram refuses — a first-ever unfollow came back 429.
        await igCall(action === 'unfollow' ? 'unfollow' : 'removeFollower', { pk: user.pk });
        // The browser did the deed, so the backend still has to be told: a
        // follower I removed myself must not resurface as "unfollowed you".
        if (action === 'removeFollower') {
          api.snapshotForget(sessionId, user.pk).catch(() => {});
        }
      } else if (action === 'unfollow') {
        await api.unfollow(sessionId, user.pk);
      } else {
        await api.removeFollower(sessionId, user.pk);
      }
      setDone((d) => ({ ...d, [user.pk]: true }));
      onApplied(user, action);
    } catch (e) {
      if (isThrottled(e) || (e instanceof IgError && e.status === 429)) {
        setBlockedUntil(Date.now() + THROTTLE_COOLDOWN_MS);
      }
      Alert.alert('Olmadı', e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setBusy((b) => ({ ...b, [user.pk]: false }));
    }
  }

  // Both actions are visible to the other account (or at least hard to undo
  // silently), so always confirm first.
  function confirm(user: User, action: RowAction) {
    Alert.alert(
      actionLabels[action],
      action === 'unfollow'
        ? `@${user.username} hesabını takip etmeyi bırakacaksın.`
        : `@${user.username} artık seni takip etmeyecek. Takipçilerinden çıkarılsın mı?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: actionLabels[action], style: 'destructive', onPress: () => run(user, action) },
      ],
    );
  }

  // FlatList requires a stable onViewableItemsChanged identity, so keep the
  // latest request function in a ref behind a callback that never changes.
  const requestRef = useRef(request);
  requestRef.current = request;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: User }> }) => {
      requestRef.current(viewableItems.map((v) => v.item));
    },
  ).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 10 }).current;

  const renderItem = useCallback(
    ({ item }: { item: User }) => {
      // On the "unfollowed" list only the accounts I still follow can be unfollowed.
      // (keep it after the action too, so the row can show the "done" state)
      const actionable =
        !collecting &&
        !blocked &&
        (!config.actionNeedsFollowing || followingPks.has(item.pk) || done[item.pk]);
      return (
        <UserRow
          user={item}
          detail={details[item.pk]}
          detailFailed={failed[item.pk]}
          showStats={config.stats}
          action={actionable ? config.action : null}
          // Why a row offers no action: either the analysis is using the
          // browser right now, or they left and I was never following them
          // back, so there is nothing left to undo.
          note={
            collecting
              ? 'Analiz sürüyor'
              : blocked
                ? 'Instagram engelledi'
                : config.actionNeedsFollowing
                  ? 'Zaten takip etmiyorsun'
                  : undefined
          }
          busy={busy[item.pk]}
          done={done[item.pk]}
          onAction={() => confirm(item, config.action)}
        />
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [details, failed, busy, done, followingPks, config, collecting, blocked],
  );

  return (
    <View style={styles.flex}>
      <Header title={listTitles[kind]} onBack={onBack} />

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder={`Ara · ${rows.length} kişi`}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(u) => u.pk}
        renderItem={renderItem}
        // Rows change for reasons outside `data` (a detail arrived, a button is
        // busy/done), so tell the virtualized list to re-render them.
        extraData={{ details, failed, busy, done, followingPks, collecting, blocked }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={filtered.length === 0 ? styles.emptyWrap : styles.listContent}
        ListEmptyComponent={
          <Text style={styles.empty}>{query ? 'Eşleşen kimse yok' : 'Kimse yok 🎉'}</Text>
        }
        keyboardShouldPersistTaps="handled"
      />

      {/* The signed-in Instagram browser the row actions and picture refreshes
          go through. Mounted here because this is the only screen that needs it,
          so no page loads happen in the background elsewhere — and never while a
          collection is already using a browser of its own. */}
      {!collecting && <IgBridge />}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  searchWrap: { padding: spacing.md, paddingBottom: spacing.sm },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  listContent: { paddingBottom: spacing.xl },
  emptyWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  empty: { color: colors.textMuted, fontSize: 15 },
  sep: { height: 1, backgroundColor: colors.border, marginLeft: 72 },
});
