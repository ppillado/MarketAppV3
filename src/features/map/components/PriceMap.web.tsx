import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

import type { PriceMapProps } from './PriceMap.types';

/** react-native-maps no funciona en web; por ahora el mapa es solo para celular. */
export function PriceMap(_props: PriceMapProps) {
  return (
    <ThemedView type="backgroundElement" style={styles.container}>
      <ThemedText type="smallBold">Mapa disponible en la app móvil</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Abre MarketApp en Android o iOS para ver los almacenes cercanos.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
});
