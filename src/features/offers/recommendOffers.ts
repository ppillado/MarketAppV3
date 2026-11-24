import type { OfferCategory } from '@/constants/categories';
import type { Offer } from '@/types/offer';

import type { OfferWithDistance } from './hooks/useOffers';

/**
 * Ranking "Para ti": se calcula en el propio celular, sobre las ofertas cercanas que ya están
 * en caché (no necesita internet ni llamadas extra al servidor).
 *
 * Cómo funciona: a cada oferta se le da un puntaje sumando 4 señales. Cada señal se normaliza
 * a un rango de 0 a 1 (la confianza va de -1 a 1) y se multiplica por un peso. Los pesos suman 1,
 * así que el puntaje final queda en una escala fácil de comparar.
 */

// ── 1. Pesos de cada señal ──────────────────────────────────────────────────────────────────────
// Definen cuánto importa cada criterio. Cambiar estos números cambia el orden de "Para ti"
// sin tocar el resto del código.

/** Señal principal: una oferta de una categoría favorita casi siempre queda arriba de una que no lo es. */
const W_CATEGORY = 0.45;
/** Pequeño extra según el orden en que el usuario eligió sus favoritas (la primera recibe el bono completo). */
const W_PRIORITY = 0.05;
/** Más cerca es mejor. */
const W_PROXIMITY = 0.25;
/** Más nueva es mejor, dentro de la ventana de 7 días en que se muestran las ofertas. */
const W_FRESHNESS = 0.15;
/** Votos de la comunidad: las confirmaciones suman y los reportes "agotado/error" restan. */
const W_TRUST = 0.1;

// ── 2. Parámetros de ajuste ─────────────────────────────────────────────────────────────────────
// Valores que controlan la forma de cada señal (qué tan rápido baja con la distancia, etc.).

/** Distancia (en metros) a la que la cercanía vale la mitad de su puntaje. */
const HALF_SCORE_DISTANCE_M = 2000;
/** Cercanía cuando no conocemos la ubicación del usuario (valor neutro, así no altera el orden). */
const UNKNOWN_PROXIMITY = 0.5;
/** Edad máxima de una oferta: 7 días en milisegundos. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** "Votos ficticios" que suavizan la confianza de ofertas con solo uno o dos votos. */
const TRUST_SMOOTHING = 2;

/** Limita un número al rango 0..1. */
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Indica si la oferta pertenece a una de las categorías favoritas (se usa para mostrar la etiqueta "Para ti"). */
export function isFavoriteCategory(offer: Offer, favorites: readonly OfferCategory[]) {
  return favorites.includes(offer.category);
}

// ── 3. Cálculo del puntaje ──────────────────────────────────────────────────────────────────────

/**
 * Calcula el puntaje de una oferta para este usuario: a mayor puntaje, más relevante.
 * Es una función "pura": con los mismos datos de entrada siempre da el mismo resultado,
 * lo que la hace fácil de probar y de explicar.
 */
export function scoreOfferForUser(
  { offer, distanceMeters }: OfferWithDistance,
  favorites: readonly OfferCategory[],
  now: number = Date.now(),
): number {
  // Afinidad: 0 si la categoría no es favorita. Si lo es, recibe el peso principal más un
  // pequeño bono según su posición en la lista (la primera favorita vale un poco más).
  const index = favorites.indexOf(offer.category);
  const affinity = index === -1 ? 0 : W_CATEGORY + W_PRIORITY * (1 - index / favorites.length);

  // Cercanía: 1 si está justo al lado, 0,5 a 2 km, y sigue bajando suavemente con la distancia.
  const proximity =
    distanceMeters === null
      ? UNKNOWN_PROXIMITY
      : 1 / (1 + Math.max(0, distanceMeters) / HALF_SCORE_DISTANCE_M);

  // Frescura: 1 si se publicó recién y baja en línea recta hasta 0 a los 7 días.
  const freshness = clamp01(1 - (now - offer.createdAt.getTime()) / MAX_AGE_MS);

  // Confianza: (confirmaciones - reportes) / (total de votos + suavizado).
  // Con el suavizado, una oferta con 1 sola confirmación no queda igual que una con 20.
  const { confirmations, reports } = offer;
  const trust = (confirmations - reports) / (confirmations + reports + TRUST_SMOOTHING);

  // Puntaje final: suma ponderada de las 4 señales.
  return affinity + W_PROXIMITY * proximity + W_FRESHNESS * freshness + W_TRUST * trust;
}

// ── 4. Ordenamiento ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve una copia de la lista ordenada de mejor a peor puntaje (no modifica la original).
 * Si dos ofertas empatan, va primero la más nueva.
 */
export function sortOffersForUser(
  items: readonly OfferWithDistance[],
  favorites: readonly OfferCategory[],
  now: number = Date.now(),
): OfferWithDistance[] {
  return items
    // Se calcula el puntaje una sola vez por oferta, antes de ordenar.
    .map((item) => ({ item, score: scoreOfferForUser(item, favorites, now) }))
    .sort(
      (a, b) =>
        b.score - a.score || b.item.offer.createdAt.getTime() - a.item.offer.createdAt.getTime(),
    )
    // Se descarta el puntaje y queda solo la oferta, ya ordenada.
    .map(({ item }) => item);
}
