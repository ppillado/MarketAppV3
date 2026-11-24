import { Alert, Linking } from 'react-native';

import type { Coords } from '@/types/geo';

// Enlaces https universales: abren la app nativa si está instalada y, si no, el
// navegador, así no se necesitan consultas de URL scheme (ni recompilar la app nativa).
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

/** Permite al usuario elegir Google Maps o Waze e inicia la navegación hacia `coords`. */
export function openDirections(coords: Coords, placeName: string) {
  Alert.alert(`Ir a ${placeName}`, '¿Con qué app quieres navegar?', [
    { text: 'Google Maps', onPress: () => open(googleMapsUrl(coords)) },
    { text: 'Waze', onPress: () => open(wazeUrl(coords)) },
    { text: 'Cancelar', style: 'cancel' },
  ]);
}
