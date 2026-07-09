import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Header } from '../components/Header';
import { colors, radius, spacing } from '../theme';

// Honest explainer: "who viewed my profile" data does not exist. We never fake
// it. This screen builds trust by telling the user the truth.
export function ProfileViewersScreen({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.flex}>
      <Header title="Profilime kim baktı?" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.emoji}>🕵️‍♀️</Text>
        <Text style={styles.title}>Bunu kimse gösteremez</Text>
        <Text style={styles.body}>
          Instagram, profilinize kimin baktığı bilgisini <Text style={styles.bold}>hiçbir yerde</Text> paylaşmaz:
        </Text>

        <View style={styles.card}>
          <Text style={styles.item}>• Resmi API'de yok</Text>
          <Text style={styles.item}>• "Bilgilerini indir" verisinde yok</Text>
          <Text style={styles.item}>• Gizli mobil API'de bile yok</Text>
        </View>

        <Text style={styles.body}>
          "Profiline kim baktı" diyen uygulamalar ya rastgele isim uydurur ya da
          şifreni çalmaya çalışır. Biz sana{' '}
          <Text style={styles.bold}>gerçek olmayan bir şey göstermeyeceğiz</Text>.
        </Text>

        <Text style={styles.footer}>
          Gösterebildiğimiz şey gerçek: takipçilerin, takip ettiklerin, seni geri takip
          etmeyenler ve hayranların.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, alignItems: 'center' },
  emoji: { fontSize: 56, marginBottom: spacing.md },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: spacing.lg, textAlign: 'center' },
  body: { fontSize: 15, color: colors.text, lineHeight: 22, textAlign: 'center', marginBottom: spacing.lg },
  bold: { fontWeight: '800' },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  item: { fontSize: 15, color: colors.text },
  footer: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.md,
  },
});
