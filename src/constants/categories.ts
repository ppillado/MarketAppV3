/**
 * Offer categories. The slugs must match `offers_category_check` and the check inside
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

/** Display order of the category chips ('otros' last). */
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

/** Any value (server row, old offline cache, route param) → a valid category, else 'otros'. */
export function toOfferCategory(value: unknown): OfferCategory {
  return isOfferCategory(value) ? value : DEFAULT_CATEGORY;
}

/** Valid, distinct categories from an untrusted array (old caches may not have the field). */
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
