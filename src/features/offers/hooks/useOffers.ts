import { useUserLocation } from '@/features/location/LocationProvider';
import { distanceInMeters } from '@/lib/geo';
import type { Offer } from '@/types/offer';

import { useOffersStore } from '../OffersProvider';

export type OfferWithDistance = {
  offer: Offer;
  /** Meters from the user's live GPS position; null until a position is known. */
  distanceMeters: number | null;
};

/**
 * Offers for the map pins and the Ofertas feed (Supabase + local cache, see OffersProvider),
 * with distances from the user's live position.
 */
export function useOffers() {
  const store = useOffersStore();
  const { coords } = useUserLocation();

  const withDistance: OfferWithDistance[] = store.offers.map((offer) => ({
    offer,
    distanceMeters: coords ? distanceInMeters(coords, offer.coords) : null,
  }));

  // `store.offers` stays referentially stable across GPS updates (the map clusters key off it).
  return { ...store, withDistance, hasLocation: coords !== null };
}
