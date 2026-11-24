import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

import type { Coords } from '@/types/geo';

export type CurrentLocationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; coords: Coords; address: string | null }
  | { status: 'error'; message: string };

/** Ubicación a pedido, para adjuntar la posición del usuario a un reporte. */
export function useCurrentLocation() {
  const [state, setState] = useState<CurrentLocationState>({ status: 'idle' });

  /** Se resuelve con el estado final (listo o error). */
  const locate = useCallback(async (): Promise<CurrentLocationState> => {
    const finish = (next: CurrentLocationState) => {
      setState(next);
      return next;
    };
    setState({ status: 'loading' });

    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      return finish({
        status: 'error',
        message: permission.canAskAgain
          ? 'Necesitamos tu permiso de ubicación para ubicar el local.'
          : 'Activa la ubicación para MarketApp en Ajustes.',
      });
    }

    try {
      const position =
        (await Location.getLastKnownPositionAsync({ maxAge: 60 * 1000 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      return finish({ status: 'done', coords, address: await reverseGeocode(coords) });
    } catch {
      return finish({
        status: 'error',
        message: 'No pudimos obtener tu ubicación. Revisa que el GPS esté activado.',
      });
    }
  }, []);

  const clear = useCallback(() => setState({ status: 'idle' }), []);

  return { state, locate, clear };
}

/** Nombre de la calle, si se puede obtener; lo que importa para el reporte son las coordenadas. */
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
