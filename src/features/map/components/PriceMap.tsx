import { useImperativeHandle, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import MapView, { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';

import { useColorScheme } from '@/hooks/use-color-scheme';

import { GRAN_CONCEPCION_REGION, USER_REGION_DELTA, type MapRegion } from '../constants';
import { useStoreClusters } from '../hooks/useStoreClusters';
import { ClusterPin } from './ClusterPin';
import type { PriceMapProps } from './PriceMap.types';
import { StorePin } from './StorePin';

// Google Maps en Android, Apple Maps en iOS (no se necesita clave de Google para iOS).
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
      // Los controles nativos (brújula) quedan bajo la barra flotante de categorías.
      mapPadding={{ top: topInset, right: 0, bottom: 0, left: 0 }}
      onRegionChangeComplete={setRegion}>
      {items.map((item) => {
        if (item.kind === 'cluster') {
          return (
            <ClusterPin
              // Los marcadores personalizados se capturan como imagen: se remontan para cambiar de estilo al variar conteo o tema.
              key={`cluster-${item.id}-${item.count}-${scheme}`}
              coords={item.coords}
              count={item.count}
              onPress={() => {
                // Acerca el zoom justo lo necesario para que este grupo se separe.
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
