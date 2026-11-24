import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { Offer } from '@/types/offer';

import { MOCK_OFFERS } from './mockOffers';
import { fetchOffers, readCachedOffers, writeCachedOffers } from './offersApi';

/** Las ofertas en caché más nuevas que esto se muestran sin consultar a Supabase. */
const CACHE_TTL_MS = 5 * 60 * 1000;

type OffersState = {
  offers: Offer[];
  /** De dónde vienen las ofertas que se muestran. */
  source: 'mock' | 'cache' | 'network';
  /** Cuándo se pidieron a Supabase las ofertas mostradas (null para datos de prueba / caché vacía). */
  updatedAt: number | null;
  error: string | null;
};

type OffersContextValue = OffersState & {
  refreshing: boolean;
  /** Deslizar para refrescar: siempre va a la red. */
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
 * Almacén de ofertas offline-first compartido por el mapa y la lista de Ofertas: muestra la caché local
 * al instante y solo consulta Supabase cuando esa caché es más antigua que CACHE_TTL_MS (al abrir la app
 * y al volver a primer plano) o al deslizar para refrescar.
 */
export function OffersProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const [refreshing, setRefreshing] = useState(false);
  const updatedAtRef = useRef(state.updatedAt);
  const inFlight = useRef<Promise<void> | null>(null);

  const load = useCallback(() => {
    if (!supabase) return Promise.resolve();
    // Comparte una sola petición si varios la piden al mismo tiempo.
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
