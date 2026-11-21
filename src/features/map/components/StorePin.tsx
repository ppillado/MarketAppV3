import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Store } from '@/types/store';

type Props = {
  store: Store;
  onPress: () => void;
};

const BUBBLE_SIZE = 40;
const BADGE_SIZE = 22;

/** Store pin: storefront bubble with a badge counting its current offers. Remount (via `key`) to restyle it. */
export function StorePin({ store, onPress }: Props) {
  const theme = useTheme();
  // Android snapshots custom marker views; keep tracking until the first render has painted,
  // then stop so the map doesn't re-render every pin on every frame.
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const count = store.activeOffersCount;

  return (
    <Marker
      coordinate={store.coords}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracksViewChanges}
      onPress={onPress}
      accessibilityLabel={`${store.name}, ${count} ${count === 1 ? 'oferta' : 'ofertas'}`}>
      {/* Padding leaves room for the badge, which overflows the bubble's corner. */}
      <View style={styles.container}>
        <View
          style={[styles.bubble, { backgroundColor: theme.background, borderColor: theme.accent }]}>
          <SymbolView
            name={{ ios: 'storefront.fill', android: 'storefront', web: 'storefront' }}
            tintColor={theme.accent}
            size={20}
          />
        </View>
        <View style={[styles.pointer, { borderTopColor: theme.accent }]} />

        <View
          style={[styles.badge, { backgroundColor: theme.accent, borderColor: theme.background }]}>
          <ThemedText style={[styles.badgeText, { color: theme.onAccent }]}>
            {count > 99 ? '99+' : count}
          </ThemedText>
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: BADGE_SIZE / 2,
    paddingHorizontal: BADGE_SIZE / 2,
  },
  bubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
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
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    paddingHorizontal: Spacing.one,
    borderRadius: BADGE_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
});
