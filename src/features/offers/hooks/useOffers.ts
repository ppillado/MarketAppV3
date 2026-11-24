import { useUserLocation } from '@/features/location/LocationProvider';
import { distanceInMeters } from '@/lib/geo';
import type { Offer } from '@/types/offer';

import { useOffersStore } from '../OffersProvider';

export type OfferWithDistance = {
  offer: Offer;
  /** Metros desde la posición GPS en vivo del usuario; null hasta que se conoce la posición. */
  distanceMeters: number | null;
};

/**
 * Ofertas para los pines del mapa y la lista de Ofertas (Supabase + caché local, ver OffersProvider),
 * con la distancia desde la posición en vivo del usuario.
 */
export function useOffers() {
  const store = useOffersStore();
  const { coords } = useUserLocation();

  const withDistance: OfferWithDistance[] = store.offers.map((offer) => ({
    offer,
    distanceMeters: coords ? distanceInMeters(coords, offer.coords) : null,
  }));

  // `store.offers` mantiene la misma referencia entre actualizaciones de GPS (los clusters del mapa dependen de eso).
  return { ...store, withDistance, hasLocation: coords !== null };
}
