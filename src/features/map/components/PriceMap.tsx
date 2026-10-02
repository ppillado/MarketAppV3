import { useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';

import { GRAN_CONCEPCION_REGION, USER_REGION_DELTA } from '../constants';
import type { PriceMapProps } from './PriceMap.types';

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
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFill}
      initialRegion={GRAN_CONCEPCION_REGION}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      toolbarEnabled={false}
    />
  );
}
