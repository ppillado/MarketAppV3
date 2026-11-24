import * as Location from 'expo-location';
import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppState, Linking } from 'react-native';

import type { Coords } from '@/types/geo';

const LAST_KNOWN_MAX_AGE_MS = 5 * 60 * 1000;
const POSITION_ERROR = 'No pudimos obtener tu ubicación. Revisa que el GPS esté activado.';

// Precisión equilibrada + un umbral de 25 m mantienen las distancias exactas sin gastar la batería.
const WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.Balanced,
  distanceInterval: 25,
  timeInterval: 10_000,
};

type UserLocation = ReturnType<typeof useLiveLocation>;

const LocationContext = createContext<UserLocation | null>(null);

/**
 * Posición GPS en vivo para toda la app, compartida por el mapa y la lista de Ofertas, así hay una sola
 * solicitud de permiso y una sola suscripción a la posición.
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const location = useLiveLocation();
  return <LocationContext value={location}>{children}</LocationContext>;
}

export function useUserLocation() {
  const location = use(LocationContext);
  if (!location) throw new Error('useUserLocation must be used inside <LocationProvider>');
  return location;
}

/**
 * Maneja el permiso de ubicación en primer plano y sigue la posición del usuario mientras usa
 * la app. Solo le pregunta al sistema una vez (mientras el estado está indefinido); tras un rechazo, la interfaz
 * decide si reintentar o enviar al usuario a Ajustes, según `canAskAgain`.
 */
function useLiveLocation() {
  const [permission, requestPermission, getPermission] = Location.useForegroundPermissions();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = permission?.status ?? null;
  const canAskAgain = permission?.canAskAgain ?? true;
  const granted = status === Location.PermissionStatus.GRANTED;
  const denied = status === Location.PermissionStatus.DENIED;

  // Primer inicio: preguntar una sola vez.
  useEffect(() => {
    if (status === Location.PermissionStatus.UNDETERMINED && canAskAgain) {
      requestPermission();
    }
  }, [status, canAskAgain, requestPermission]);

  // Volver a revisar al regresar desde Ajustes.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') getPermission();
    });
    return () => sub.remove();
  }, [getPermission]);

  // Posición en vivo: primero la última conocida (instantánea, funciona offline) y luego se siguen las actualizaciones.
  useEffect(() => {
    if (!granted) return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS })
      .then((lastKnown) => {
        if (!cancelled && lastKnown) setCoords(toCoords(lastKnown));
      })
      .catch(() => {});

    Location.watchPositionAsync(WATCH_OPTIONS, (position) => {
      setCoords(toCoords(position));
      setError(null);
    }).then(
      (sub) => {
        if (cancelled) sub.remove();
        else subscription = sub;
      },
      () => {
        if (!cancelled) setError(POSITION_ERROR);
      },
    );

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [granted]);

  /** Ubicación nueva de una sola vez, ej. para el botón "centrar en mí". */
  const refreshPosition = useCallback(
    () =>
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(
        (position) => {
          setCoords(toCoords(position));
          setError(null);
        },
        () => setError(POSITION_ERROR),
      ),
    [],
  );

  const openSettings = useCallback(() => Linking.openSettings(), []);

  return {
    status,
    granted,
    denied,
    canAskAgain,
    coords,
    error,
    request: requestPermission,
    refreshPosition,
    openSettings,
  };
}

function toCoords({ coords }: Location.LocationObject): Coords {
  return { latitude: coords.latitude, longitude: coords.longitude };
}
