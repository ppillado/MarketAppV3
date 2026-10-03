import { useUserLocation } from '@/features/location/LocationProvider';
import { distanceInMeters } from '@/lib/geo';
import type { Offer } from '@/types/offer';

import { MOCK_OFFERS } from '../mockOffers';

export type OfferWithDistance = {
  offer: Offer;
  /** Meters from the user's live GPS position; null until a position is known. */
  distanceMeters: number | null;
};

/**
 * Single source of offers for the map pins and the Ofertas feed, with distances
 * from the user's live position.
 * TODO: back this with Supabase (+ local cache) when the backend is connected.
 */
export function useOffers() {
  const { coords } = useUserLocation();

  const offers: OfferWithDistance[] = MOCK_OFFERS.map((offer) => ({
    offer,
    distanceMeters: coords ? distanceInMeters(coords, offer.coords) : null,
  }));

  return { offers, hasLocation: coords !== null };
}
