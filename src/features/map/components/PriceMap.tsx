import { useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import MapView, { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';

import { GRAN_CONCEPCION_REGION, USER_REGION_DELTA } from '../constants';
import type { PriceMapProps } from './PriceMap.types';

// Google Maps on Android, Apple Maps on iOS (no iOS Google key needed).
const MAP_PROVIDER = Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;

export function PriceMap({ ref, showsUserLocation }: PriceMapProps) {
  const mapRef = useRef<MapView>(null);

  useImperativeHandle(ref, () => ({
    centerOn: ({ latitude, longitude }) =>
      mapRef.current?.animateToRegion(
        { latitude, longitude, latitudeDelta: USER_REGION_DELTA, longitudeDelta: USER_REGION_DELTA },
        600,
      ),
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
    />
  );
}
