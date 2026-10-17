import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Header } from '../components/Header';
import { UserRow } from '../components/UserRow';
import { api } from '../api';
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
  // Reports a completed action so the cached analysis (and the dashboard counts)
  // stay in sync without re-hitting Instagram.
  onApplied: (user: User, action: RowAction) => void;
  onBack: () => void;
};

// ListScreen displays a pre-fetched list (from the cached analysis) with a
// client-side search — no network for the list itself, so it opens instantly.
// The only network calls it makes are per-row: lazily loading the counts/picture
// of visible rows, and the unfollow / remove-follower actions.
export function ListScreen({ kind, sessionId, users, followingPks, onApplied, onBack }: Props) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});

  const config = listConfig[kind];
  const { details, request } = useUserDetails(sessionId, config.stats || config.refreshAvatar);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.username.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q),
    );
  }, [users, query]);

  async function run(user: User, action: RowAction) {
    setBusy((b) => ({ ...b, [user.pk]: true }));
    try {
      if (action === 'unfollow') await api.unfollow(sessionId, user.pk);
      else await api.removeFollower(sessionId, user.pk);
      setDone((d) => ({ ...d, [user.pk]: true }));
      onApplied(user, action);
    } catch (e) {
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
      requestRef.current(viewableItems.map((v) => v.item.pk));
    },
  ).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 10 }).current;

  const renderItem = useCallback(
    ({ item }: { item: User }) => {
      // On the "unfollowed" list only the accounts I still follow can be unfollowed.
      // (keep it after the action too, so the row can show the "done" state)
      const actionable =
        !config.actionNeedsFollowing || followingPks.has(item.pk) || done[item.pk];
      return (
        <UserRow
          user={item}
          detail={details[item.pk]}
          showStats={config.stats}
          action={actionable ? config.action : null}
          busy={busy[item.pk]}
          done={done[item.pk]}
          onAction={() => confirm(item, config.action)}
        />
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [details, busy, done, followingPks, config],
  );

  return (
    <View style={styles.flex}>
      <Header title={listTitles[kind]} onBack={onBack} />

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder={`Ara · ${users.length} kişi`}
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
        extraData={{ details, busy, done, followingPks }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={filtered.length === 0 ? styles.emptyWrap : styles.listContent}
        ListEmptyComponent={
          <Text style={styles.empty}>{query ? 'Eşleşen kimse yok' : 'Kimse yok 🎉'}</Text>
        }
        keyboardShouldPersistTaps="handled"
      />
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
