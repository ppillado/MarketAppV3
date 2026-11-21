import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { Store } from '@/types/store';

import { fetchStores, mockStores, readCachedStores, writeCachedStores } from './storesApi';

/** Cached stores younger than this are shown without hitting Supabase. */
const CACHE_TTL_MS = 5 * 60 * 1000;

type StoresState = {
  stores: Store[];
  /** Where the shown stores come from. */
  source: 'mock' | 'cache' | 'network';
  /** When the shown stores were fetched from Supabase (null for mock data / empty cache). */
  updatedAt: number | null;
  error: string | null;
};

type StoresContextValue = StoresState & {
  refreshing: boolean;
  /** Always goes to the network (e.g. after publishing an offer). */
  refresh: () => Promise<void>;
};

const StoresContext = createContext<StoresContextValue | null>(null);

function initialState(): StoresState {
  if (!supabase) return { stores: mockStores(), source: 'mock', updatedAt: null, error: null };
  const cached = readCachedStores();
  return cached
    ? { stores: cached.stores, source: 'cache', updatedAt: cached.savedAt, error: null }
    : { stores: [], source: 'cache', updatedAt: null, error: null };
}

/**
 * Offline-first store pins for the map (same strategy as OffersProvider): shows the local
 * cache instantly and only reads Supabase when it is older than CACHE_TTL_MS (on launch and
 * when the app returns to the foreground) or when refreshed explicitly.
 */
export function StoresProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const [refreshing, setRefreshing] = useState(false);
  const updatedAtRef = useRef(state.updatedAt);
  const inFlight = useRef<Promise<void> | null>(null);

  const load = useCallback(() => {
    if (!supabase) return Promise.resolve();
    // Share one request if several callers ask at the same time.
    inFlight.current ??= fetchStores()
      .then(
        (stores) => {
          const cache = writeCachedStores(stores);
          updatedAtRef.current = cache.savedAt;
          setState({ stores, source: 'network', updatedAt: cache.savedAt, error: null });
        },
        () =>
          setState((prev) => ({
            ...prev,
            error: 'Sin conexión. Mostrando los últimos locales guardados.',
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

  return <StoresContext value={{ ...state, refreshing, refresh }}>{children}</StoresContext>;
}

export function useStoresStore() {
  const stores = use(StoresContext);
  if (!stores) throw new Error('useStoresStore must be used inside <StoresProvider>');
  return stores;
}
