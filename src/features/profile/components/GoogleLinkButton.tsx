import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Google's sign-in button branding: neutral light/dark variants with the official "G" logo.
// https://developers.google.com/identity/branding-guidelines
const GOOGLE_BUTTON = {
  light: { background: '#FFFFFF', border: '#747775', text: '#1F1F1F' },
  dark: { background: '#131314', border: '#8E918F', text: '#E3E3E3' },
} as const;

type Props = {
  onPress: () => void;
  loading: boolean;
};

export function GoogleLinkButton({ onPress, loading }: Props) {
  const scheme = useColorScheme();
  const colors = GOOGLE_BUTTON[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Vincular cuenta con Google"
      accessibilityState={{ busy: loading, disabled: loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.background, borderColor: colors.border },
        pressed && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <>
          <Image
            source={require('@/assets/images/brands/google-g.png')}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={[styles.label, { color: colors.text }]}>Vincular cuenta con Google</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: 999,
    borderWidth: 1,
  },
  logo: {
    width: 20,
    height: 20,
  },
  label: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 600,
  },
  pressed: {
    opacity: 0.8,
  },
});
