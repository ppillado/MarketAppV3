import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

import type { Coords } from '@/types/geo';

type CurrentLocationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; coords: Coords; address: string | null }
  | { status: 'error'; message: string };

/** On-demand location for attaching the user's position to a report. */
export function useCurrentLocation() {
  const [state, setState] = useState<CurrentLocationState>({ status: 'idle' });

  const locate = useCallback(async () => {
    setState({ status: 'loading' });

    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setState({
        status: 'error',
        message: permission.canAskAgain
          ? 'Necesitamos tu permiso de ubicación para ubicar el local.'
          : 'Activa la ubicación para MarketApp en Ajustes.',
      });
      return;
    }

    try {
      const position =
        (await Location.getLastKnownPositionAsync({ maxAge: 60 * 1000 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setState({ status: 'done', coords, address: await reverseGeocode(coords) });
    } catch {
      setState({
        status: 'error',
        message: 'No pudimos obtener tu ubicación. Revisa que el GPS esté activado.',
      });
    }
  }, []);

  const clear = useCallback(() => setState({ status: 'idle' }), []);

  return { state, locate, clear };
}

/** Best-effort street label; the coordinates are what matter for the report. */
async function reverseGeocode(coords: Coords): Promise<string | null> {
  try {
    const [place] = await Location.reverseGeocodeAsync(coords);
    if (!place) return null;
    const street = [place.street, place.streetNumber].filter(Boolean).join(' ');
    const area = place.district ?? place.city;
    return [street, area].filter(Boolean).join(', ') || null;
  } catch {
    return null;
  }
}
