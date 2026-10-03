import { GRAN_CONCEPCION_REGION } from '@/features/map/constants';
import { kvStorage } from '@/lib/kv-storage';
import { supabase } from '@/lib/supabase';
import type { Offer } from '@/types/offer';

/** The app covers Gran Concepción, so one region-wide query serves every screen. */
const QUERY_RADIUS_M = 30_000;
const CACHE_KEY = 'offers-cache-v2'; // v2: offers include photoUrl

/** Row shape returned by the `nearby_offers` RPC (supabase/migrations). */
type NearbyOfferRow = {
  id: string;
  product: string;
  price: number;
  store_name: string;
  latitude: number;
  longitude: number;
  photo_url: string | null;
  confirmations: number;
  reports: number;
  created_at: string;
};

export type CachedOffers = { savedAt: number; offers: Offer[] };

export async function fetchOffers(): Promise<Offer[]> {
  if (!supabase) throw new Error('Supabase no está configurado');

  const { data, error } = await supabase.rpc('nearby_offers', {
    lat: GRAN_CONCEPCION_REGION.latitude,
    lng: GRAN_CONCEPCION_REGION.longitude,
    radius_m: QUERY_RADIUS_M,
  });
  if (error) throw error;

  return (data as NearbyOfferRow[]).map((row) => ({
    id: row.id,
    product: row.product,
    price: row.price,
    storeName: row.store_name,
    coords: { latitude: row.latitude, longitude: row.longitude },
    createdAt: new Date(row.created_at),
    photoUrl: row.photo_url,
    confirmations: row.confirmations,
    reports: row.reports,
  }));
}

/** Last successful fetch, read synchronously so the map has pins on the very first frame. */
export function readCachedOffers(): CachedOffers | null {
  try {
    const raw = kvStorage.getItemSync(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      savedAt: number;
      offers: (Omit<Offer, 'createdAt'> & { createdAt: string })[];
    };
    return {
      savedAt: parsed.savedAt,
      offers: parsed.offers.map((offer) => ({ ...offer, createdAt: new Date(offer.createdAt) })),
    };
  } catch {
    return null;
  }
}

export function writeCachedOffers(offers: Offer[]): CachedOffers {
  const cache = { savedAt: Date.now(), offers };
  kvStorage.setItem(CACHE_KEY, JSON.stringify(cache)).catch(() => {});
  return cache;
}
