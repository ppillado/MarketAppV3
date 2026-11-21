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
  /** Favorite categories in priority order (first picked = highest priority). */
  favoriteCategories: OfferCategory[];
  /** True until the server copy has been checked for the current session. */
  isLoading: boolean;
  isSaving: boolean;
  /** Last save error (the change was rolled back); cleared by the next change. */
  error: string | null;
  toggleFavoriteCategory: (category: OfferCategory) => void;
  clearFavoriteCategories: () => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

/**
 * The user's favorite categories (Perfil → "Tus intereses", used by the "Para ti" ranking).
 * Offline-first: starts from the local cache, syncs with Supabase once there is a session,
 * and applies changes optimistically, rolling back if the save fails.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuthUser();
  const userId = user?.id ?? null;

  const [favoriteCategories, setFavoriteCategories] = useState(readCachedPreferences);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [savingCount, setSavingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Latest shown value (toggles compose on it) and the last value the server confirmed.
  const currentRef = useRef(favoriteCategories);
  const confirmedRef = useRef(favoriteCategories);
  // Increments on every local change, so late responses never overwrite newer choices.
  const requestIdRef = useRef(0);
  const confirmedIdRef = useRef(0);

  const apply = useCallback((next: OfferCategory[]) => {
    currentRef.current = next;
    setFavoriteCategories(next);
    writeCachedPreferences(next);
  }, []);

  // Sync with the server copy (e.g. after reinstalling or linking another account).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const startedAt = requestIdRef.current;
    fetchMyPreferences().then((server) => {
      if (cancelled) return;
      // Skip if the user changed something meanwhile; offline (null) keeps the cache.
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

      // Mock mode: preferences stay local.
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
      // New picks go last: earlier picks keep their higher priority.
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
