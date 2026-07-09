import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../api';
import { colors, radius, spacing } from '../theme';
import type { LoginResponse } from '../types';

type Props = {
  sessionId: string;
  username: string;
  onVerified: (r: LoginResponse) => void;
  onCancel: () => void;
};

// ChallengeScreen handles Instagram's checkpoint / 2FA verification code step.
export function ChallengeScreen({ sessionId, username, onVerified, onCancel }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const r = await api.challenge(sessionId, code.trim());
      onVerified(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Doğrulama başarısız');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Doğrulama gerekli</Text>
      <Text style={styles.subtitle}>
        {username} için Instagram bir güvenlik kodu istedi. Uygulamana / e-postana / SMS'ine
        gelen kodu gir.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Doğrulama kodu"
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        value={code}
        onChangeText={setCode}
        autoFocus
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, (loading || !code.trim()) && styles.buttonDisabled]}
        onPress={submit}
        disabled={loading || !code.trim()}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Doğrula</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={onCancel} style={styles.cancel}>
        <Text style={styles.cancelText}>İptal</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.xl, lineHeight: 20 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 20,
    letterSpacing: 4,
    textAlign: 'center',
    color: colors.text,
  },
  error: { color: colors.danger, fontSize: 14, marginTop: spacing.md },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancel: { alignItems: 'center', marginTop: spacing.lg },
  cancelText: { color: colors.textMuted, fontSize: 15 },
});
