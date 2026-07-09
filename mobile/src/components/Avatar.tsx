import { useState } from 'react';
import { Image, Text, View, StyleSheet } from 'react-native';
import { colors } from '../theme';

type Props = { uri?: string; name: string; size?: number };

// Avatar shows the profile picture, falling back to the first letter of the name
// on a colored circle when there's no image or it fails to load.
export function Avatar({ uri, name, size = 44 }: Props) {
  const [failed, setFailed] = useState(false);
  const dim = { width: size, height: size, borderRadius: size / 2 };

  if (uri && !failed) {
    return (
      <Image source={{ uri }} style={[styles.img, dim]} onError={() => setFailed(true)} />
    );
  }
  return (
    <View style={[styles.fallback, dim]}>
      <Text style={[styles.letter, { fontSize: size * 0.4 }]}>
        {(name?.trim()?.[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  img: { backgroundColor: colors.border },
  fallback: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { color: '#fff', fontWeight: '700' },
});
