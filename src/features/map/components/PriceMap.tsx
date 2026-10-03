import { useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import MapView, { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';

import { useColorScheme } from '@/hooks/use-color-scheme';

import { GRAN_CONCEPCION_REGION, USER_REGION_DELTA } from '../constants';
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
      onPress={(event) => {
        // iOS also reports marker taps here; only a tap on empty map deselects.
        if (event.nativeEvent.action !== 'marker-press') onSelectOffer(null);
      }}>
      {offers.map((offer) => {
        const selected = offer.id === selectedOfferId;
        return (
          <PricePin
            // Custom marker views are snapshotted, so remount to restyle on select/theme change.
            key={`${offer.id}-${selected}-${scheme}`}
            offer={offer}
            selected={selected}
            onPress={() => onSelectOffer(offer)}
          />
        );
      })}
    </MapView>
  );
}
