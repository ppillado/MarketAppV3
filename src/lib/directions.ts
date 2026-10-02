import { Alert, Linking } from 'react-native';

import type { Coords } from '@/types/geo';

// Universal https links: they open the native app when installed and fall back to the
// browser otherwise, so no URL-scheme queries (and no native rebuild) are needed.
const googleMapsUrl = ({ latitude, longitude }: Coords) =>
  `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;

const wazeUrl = ({ latitude, longitude }: Coords) =>
  `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`;

async function open(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('No se pudo abrir la navegación', 'Inténtalo de nuevo en unos segundos.');
  }
}

/** Lets the user pick Google Maps or Waze and starts navigation to `coords`. */
export function openDirections(coords: Coords, placeName: string) {
  Alert.alert(`Ir a ${placeName}`, '¿Con qué app quieres navegar?', [
    { text: 'Google Maps', onPress: () => open(googleMapsUrl(coords)) },
    { text: 'Waze', onPress: () => open(wazeUrl(coords)) },
    { text: 'Cancelar', style: 'cancel' },
  ]);
}
