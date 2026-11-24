import { toOfferCategories, type OfferCategory } from '@/constants/categories';
import { ensureUserId } from '@/lib/auth';
import { kvStorage } from '@/lib/kv-storage';
import { supabase } from '@/lib/supabase';

const CACHE_KEY = 'favorite-categories-v1';

/** Error para mostrar al usuario al guardar preferencias (los mensajes de validación del servidor están en español). */
export class PreferencesError extends Error {}

/**
 * Las categorías favoritas del usuario desde el servidor (get_my_preferences). No crea un
 * usuario anónimo: alguien sin sesión todavía no tiene nada guardado. Null ante cualquier error.
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
 * Reemplaza las categorías favoritas del usuario (set_favorite_categories) y devuelve lo que
 * guardó el servidor (normalizado y sin duplicados, en orden de prioridad).
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
