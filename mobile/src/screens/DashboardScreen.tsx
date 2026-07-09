import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Avatar } from '../components/Avatar';
import { colors, radius, shadow, spacing } from '../theme';
import type { Analysis, Profile } from '../types';
import type { ListKind } from '../navigation';

type Props = {
  username: string;
  profile: Profile | null;
  analysis: Analysis | null;
  analyzing: boolean;
  error: string | null;
  lastUpdated: number | null;
  onAnalyze: () => void;
  onOpenList: (kind: ListKind) => void;
  onOpenProfileViewers: () => void;
  onLogout: () => void;
};

const fmt = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function formatDate(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function DashboardScreen({
  username,
  profile,
  analysis,
  analyzing,
  error,
  lastUpdated,
  onAnalyze,
  onOpenList,
  onOpenProfileViewers,
  onLogout,
}: Props) {
  const name = profile?.fullName || username;
  const followers = profile?.followersCount ?? analysis?.followersCount ?? 0;
  const following = profile?.followingCount ?? analysis?.followingCount ?? 0;

  // Follower/Following tiles open their list once analysis exists; otherwise a tap
  // kicks off the analysis (which is what produces the lists).
  const followersPress = analysis ? () => onOpenList('followers') : onAnalyze;
  const followingPress = analysis ? () => onOpenList('following') : onAnalyze;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      refreshControl={
        analysis ? (
          <RefreshControl refreshing={analyzing} onRefresh={onAnalyze} tintColor={colors.primary} />
        ) : undefined
      }
    >
      <View style={styles.topbar}>
        <Text style={styles.brand}>Follower</Text>
        <TouchableOpacity onPress={onLogout} hitSlop={10}>
          <Text style={styles.logout}>Çıkış</Text>
        </TouchableOpacity>
      </View>

      {/* profile header */}
      <View style={[styles.hero, shadow(1)]}>
        <View style={styles.ring}>
          <Avatar uri={profile?.profilePicUrl} name={name} size={80} />
        </View>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {profile?.isVerified && <Text style={styles.verified}>✓</Text>}
        </View>
        <Text style={styles.handle}>@{username}</Text>

        <View style={styles.statRow}>
          <StatCol label="Gönderi" value={profile?.mediaCount ?? 0} />
          <View style={styles.divider} />
          <StatCol label="Takipçi" value={followers} onPress={followersPress} />
          <View style={styles.divider} />
          <StatCol label="Takip" value={following} onPress={followingPress} />
        </View>
      </View>

      {/* pre-analysis CTA */}
      {!analysis && !analyzing && (
        <View style={[styles.card, shadow(1)]}>
          <Text style={styles.cardEmoji}>📊</Text>
          <Text style={styles.cardTitle}>İlişki analizi</Text>
          <Text style={styles.cardText}>
            Seni geri takip etmeyenleri, hayranlarını ve karşılıklı takipleşmeleri görmek için analizi başlat.
          </Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.cta} onPress={onAnalyze} activeOpacity={0.85}>
            <Text style={styles.ctaText}>Analiz Et</Text>
          </TouchableOpacity>
        </View>
      )}

      {analyzing && !analysis && (
        <View style={[styles.card, shadow(1)]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.cardTitle}>Analiz ediliyor…</Text>
          <Text style={styles.cardText}>
            Takipçilerin ve takip ettiklerin çekiliyor. Büyük hesaplarda bir-iki dakika sürebilir.
          </Text>
        </View>
      )}

      {/* results (stay visible even while re-analyzing) */}
      {analysis && (
        <>
          <View style={styles.updatedRow}>
            <Text style={styles.updated}>
              {lastUpdated != null ? `Son güncelleme: ${formatDate(lastUpdated)}` : ' '}
            </Text>
            <TouchableOpacity
              style={[styles.reanalyze, analyzing && styles.reanalyzeDisabled]}
              onPress={onAnalyze}
              disabled={analyzing}
              activeOpacity={0.85}
            >
              {analyzing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.reanalyzeText}>↻ Tekrar analiz et</Text>
              )}
            </TouchableOpacity>
          </View>

          <BigCard
            count={analysis.mutualsCount}
            title="Karşılıklı takipleşme"
            hint="Birbirinizi takip edenler"
            tint={colors.successTint}
            accent={colors.success}
            onPress={() => onOpenList('mutuals')}
          />
          <BigCard
            count={analysis.notFollowingBack.length}
            title="Geri takip etmeyenler"
            hint="Takip ettiğin ama seni takip etmeyenler"
            tint={colors.dangerTint}
            accent={colors.danger}
            onPress={() => onOpenList('notFollowingBack')}
          />
          <BigCard
            count={analysis.fans.length}
            title="Hayranların"
            hint="Seni takip eden ama senin etmediklerin"
            tint={colors.accentTint}
            accent={colors.accent}
            onPress={() => onOpenList('fans')}
          />

          <Text style={styles.section}>Geçen sefere göre değişim</Text>
          {analysis.hasHistory ? (
            <>
              <BigCard
                count={analysis.unfollowed.length}
                title="Takipten çıkanlar"
                hint="Son analizden bu yana seni bırakanlar"
                tint={colors.dangerTint}
                accent={colors.danger}
                onPress={() => onOpenList('unfollowed')}
              />
              <BigCard
                count={analysis.newFollowers.length}
                title="Yeni takipçiler"
                hint="Son analizden bu yana takip edenler"
                tint={colors.successTint}
                accent={colors.success}
                onPress={() => onOpenList('newFollowers')}
              />
            </>
          ) : (
            <Text style={styles.historyNote}>
              İlk analiz kaydedildi 📌 "Takipten çıkanlar" ve "yeni takipçiler" bir sonraki
              analizden itibaren burada görünecek.
            </Text>
          )}

          <TouchableOpacity
            style={[styles.infoCard, shadow(1)]}
            onPress={onOpenProfileViewers}
            activeOpacity={0.85}
          >
            <Text style={styles.infoEmoji}>👁️</Text>
            <View style={styles.flex}>
              <Text style={styles.bigTitle}>Profilime kim baktı?</Text>
              <Text style={styles.bigHint}>Bunu neden hiçbir uygulama gösteremez ›</Text>
            </View>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

function StatCol({
  label,
  value,
  onPress,
}: {
  label: string;
  value: number;
  onPress?: () => void;
}) {
  const Wrap: any = onPress ? TouchableOpacity : View;
  return (
    <Wrap style={styles.statCol} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.statValue}>{fmt(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Wrap>
  );
}

function BigCard({
  count,
  title,
  hint,
  tint,
  accent,
  onPress,
}: {
  count: number;
  title: string;
  hint: string;
  tint: string;
  accent: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.bigCard, shadow(1)]} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.badge, { backgroundColor: tint }]}>
        <Text style={[styles.badgeText, { color: accent }]}>{fmt(count)}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.bigTitle}>{title}</Text>
        <Text style={styles.bigHint}>{hint} ›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontSize: 22, fontWeight: '800', color: colors.primary, letterSpacing: -0.5 },
  logout: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },

  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  ring: {
    padding: 3,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: colors.primary,
    marginBottom: spacing.md,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, maxWidth: '100%' },
  name: { fontSize: 20, fontWeight: '800', color: colors.text, flexShrink: 1 },
  verified: { color: colors.accent, fontSize: 15, fontWeight: '800' },
  handle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },

  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
  statCol: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.xs },
  statValue: { fontSize: 19, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  divider: { width: 1, height: 32, backgroundColor: colors.border },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardEmoji: { fontSize: 40 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  cardText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    marginTop: spacing.sm,
    ...shadow(2),
  },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '800' },

  updatedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  updated: { fontSize: 12, color: colors.textMuted, flexShrink: 1 },
  reanalyze: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 132,
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
  },
  reanalyzeDisabled: { opacity: 0.6 },
  reanalyzeText: { color: colors.primary, fontSize: 13, fontWeight: '800' },

  section: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  historyNote: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },

  bigCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  badge: {
    minWidth: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  badgeText: { fontSize: 20, fontWeight: '800' },
  bigTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  bigHint: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  infoEmoji: { fontSize: 28, minWidth: 56, textAlign: 'center' },
});
