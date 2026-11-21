import { useImperativeHandle, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import MapView, { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';

import { useColorScheme } from '@/hooks/use-color-scheme';

import { GRAN_CONCEPCION_REGION, USER_REGION_DELTA, type MapRegion } from '../constants';
import { useStoreClusters } from '../hooks/useStoreClusters';
import { ClusterPin } from './ClusterPin';
import type { PriceMapProps } from './PriceMap.types';
import { StorePin } from './StorePin';

// Google Maps on Android, Apple Maps on iOS (no iOS Google key needed).
const MAP_PROVIDER = Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;

export function PriceMap({
  ref,
  showsUserLocation,
  stores,
  topInset = 0,
  onSelectStore,
}: PriceMapProps) {
  const mapRef = useRef<MapView>(null);
  const scheme = useColorScheme();
  const [region, setRegion] = useState<MapRegion>(GRAN_CONCEPCION_REGION);
  const { items, expansionDelta } = useStoreClusters(stores, region);

  const animateTo = (region: MapRegion) => mapRef.current?.animateToRegion(region, 600);

  useImperativeHandle(ref, () => ({
    centerOn: ({ latitude, longitude }) =>
      animateTo({
        latitude,
        longitude,
        latitudeDelta: USER_REGION_DELTA,
        longitudeDelta: USER_REGION_DELTA,
      }),
  }));

  return (
    <MapView
      ref={mapRef}
      provider={MAP_PROVIDER}
      style={StyleSheet.absoluteFill}
      initialRegion={GRAN_CONCEPCION_REGION}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      // Native controls (compass) stay below the floating category bar.
      mapPadding={{ top: topInset, right: 0, bottom: 0, left: 0 }}
      onRegionChangeComplete={setRegion}>
      {items.map((item) => {
        if (item.kind === 'cluster') {
          return (
            <ClusterPin
              // Custom marker views are snapshotted, so remount to restyle on count/theme change.
              key={`cluster-${item.id}-${item.count}-${scheme}`}
              coords={item.coords}
              count={item.count}
              onPress={() => {
                // Zoom in just enough for this group to split apart.
                const delta = expansionDelta(item.id);
                animateTo({ ...item.coords, latitudeDelta: delta, longitudeDelta: delta });
              }}
            />
          );
        }
        return (
          <StorePin
            key={`${item.store.id}-${item.store.activeOffersCount}-${scheme}`}
            store={item.store}
            onPress={() => onSelectStore(item.store)}
          />
        );
      })}
    </MapView>
  );
}
