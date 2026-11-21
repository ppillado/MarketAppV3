import type { OfferCategory } from '@/constants/categories';

import type { Coords } from './geo';

/** A store ("local") that groups offers. Shown as one pin on the map. */
export type Store = {
  id: string;
  name: string;
  address: string | null;
  coords: Coords;
  /** Offers reported in the last 7 days. */
  activeOffersCount: number;
  /** Distinct categories of those offers (empty when unknown, e.g. find_nearby_stores). */
  categories: OfferCategory[];
};

/** A store returned by a proximity search, with its distance from the searched point. */
export type NearbyStore = Store & { distanceMeters: number };
