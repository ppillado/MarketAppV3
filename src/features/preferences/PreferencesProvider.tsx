import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import type { OfferCategory } from '@/constants/categories';
import { useAuthUser } from '@/features/auth/useAuthUser';
import { supabase } from '@/lib/supabase';

import {
  fetchMyPreferences,
  PreferencesError,
  readCachedPreferences,
  saveFavoriteCategories,
  writeCachedPreferences,
} from './preferencesApi';

type PreferencesContextValue = {
  /** Categorías favoritas en orden de prioridad (la primera elegida = mayor prioridad). */
  favoriteCategories: OfferCategory[];
  /** Verdadero hasta que se revisa la copia del servidor para la sesión actual. */
  isLoading: boolean;
  isSaving: boolean;
  /** Último error al guardar (el cambio se revirtió); se limpia con el siguiente cambio. */
  error: string | null;
  toggleFavoriteCategory: (category: OfferCategory) => void;
  clearFavoriteCategories: () => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

/**
 * Las categorías favoritas del usuario (Perfil → "Tus intereses", usadas por el ranking "Para ti").
 * Offline-first: parte desde la caché local, se sincroniza con Supabase cuando hay sesión,
 * y aplica los cambios de forma optimista, revirtiéndolos si falla el guardado.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuthUser();
  const userId = user?.id ?? null;

  const [favoriteCategories, setFavoriteCategories] = useState(readCachedPreferences);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [savingCount, setSavingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Último valor mostrado (los toques se aplican sobre él) y el último valor que confirmó el servidor.
  const currentRef = useRef(favoriteCategories);
  const confirmedRef = useRef(favoriteCategories);
  // Aumenta con cada cambio local, así las respuestas atrasadas nunca pisan elecciones más nuevas.
  const requestIdRef = useRef(0);
  const confirmedIdRef = useRef(0);

  const apply = useCallback((next: OfferCategory[]) => {
    currentRef.current = next;
    setFavoriteCategories(next);
    writeCachedPreferences(next);
  }, []);

  // Sincroniza con la copia del servidor (ej. después de reinstalar o de vincular otra cuenta).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const startedAt = requestIdRef.current;
    fetchMyPreferences().then((server) => {
      if (cancelled) return;
      // Se omite si el usuario cambió algo mientras tanto; sin conexión (null) se mantiene la caché.
      if (server && requestIdRef.current === startedAt) {
        confirmedRef.current = server;
        apply(server);
      }
      setLoadedUserId(userId);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, apply]);

  const save = useCallback(
    (next: OfferCategory[]) => {
      const id = ++requestIdRef.current;
      apply(next);
      setError(null);

      // Modo de prueba (mock): las preferencias quedan solo en el celular.
      if (!supabase) {
        confirmedRef.current = next;
        return;
      }

      setSavingCount((count) => count + 1);
      saveFavoriteCategories(next)
        .then(
          (saved) => {
            if (id > confirmedIdRef.current) {
              confirmedIdRef.current = id;
              confirmedRef.current = saved;
            }
            if (id === requestIdRef.current) apply(saved);
          },
          (reason) => {
            if (id !== requestIdRef.current) return;
            apply(confirmedRef.current);
            setError(
              reason instanceof PreferencesError ? reason.message : 'Ocurrió un error inesperado.',
            );
          },
        )
        .finally(() => setSavingCount((count) => count - 1));
    },
    [apply],
  );

  const toggleFavoriteCategory = useCallback(
    (category: OfferCategory) => {
      const current = currentRef.current;
      // Las nuevas elecciones van al final: las anteriores mantienen su mayor prioridad.
      save(
        current.includes(category)
          ? current.filter((item) => item !== category)
          : [...current, category],
      );
    },
    [save],
  );

  const clearFavoriteCategories = useCallback(() => save([]), [save]);

  const isLoading = authLoading || (userId !== null && loadedUserId !== userId);

  return (
    <PreferencesContext
      value={{
        favoriteCategories,
        isLoading,
        isSaving: savingCount > 0,
        error,
        toggleFavoriteCategory,
        clearFavoriteCategories,
      }}>
      {children}
    </PreferencesContext>
  );
}

export function usePreferences() {
  const context = use(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return context;
}
