import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryChips } from '@/components/category-chips';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getCategoryLabel, type OfferCategory } from '@/constants/categories';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useUserLocation } from '@/features/location/LocationProvider';
import { useStoresStore } from '@/features/stores/StoresProvider';
import { useTheme } from '@/hooks/use-theme';

import { LocationPermissionBanner } from '../components/LocationPermissionBanner';
import { PriceMap } from '../components/PriceMap';
import type { PriceMapHandle } from '../components/PriceMap.types';

/** Height of the floating category bar (chip + vertical margin), used to pad the map controls. */
const CATEGORY_BAR_HEIGHT = 48;

export default function MapScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<PriceMapHandle>(null);
  const location = useUserLocation();
  const hasCentered = useRef(false);
  const { stores } = useStoresStore();
  const [category, setCategory] = useState<OfferCategory | null>(null);

  // Only stores with a current offer in the chosen category (store.categories comes from
  // nearby_stores, so this works instantly and from the offline cache).
  const visibleStores = useMemo(
    () => (category ? stores.filter((store) => store.categories.includes(category)) : stores),
    [stores, category],
  );

  // Center on the user the first time we get a fix; afterwards the user controls the camera.
  useEffect(() => {
    if (location.coords && !hasCentered.current) {
      hasCentered.current = true;
      mapRef.current?.centerOn(location.coords);
    }
  }, [location.coords]);

  const onLocatePress = () => {
    if (location.coords) mapRef.current?.centerOn(location.coords);
    location.refreshPosition();
  };

  return (
    <View style={styles.container}>
      <PriceMap
        ref={mapRef}
        showsUserLocation={location.granted}
        stores={visibleStores}
        topInset={insets.top + CATEGORY_BAR_HEIGHT}
        onSelectStore={(store) =>
          router.push({
            pathname: '/store/[id]',
            // The store sheet opens on the same category filter (it can switch to "Todas").
            params: category ? { id: store.id, category } : { id: store.id },
          })
        }
      />

      <View pointerEvents="box-none" style={[styles.topBar, { paddingTop: insets.top + Spacing.two }]}>
        <CategoryChips
          value={category}
          onChange={setCategory}
          allLabel="Todas"
          floating
          accessibilityLabel="Filtrar locales por categoría"
          contentContainerStyle={styles.topBarChips}
        />
      </View>

      <View
        pointerEvents="box-none"
        style={[
          styles.overlay,
          { paddingBottom: insets.bottom + BottomTabInset + Spacing.three },
        ]}>
        {location.granted && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Centrar en mi ubicación"
            onPress={onLocatePress}
            style={({ pressed }) => [
              styles.locateButton,
              { backgroundColor: theme.background },
              pressed && styles.pressed,
            ]}>
            <SymbolView
              name={{ ios: 'location.fill', android: 'my_location', web: 'my_location' }}
              tintColor={theme.text}
              size={22}
            />
          </Pressable>
        )}

        {category && stores.length > 0 && visibleStores.length === 0 && (
          <ThemedView type="backgroundElement" style={styles.errorCard}>
            <ThemedText type="small">
              No hay locales con ofertas vigentes de {getCategoryLabel(category)}.
            </ThemedText>
          </ThemedView>
        )}

        {location.error && (
          <ThemedView type="backgroundElement" style={styles.errorCard}>
            <ThemedText type="small">{location.error}</ThemedText>
          </ThemedView>
        )}

        {location.denied && (
          <LocationPermissionBanner
            canAskAgain={location.canAskAgain}
            onRetry={location.request}
            onOpenSettings={location.openSettings}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topBarChips: {
    paddingHorizontal: Spacing.three,
    // Room for the chip shadows, which a ScrollView would otherwise clip.
    paddingVertical: Spacing.one,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  locateButton: {
    alignSelf: 'flex-end',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
  },
  errorCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
