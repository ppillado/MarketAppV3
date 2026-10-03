import * as Location from 'expo-location';
import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppState, Linking } from 'react-native';

import type { Coords } from '@/types/geo';

const LAST_KNOWN_MAX_AGE_MS = 5 * 60 * 1000;
const POSITION_ERROR = 'No pudimos obtener tu ubicación. Revisa que el GPS esté activado.';

// Balanced accuracy + a 25 m threshold keeps distances accurate without draining the battery.
const WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.Balanced,
  distanceInterval: 25,
  timeInterval: 10_000,
};

type UserLocation = ReturnType<typeof useLiveLocation>;

const LocationContext = createContext<UserLocation | null>(null);

/**
 * App-wide live GPS position, shared by the map and the Ofertas feed so there is a single
 * permission prompt and a single position subscription.
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
 * Manages the foreground location permission and follows the user's position while the app
 * is in use. Only asks the OS once (while status is undetermined); after a denial the UI
 * decides whether to retry or send the user to Settings via `canAskAgain`.
 */
function useLiveLocation() {
  const [permission, requestPermission, getPermission] = Location.useForegroundPermissions();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = permission?.status ?? null;
  const canAskAgain = permission?.canAskAgain ?? true;
  const granted = status === Location.PermissionStatus.GRANTED;
  const denied = status === Location.PermissionStatus.DENIED;

  // First launch: prompt once.
  useEffect(() => {
    if (status === Location.PermissionStatus.UNDETERMINED && canAskAgain) {
      requestPermission();
    }
  }, [status, canAskAgain, requestPermission]);

  // Re-check when returning from Settings.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') getPermission();
    });
    return () => sub.remove();
  }, [getPermission]);

  // Live position: cached fix first (instant, works offline), then follow updates.
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

  /** One-shot fresh fix, e.g. for the "center on me" button. */
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
