import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

type Props = {
  label: string;
  value: number;
  accent?: string;
  onPress?: () => void;
  hint?: string;
};

// StatCard is a tappable metric tile used on the dashboard.
export function StatCard({ label, value, accent = colors.text, onPress, hint }: Props) {
  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.value, { color: accent }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    minHeight: 96,
    justifyContent: 'center',
  },
  value: { fontSize: 28, fontWeight: '800' },
  label: { fontSize: 13, color: colors.text, marginTop: 2, fontWeight: '600' },
  hint: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
