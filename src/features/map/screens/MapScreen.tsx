import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useUserLocation } from '@/features/location/LocationProvider';
import { OfferCard } from '@/features/offers/components/OfferCard';
import { useOffers } from '@/features/offers/hooks/useOffers';
import { useTheme } from '@/hooks/use-theme';

import { LocationPermissionBanner } from '../components/LocationPermissionBanner';
import { PriceMap } from '../components/PriceMap';
import type { PriceMapHandle } from '../components/PriceMap.types';

export default function MapScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<PriceMapHandle>(null);
  const location = useUserLocation();
  const hasCentered = useRef(false);
  const { offers, withDistance } = useOffers();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const selected = withDistance.find(({ offer }) => offer.id === selectedId) ?? null;

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
        offers={offers}
        selectedOfferId={selectedId}
        onSelectOffer={(offer) => setSelectedId(offer?.id ?? null)}
      />

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

        {location.error && (
          <ThemedView type="backgroundElement" style={styles.errorCard}>
            <ThemedText type="small">{location.error}</ThemedText>
          </ThemedView>
        )}

        {selected && (
          <OfferCard offer={selected.offer} distanceMeters={selected.distanceMeters} now={now} />
        )}

        {location.denied && !selected && (
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
