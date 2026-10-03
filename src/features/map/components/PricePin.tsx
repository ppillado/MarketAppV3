import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatPrice } from '@/lib/format';
import type { Offer } from '@/types/offer';

type Props = {
  offer: Offer;
  selected: boolean;
  onPress: () => void;
};

/** Waze-style price bubble. Remount (via `key`) to restyle it. */
export function PricePin({ offer, selected, onPress }: Props) {
  const theme = useTheme();
  // Android snapshots custom marker views; keep tracking until the first render has painted,
  // then stop so the map doesn't re-render every pin on every frame.
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const background = selected ? theme.accent : theme.background;
  const foreground = selected ? theme.onAccent : theme.text;

  return (
    <Marker
      coordinate={offer.coords}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracksViewChanges}
      zIndex={selected ? 1 : 0}
      onPress={onPress}
      accessibilityLabel={`${offer.product}, ${formatPrice(offer.price)} pesos`}>
      <View style={styles.container}>
        <View style={[styles.bubble, { backgroundColor: background, borderColor: theme.accent }]}>
          <ThemedText style={[styles.price, { color: foreground }]}>
            ${formatPrice(offer.price)}
          </ThemedText>
        </View>
        <View style={[styles.pointer, { borderTopColor: theme.accent }]} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  bubble: {
    paddingHorizontal: Spacing.two + Spacing.half,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    borderWidth: 2,
  },
  price: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: 800,
  },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
