import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { Coords } from '@/types/geo';

type Props = {
  coords: Coords;
  count: number;
  onPress: () => void;
};

/** Círculo numerado para un grupo de ofertas cercanas. Se vuelve a montar (vía `key`) para cambiar su estilo. */
export function ClusterPin({ coords, count, onPress }: Props) {
  const theme = useTheme();
  // Mismo manejo de snapshots de Android que en PricePin.
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Crece suavemente con el tamaño del grupo: 40 px para 2 ofertas, con un máximo de 60 px.
  const size = Math.min(60, 36 + Math.log2(count) * 6);

  return (
    <Marker
      coordinate={coords}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
      onPress={onPress}
      accessibilityLabel={`${count} ofertas en esta zona. Toca para acercar.`}>
      <View
        style={[
          styles.halo,
          { width: size + 10, height: size + 10, borderRadius: (size + 10) / 2 },
          { backgroundColor: `${theme.accent}40` },
        ]}>
        <View
          style={[
            styles.circle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: theme.accent,
              borderColor: theme.background,
            },
          ]}>
          <ThemedText style={[styles.count, { color: theme.onAccent }]}>{count}</ThemedText>
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  halo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  count: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: 800,
  },
});
