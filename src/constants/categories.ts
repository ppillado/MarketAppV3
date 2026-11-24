/**
 * Categorías de ofertas. Los slugs deben coincidir con `offers_category_check` y con la validación de
 * `submit_offer` (supabase/migrations/20261006000000_offer_categories.sql).
 */
export type OfferCategory =
  | 'abarrotes'
  | 'lacteos'
  | 'panaderia'
  | 'bebidas'
  | 'frutas_verduras'
  | 'carnes'
  | 'aseo'
  | 'otros';

export type CategoryInfo = { id: OfferCategory; label: string; emoji: string };

export const DEFAULT_CATEGORY: OfferCategory = 'otros';

/** Orden en que se muestran los chips de categoría ('otros' al final). */
export const CATEGORIES: readonly CategoryInfo[] = [
  { id: 'abarrotes', label: 'Abarrotes', emoji: '🥫' },
  { id: 'lacteos', label: 'Lácteos', emoji: '🥛' },
  { id: 'panaderia', label: 'Panadería', emoji: '🥖' },
  { id: 'bebidas', label: 'Bebidas', emoji: '🥤' },
  { id: 'frutas_verduras', label: 'Frutas y Verduras', emoji: '🍅' },
  { id: 'carnes', label: 'Carnes', emoji: '🍗' },
  { id: 'aseo', label: 'Aseo', emoji: '🧴' },
  { id: 'otros', label: 'Otros', emoji: '🛒' },
];

const BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]));

export function isOfferCategory(value: unknown): value is OfferCategory {
  return typeof value === 'string' && BY_ID.has(value as OfferCategory);
}

/** Cualquier valor (fila del servidor, caché offline antigua, parámetro de ruta) → una categoría válida, o 'otros'. */
export function toOfferCategory(value: unknown): OfferCategory {
  return isOfferCategory(value) ? value : DEFAULT_CATEGORY;
}

/** Categorías válidas y sin repetir a partir de un arreglo no confiable (las cachés antiguas pueden no tener el campo). */
export function toOfferCategories(value: unknown): OfferCategory[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isOfferCategory))];
}

export function getCategoryInfo(slug: unknown): CategoryInfo {
  return BY_ID.get(toOfferCategory(slug))!;
}

export function getCategoryLabel(slug: unknown): string {
  return getCategoryInfo(slug).label;
}
