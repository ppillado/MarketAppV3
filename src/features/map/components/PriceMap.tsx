import { useImperativeHandle, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import MapView, { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';

import { useColorScheme } from '@/hooks/use-color-scheme';

import { GRAN_CONCEPCION_REGION, USER_REGION_DELTA, type MapRegion } from '../constants';
import { useOfferClusters } from '../hooks/useOfferClusters';
import { ClusterPin } from './ClusterPin';
import type { PriceMapProps } from './PriceMap.types';
import { PricePin } from './PricePin';

// Google Maps on Android, Apple Maps on iOS (no iOS Google key needed).
const MAP_PROVIDER = Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;

export function PriceMap({
  ref,
  showsUserLocation,
  offers,
  selectedOfferId,
  onSelectOffer,
}: PriceMapProps) {
  const mapRef = useRef<MapView>(null);
  const scheme = useColorScheme();
  const [region, setRegion] = useState<MapRegion>(GRAN_CONCEPCION_REGION);
  const { items, expansionDelta } = useOfferClusters(offers, region);

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
      onRegionChangeComplete={setRegion}
      onPress={(event) => {
        // iOS also reports marker taps here; only a tap on empty map deselects.
        if (event.nativeEvent.action !== 'marker-press') onSelectOffer(null);
      }}>
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
        const selected = item.offer.id === selectedOfferId;
        return (
          <PricePin
            key={`${item.offer.id}-${selected}-${scheme}`}
            offer={item.offer}
            selected={selected}
            onPress={() => onSelectOffer(item.offer)}
          />
        );
      })}
    </MapView>
  );
}
