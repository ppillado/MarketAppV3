import { useCallback, useEffect, useRef, useState } from 'react';

import type { Coords } from '@/types/geo';
import type { NearbyStore } from '@/types/store';

import { findNearbyStores } from '../storesApi';

/** Radio corto: los locales donde probablemente está parado el usuario. */
const SEARCH_RADIUS_M = 200;

type Result = { attempt: number; stores: NearbyStore[] | null };

export type NearbyStoreSearch =
  | { status: 'no-location' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'done'; stores: NearbyStore[] };

/**
 * Locales existentes alrededor del usuario (find_nearby_stores), para que al publicar se reutilice un local
 * en vez de crear un duplicado. Busca una vez cuando se conoce la posición por primera vez (las
 * actualizaciones de GPS no la repiten) y de nuevo con `retry()`.
 */
export function useNearbyStoreSearch(coords: Coords | null, enabled: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const coordsRef = useRef(coords);
  useEffect(() => {
    coordsRef.current = coords;
  });

  const hasCoords = coords !== null;

  useEffect(() => {
    const searchCoords = coordsRef.current;
    if (!enabled || !searchCoords) return;
    let cancelled = false;
    findNearbyStores(searchCoords, SEARCH_RADIUS_M).then(
      (stores) => {
        if (!cancelled) setResult({ attempt, stores });
      },
      () => {
        if (!cancelled) setResult({ attempt, stores: null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, hasCoords, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  let search: NearbyStoreSearch;
  if (!hasCoords) search = { status: 'no-location' };
  else if (!result || result.attempt !== attempt) search = { status: 'loading' };
  else if (!result.stores) search = { status: 'error' };
  else search = { status: 'done', stores: result.stores };

  return { search, retry };
}
