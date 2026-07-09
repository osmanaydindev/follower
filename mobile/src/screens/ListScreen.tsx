import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Header } from '../components/Header';
import { UserRow } from '../components/UserRow';
import { colors, radius, spacing } from '../theme';
import { listTitles, type ListKind } from '../navigation';
import type { User } from '../types';

type Props = { kind: ListKind; users: User[]; onBack: () => void };

// ListScreen just displays a pre-fetched list (from the cached analysis) with a
// client-side search — no network, so it opens instantly.
export function ListScreen({ kind, users, onBack }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.username.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q),
    );
  }, [users, query]);

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
        renderItem={({ item }) => <UserRow user={item} />}
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
