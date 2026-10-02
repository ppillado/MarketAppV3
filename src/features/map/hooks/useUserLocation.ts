import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

import type { Coords } from '@/types/geo';


const LAST_KNOWN_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Manages the foreground location permission and the user's current position.
 * Only asks the OS once (while status is undetermined); after a denial the UI
 * decides whether to retry or send the user to Settings via `canAskAgain`.
 */
export function useUserLocation() {
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

  const refreshPosition = useCallback(
    () =>
      readPosition(setCoords).then(
        () => setError(null),
        () => setError('No pudimos obtener tu ubicación. Revisa que el GPS esté activado.'),
      ),
    [],
  );

  useEffect(() => {
    if (granted) refreshPosition();
  }, [granted, refreshPosition]);

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

/** Reports the cached fix first (instant, works offline), then a fresh one. */
async function readPosition(onCoords: (coords: Coords) => void) {
  const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
  if (lastKnown) onCoords(toCoords(lastKnown));

  const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  onCoords(toCoords(current));
}

function toCoords({ coords }: Location.LocationObject): Coords {
  return { latitude: coords.latitude, longitude: coords.longitude };
}
