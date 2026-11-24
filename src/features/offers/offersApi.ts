import { toOfferCategory } from '@/constants/categories';
import { GRAN_CONCEPCION_REGION } from '@/features/map/constants';
import { kvStorage } from '@/lib/kv-storage';
import { supabase } from '@/lib/supabase';
import type { Offer } from '@/types/offer';

/** La app cubre el Gran Concepción, así que una sola consulta para toda la región sirve a todas las pantallas. */
const QUERY_RADIUS_M = 30_000;
const CACHE_KEY = 'offers-cache-v2'; // v2: las ofertas incluyen photoUrl

/** Forma de las filas que devuelve la RPC `nearby_offers` (supabase/migrations). */
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
  category: string;
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
    category: toOfferCategory(row.category),
    coords: { latitude: row.latitude, longitude: row.longitude },
    createdAt: new Date(row.created_at),
    photoUrl: row.photo_url,
    confirmations: row.confirmations,
    reports: row.reports,
  }));
}

/** Última descarga exitosa, leída de forma síncrona para que el mapa tenga pines desde el primer cuadro. */
export function readCachedOffers(): CachedOffers | null {
  try {
    const raw = kvStorage.getItemSync(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      savedAt: number;
      // Las cachés guardadas antes de que existieran las categorías no tienen `category`.
      offers: (Omit<Offer, 'createdAt' | 'category'> & { createdAt: string; category?: unknown })[];
    };
    return {
      savedAt: parsed.savedAt,
      offers: parsed.offers.map((offer) => ({
        ...offer,
        category: toOfferCategory(offer.category),
        createdAt: new Date(offer.createdAt),
      })),
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
