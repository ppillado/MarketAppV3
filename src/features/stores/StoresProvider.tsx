import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { Store } from '@/types/store';

import { fetchStores, mockStores, readCachedStores, writeCachedStores } from './storesApi';

/** Los locales en caché más nuevos que esto se muestran sin consultar a Supabase. */
const CACHE_TTL_MS = 5 * 60 * 1000;

type StoresState = {
  stores: Store[];
  /** De dónde vienen los locales que se muestran. */
  source: 'mock' | 'cache' | 'network';
  /** Cuándo se pidieron a Supabase los locales mostrados (null para datos de prueba / caché vacía). */
  updatedAt: number | null;
  error: string | null;
};

type StoresContextValue = StoresState & {
  refreshing: boolean;
  /** Siempre va a la red (ej. después de publicar una oferta). */
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
 * Pines de locales offline-first para el mapa (misma estrategia que OffersProvider): muestra la caché
 * local al instante y solo consulta Supabase cuando es más antigua que CACHE_TTL_MS (al abrir la app y
 * al volver a primer plano) o cuando se refresca a propósito.
 */
export function StoresProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const [refreshing, setRefreshing] = useState(false);
  const updatedAtRef = useRef(state.updatedAt);
  const inFlight = useRef<Promise<void> | null>(null);

  const load = useCallback(() => {
    if (!supabase) return Promise.resolve();
    // Comparte una sola petición si varios la piden al mismo tiempo.
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
