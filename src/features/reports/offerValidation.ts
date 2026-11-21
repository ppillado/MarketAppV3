import { formatPrice } from '@/lib/format';

/**
 * Client-side copies of submit_offer's checks (supabase/migrations/20261008000000_offer_moderation.sql),
 * so most mistakes are caught before publishing. The server stays the source of truth.
 */

export const PRODUCT_MIN_LENGTH = 2;
export const PRODUCT_MAX_LENGTH = 80;
export const PRICE_MIN = 50;
export const PRICE_MAX = 500_000;

const LETTERS = /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/g;
/** 4+ of the same letter in a row ("aaaa"); digits are not checked, so "Pack 10000" is fine. */
const REPEATED_LETTER = /([a-zA-ZáéíóúüñÁÉÍÓÚÜÑ])\1{3,}/iu;

/** Same normalization as the server's clean_product: collapse whitespace and trim. */
export function normalizeProductName(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

/** Spanish error for an invalid product name, or null if it passes the server's rules. */
export function validateProduct(text: string): string | null {
  const name = normalizeProductName(text);
  if (name.length === 0) return 'Escribe el nombre del producto.';
  if (name.length < PRODUCT_MIN_LENGTH || name.length > PRODUCT_MAX_LENGTH) {
    return `El nombre debe tener entre ${PRODUCT_MIN_LENGTH} y ${PRODUCT_MAX_LENGTH} caracteres.`;
  }
  if ((name.match(LETTERS) ?? []).length < 2) {
    return 'El nombre debe incluir al menos 2 letras (ej: “Leche 1 L”).';
  }
  if (REPEATED_LETTER.test(name)) {
    return 'El nombre tiene demasiadas letras repetidas seguidas.';
  }
  return null;
}

/** Spanish error for a price outside the accepted CLP range, or null if it's valid. */
export function validatePrice(price: number): string | null {
  if (!Number.isFinite(price) || price <= 0) return 'Escribe el precio.';
  if (price < PRICE_MIN || price > PRICE_MAX) {
    return `El precio debe estar entre $${formatPrice(PRICE_MIN)} y $${formatPrice(PRICE_MAX)}.`;
  }
  return null;
}
