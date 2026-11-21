import { toOfferCategories, type OfferCategory } from '@/constants/categories';
import { ensureUserId } from '@/lib/auth';
import { kvStorage } from '@/lib/kv-storage';
import { supabase } from '@/lib/supabase';

const CACHE_KEY = 'favorite-categories-v1';

/** User-facing error from saving preferences (server validation messages are in Spanish). */
export class PreferencesError extends Error {}

/**
 * The user's favorite categories from the server (get_my_preferences). Doesn't create an
 * anonymous user: someone without a session has nothing saved yet. Null on any failure.
 */
export async function fetchMyPreferences(): Promise<OfferCategory[] | null> {
  if (!supabase) return null;
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return null;

  const { data, error } = await supabase.rpc('get_my_preferences');
  if (error) return null;
  return toOfferCategories(data);
}

/**
 * Replaces the user's favorite categories (set_favorite_categories) and returns what the
 * server saved (normalized and deduplicated, in priority order).
 */
export async function saveFavoriteCategories(
  categories: readonly OfferCategory[],
): Promise<OfferCategory[]> {
  if (!supabase) throw new PreferencesError('La app todavía no está conectada al servidor.');

  await ensureUserId().catch((error: Error) => {
    throw new PreferencesError(error.message);
  });

  const { data, error } = await supabase.rpc('set_favorite_categories', {
    p_categories: categories,
  });

  if (error) {
    throw new PreferencesError(
      error.hint ? error.message : 'No pudimos guardar tus intereses. Revisa tu conexión.',
    );
  }
  return toOfferCategories(data);
}

export function readCachedPreferences(): OfferCategory[] {
  try {
    return toOfferCategories(JSON.parse(kvStorage.getItemSync(CACHE_KEY) ?? '[]'));
  } catch {
    return [];
  }
}

export function writeCachedPreferences(categories: readonly OfferCategory[]) {
  kvStorage.setItem(CACHE_KEY, JSON.stringify(categories)).catch(() => {});
}
