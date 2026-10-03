import type { Offer } from '@/types/offer';

import { MOCK_OFFERS } from '../mockOffers';

/**
 * Single source of offers for the map pins and the Ofertas feed.
 * TODO: back this with Supabase (+ local cache) when the backend is connected.
 */
export function useOffers(): { offers: Offer[] } {
  return { offers: MOCK_OFFERS };
}
