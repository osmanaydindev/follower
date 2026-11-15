import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';

// A determinate bar when we know the target, an empty track when we don't —
// never a fake animation pretending to know how far along we are.
export function ProgressBar({ pct }: { pct: number | null }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct ?? 0}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
});
