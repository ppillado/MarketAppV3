/** Reglas de confianza de la comunidad para las ofertas, compartidas por las tarjetas, el flujo de votos y las listas. */

type Counts = { confirmations: number; reports: number };

/** Respaldo real de la comunidad: al menos 2 confirmaciones y más confirmaciones que reportes. */
export function isOfferVerified({ confirmations, reports }: Counts) {
  return confirmations >= 2 && confirmations > reports;
}

/**
 * Misma regla que `public.offer_should_hide` en el servidor (ver
 * supabase/migrations/20261008000000_offer_moderation.sql). Mantener ambas sincronizadas.
 */
export function shouldHideOffer(confirmations: number, reports: number) {
  return reports >= 3 && reports - confirmations >= 2;
}

/** Más reportes que confirmaciones, pero aún no oculta: avisa a los vecinos antes de que vayan. */
export function isOfferUnderReview({ confirmations, reports }: Counts) {
  return reports >= 1 && reports > confirmations && !shouldHideOffer(confirmations, reports);
}
