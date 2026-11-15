import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Header } from '../components/Header';
import { ProgressBar } from '../components/ProgressBar';
import { colors, radius, spacing } from '../theme';
import type { CollectionState } from '../collection';
import { collectionProgress, PHASE_LABEL } from '../collection';

type Props = {
  state: CollectionState;
  // Leave the screen; the collection keeps running at the app root.
  onBackground: () => void;
  // Give up on this run for good.
  onStop: () => void;
};

// A view of the running collection — it no longer owns it. Leaving does not
// cancel anything, which is the point: the lists take minutes to paginate and
// nobody should have to watch a spinner for them.
export function CollectScreen({ state, onBackground, onStop }: Props) {
  const { done, target, pct } = collectionProgress(state);

  return (
    <View style={styles.flex}>
      <Header title="Analiz" onBack={onBackground} />

      <View style={styles.body}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.phase}>
          {state.saving ? 'Sonuçlar hesaplanıyor…' : `${PHASE_LABEL[state.phase]} çekiliyor…`}
        </Text>
        <Text style={styles.count}>
          {target ? `${done} / ${target}` : String(done)}
          {pct != null ? `  ·  %${pct}` : ''}
        </Text>
        <ProgressBar pct={pct} />

        <Text style={styles.hint}>
          Listeler senin tarayıcı oturumunla, sayfa sayfa ve aralarında beklemeyle çekiliyor.
          Hesabının işaretlenmemesi için bu yavaşlık bilerek var.
        </Text>
        <Text style={styles.hint}>
          Bu ekranda beklemek zorunda değilsin — geri dönüp önceki sonuçlara bakabilirsin.
          Sadece uygulamayı kapatma: iOS, arka plandaki sayfayı durdurur.
        </Text>

        <TouchableOpacity style={styles.button} onPress={onBackground} activeOpacity={0.85}>
          <Text style={styles.buttonText}>Arka planda devam etsin</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancel} onPress={onStop}>
          <Text style={styles.cancelText}>Durdur</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  phase: { fontSize: 17, fontWeight: '700', color: colors.text },
  count: { fontSize: 15, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  hint: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginTop: spacing.sm,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancel: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg },
  cancelText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
});
