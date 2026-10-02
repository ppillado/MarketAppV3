import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  canAskAgain: boolean;
  onRetry: () => void;
  onOpenSettings: () => void;
};

export function LocationPermissionBanner({ canAskAgain, onRetry, onOpenSettings }: Props) {
  const theme = useTheme();

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Activa tu ubicación</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        La usamos solo para mostrarte precios en almacenes cercanos. Mientras tanto, verás el mapa
        del Gran Concepción.
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={canAskAgain ? onRetry : onOpenSettings}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.text },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="smallBold" style={{ color: theme.background }}>
          {canAskAgain ? 'Permitir ubicación' : 'Abrir Ajustes'}
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
  },
  button: {
    alignSelf: 'flex-start',
    marginTop: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
  },
  pressed: {
    opacity: 0.7,
  },
});
