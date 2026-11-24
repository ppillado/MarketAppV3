import { formatPrice } from '@/lib/format';

/**
 * Copias en la app de las validaciones de submit_offer (supabase/migrations/20261008000000_offer_moderation.sql),
 * para detectar la mayoría de los errores antes de publicar. El servidor sigue siendo la fuente de verdad.
 */

export const PRODUCT_MIN_LENGTH = 2;
export const PRODUCT_MAX_LENGTH = 80;
export const PRICE_MIN = 50;
export const PRICE_MAX = 500_000;

const LETTERS = /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/g;
/** 4 o más letras iguales seguidas ("aaaa"); los números no se revisan, así "Pack 10000" es válido. */
const REPEATED_LETTER = /([a-zA-ZáéíóúüñÁÉÍÓÚÜÑ])\1{3,}/iu;

/** Misma normalización que clean_product en el servidor: junta espacios repetidos y recorta los extremos. */
export function normalizeProductName(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

/** Error en español para un nombre de producto inválido, o null si cumple las reglas del servidor. */
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

/** Error en español para un precio fuera del rango aceptado en CLP, o null si es válido. */
export function validatePrice(price: number): string | null {
  if (!Number.isFinite(price) || price <= 0) return 'Escribe el precio.';
  if (price < PRICE_MIN || price > PRICE_MAX) {
    return `El precio debe estar entre $${formatPrice(PRICE_MIN)} y $${formatPrice(PRICE_MAX)}.`;
  }
  return null;
}
