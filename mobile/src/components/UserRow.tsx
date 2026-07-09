import { Text, View, StyleSheet } from 'react-native';
import { Avatar } from './Avatar';
import { colors, spacing } from '../theme';
import type { User } from '../types';

// UserRow renders one account in a list: avatar, username (+ verified/private
// badges) and full name.
export function UserRow({ user }: { user: User }) {
  return (
    <View style={styles.row}>
      <Avatar uri={user.profilePicUrl} name={user.fullName || user.username} />
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
      </View>
    </View>
  );
}

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
});
