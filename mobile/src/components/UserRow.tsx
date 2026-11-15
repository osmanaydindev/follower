import { ActivityIndicator, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Avatar } from './Avatar';
import { colors, radius, spacing } from '../theme';
import { actionDoneLabels, actionLabels, type RowAction } from '../navigation';
import type { User, UserDetail } from '../types';

type Props = {
  user: User;
  // Loaded lazily for the rows on screen; adds counts and a fresh picture URL.
  detail?: UserDetail;
  // The detail request came back empty-handed — say so instead of leaving the
  // row claiming it is still loading.
  detailFailed?: boolean;
  showStats?: boolean;
  action?: RowAction | null;
  // Shown in the button's place when there is no action to offer, so an empty
  // slot reads as an explanation instead of a missing feature.
  note?: string;
  busy?: boolean;
  done?: boolean;
  onAction?: () => void;
};

// UserRow renders one account in a list: avatar, username (+ verified/private
// badges), full name, optionally that account's counts, and the action button
// that fits the list it appears in (unfollow / remove follower).
export function UserRow({
  user,
  detail,
  detailFailed,
  showStats,
  action,
  note,
  busy,
  done,
  onAction,
}: Props) {
  // Prefer the freshly-fetched picture: snapshot URLs expire and would otherwise
  // fall back to a blank letter avatar.
  const picUrl = detail?.profilePicUrl || user.profilePicUrl;

  return (
    <View style={styles.row}>
      <Avatar uri={picUrl} name={user.fullName || user.username} />
      <View style={styles.info}>
        <View style={styles.line}>
          <Text style={styles.username} numberOfLines={1}>
            @{user.username}
          </Text>
          {user.isVerified && <Text style={styles.badge}>✓</Text>}
          {user.isPrivate && <Text style={styles.private}>🔒</Text>}
        </View>
        {!!user.fullName && (
          <Text style={styles.fullName} numberOfLines={1}>
            {user.fullName}
          </Text>
        )}
        {showStats && (
          <Text style={styles.stats} numberOfLines={1}>
            {detail
              ? `${compact(detail.mediaCount)} gönderi · ${compact(detail.followersCount)} takipçi · ${compact(detail.followingCount)} takip`
              : detailFailed
                ? 'sayılar alınamadı'
                : 'yükleniyor…'}
          </Text>
        )}
      </View>

      {!action && !!note && <Text style={styles.note}>{note}</Text>}

      {action && (
        <TouchableOpacity
          style={[styles.action, done && styles.actionDone]}
          onPress={onAction}
          disabled={busy || done}
          activeOpacity={0.8}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.danger} />
          ) : (
            <Text style={[styles.actionText, done && styles.actionDoneText]}>
              {done ? `✓ ${actionDoneLabels[action]}` : actionLabels[action]}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

// Compact Turkish number: 1.234 → "1,2B", 45.600 → "46B", 2.100.000 → "2,1M".
function compact(n: number): string {
  if (n >= 1_000_000) return trim((n / 1_000_000).toFixed(1)) + 'M';
  if (n >= 10_000) return String(Math.round(n / 1000)) + 'B';
  if (n >= 1_000) return trim((n / 1000).toFixed(1)) + 'B';
  return String(n);
}

const trim = (s: string) => s.replace(/\.0$/, '').replace('.', ',');

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  info: { flex: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  username: { fontSize: 15, fontWeight: '600', color: colors.text, flexShrink: 1 },
  badge: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  private: { fontSize: 11 },
  fullName: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  stats: { fontSize: 11.5, color: colors.textMuted, marginTop: 3 },
  note: { fontSize: 11.5, color: colors.textMuted, maxWidth: 96, textAlign: 'right' },

  action: {
    minWidth: 96,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.danger,
    backgroundColor: colors.dangerTint,
  },
  actionText: { color: colors.danger, fontSize: 12, fontWeight: '800' },
  actionDone: { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  actionDoneText: { color: colors.textMuted },
});
