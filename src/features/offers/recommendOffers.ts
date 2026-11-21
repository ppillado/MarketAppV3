import type { OfferCategory } from '@/constants/categories';
import type { Offer } from '@/types/offer';

import type { OfferWithDistance } from './hooks/useOffers';

/**
 * "Para ti" ranking, computed locally over the cached nearby offers. Every signal is
 * normalized to 0..1 (trust to -1..1) and weighted; the weights add up to 1.
 */

/** Main signal: an offer in a favorite category almost always ranks above one that isn't. */
const W_CATEGORY = 0.45;
/** Small extra for the user's earlier picks (first favorite = full bonus). */
const W_PRIORITY = 0.05;
/** Closer is better. */
const W_PROXIMITY = 0.25;
/** Newer is better, within the 7-day window offers are shown for. */
const W_FRESHNESS = 0.15;
/** Community votes: confirmations add, "agotado/error" reports subtract. */
const W_TRUST = 0.1;

/** Distance at which proximity drops to half its score. */
const HALF_SCORE_DISTANCE_M = 2000;
/** Proximity when the user's position is unknown (neutral, so it doesn't reorder). */
const UNKNOWN_PROXIMITY = 0.5;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Pseudo-votes that damp the trust of offers with only one or two votes. */
const TRUST_SMOOTHING = 2;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function isFavoriteCategory(offer: Offer, favorites: readonly OfferCategory[]) {
  return favorites.includes(offer.category);
}

/** Higher = more relevant for this user. Pure: same input, same score. */
export function scoreOfferForUser(
  { offer, distanceMeters }: OfferWithDistance,
  favorites: readonly OfferCategory[],
  now: number = Date.now(),
): number {
  const index = favorites.indexOf(offer.category);
  const affinity = index === -1 ? 0 : W_CATEGORY + W_PRIORITY * (1 - index / favorites.length);

  const proximity =
    distanceMeters === null
      ? UNKNOWN_PROXIMITY
      : 1 / (1 + Math.max(0, distanceMeters) / HALF_SCORE_DISTANCE_M);

  const freshness = clamp01(1 - (now - offer.createdAt.getTime()) / MAX_AGE_MS);

  const { confirmations, reports } = offer;
  const trust = (confirmations - reports) / (confirmations + reports + TRUST_SMOOTHING);

  return affinity + W_PROXIMITY * proximity + W_FRESHNESS * freshness + W_TRUST * trust;
}

/** A sorted copy, best first; ties fall back to the newest offer. */
export function sortOffersForUser(
  items: readonly OfferWithDistance[],
  favorites: readonly OfferCategory[],
  now: number = Date.now(),
): OfferWithDistance[] {
  return items
    .map((item) => ({ item, score: scoreOfferForUser(item, favorites, now) }))
    .sort(
      (a, b) =>
        b.score - a.score || b.item.offer.createdAt.getTime() - a.item.offer.createdAt.getTime(),
    )
    .map(({ item }) => item);
}
