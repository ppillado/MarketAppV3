import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { Offer } from '@/types/offer';

import { MOCK_OFFERS } from './mockOffers';
import { fetchOffers, readCachedOffers, writeCachedOffers } from './offersApi';

/** Cached offers younger than this are shown without hitting Supabase. */
const CACHE_TTL_MS = 5 * 60 * 1000;

type OffersState = {
  offers: Offer[];
  /** Where the shown offers come from. */
  source: 'mock' | 'cache' | 'network';
  /** When the shown offers were fetched from Supabase (null for mock data / empty cache). */
  updatedAt: number | null;
  error: string | null;
};

type OffersContextValue = OffersState & {
  refreshing: boolean;
  /** Pull-to-refresh: always goes to the network. */
  refresh: () => Promise<void>;
};

const OffersContext = createContext<OffersContextValue | null>(null);

function initialState(): OffersState {
  if (!supabase) return { offers: MOCK_OFFERS, source: 'mock', updatedAt: null, error: null };
  const cached = readCachedOffers();
  return cached
    ? { offers: cached.offers, source: 'cache', updatedAt: cached.savedAt, error: null }
    : { offers: [], source: 'cache', updatedAt: null, error: null };
}

/**
 * Offline-first offers store shared by the map and the Ofertas feed: shows the local cache
 * instantly and only reads Supabase when that cache is older than CACHE_TTL_MS (on launch
 * and when the app returns to the foreground) or on pull-to-refresh.
 */
export function OffersProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const [refreshing, setRefreshing] = useState(false);
  const updatedAtRef = useRef(state.updatedAt);
  const inFlight = useRef<Promise<void> | null>(null);

  const load = useCallback(() => {
    if (!supabase) return Promise.resolve();
    // Share one request if several callers ask at the same time.
    inFlight.current ??= fetchOffers()
      .then(
        (offers) => {
          const cache = writeCachedOffers(offers);
          updatedAtRef.current = cache.savedAt;
          setState({ offers, source: 'network', updatedAt: cache.savedAt, error: null });
        },
        () =>
          setState((prev) => ({
            ...prev,
            error: 'Sin conexión. Mostrando las últimas ofertas guardadas.',
          })),
      )
      .finally(() => {
        inFlight.current = null;
      });
    return inFlight.current;
  }, []);

  const loadIfStale = useCallback(() => {
    const updatedAt = updatedAtRef.current;
    if (updatedAt === null || Date.now() - updatedAt > CACHE_TTL_MS) load();
  }, [load]);

  useEffect(() => {
    loadIfStale();
    const sub = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') loadIfStale();
    });
    return () => sub.remove();
  }, [loadIfStale]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return <OffersContext value={{ ...state, refreshing, refresh }}>{children}</OffersContext>;
}

export function useOffersStore() {
  const offers = use(OffersContext);
  if (!offers) throw new Error('useOffersStore must be used inside <OffersProvider>');
  return offers;
}
