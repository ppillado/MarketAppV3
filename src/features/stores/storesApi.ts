import { toOfferCategories, toOfferCategory } from '@/constants/categories';
import { GRAN_CONCEPCION_REGION } from '@/features/map/constants';
import { MOCK_OFFERS } from '@/features/offers/mockOffers';
import type { Vote } from '@/features/offers/votesApi';
import { distanceInMeters } from '@/lib/geo';
import { kvStorage } from '@/lib/kv-storage';
import { supabase } from '@/lib/supabase';
import type { Coords } from '@/types/geo';
import type { Offer } from '@/types/offer';
import type { NearbyStore, Store } from '@/types/store';

/** The app covers Gran Concepción, so one region-wide query serves the whole map. */
const QUERY_RADIUS_M = 40_000;
const CACHE_KEY = 'stores-cache-v1';

/** Row shape returned by `nearby_stores` / `find_nearby_stores` (supabase/migrations). */
type StoreRow = {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  distance_meters: number;
  active_offers_count: number;
  /** Only nearby_stores returns it. */
  categories?: string[] | null;
};

/** Row shape returned by `get_store_offers`. */
type StoreOfferRow = {
  id: string;
  product: string;
  price: number;
  photo_url: string | null;
  confirmations: number;
  reports: number;
  created_at: string;
  my_vote: Vote | null;
  category: string;
};

export type CachedStores = { savedAt: number; stores: Store[] };

export type StoreOffers = {
  offers: Offer[];
  /** The caller's votes on these offers, as stored on the server. */
  myVotes: Record<string, Vote>;
};

const toNearbyStore = (row: StoreRow): NearbyStore => ({
  id: row.id,
  name: row.name,
  address: row.address,
  coords: { latitude: row.lat, longitude: row.lng },
  activeOffersCount: row.active_offers_count,
  categories: toOfferCategories(row.categories),
  distanceMeters: row.distance_meters,
});

/** Stores with at least one current offer in Gran Concepción (map pins). */
export async function fetchStores(): Promise<Store[]> {
  if (!supabase) throw new Error('Supabase no está configurado');

  const { data, error } = await supabase.rpc('nearby_stores', {
    user_lat: GRAN_CONCEPCION_REGION.latitude,
    user_lng: GRAN_CONCEPCION_REGION.longitude,
    radius_meters: QUERY_RADIUS_M,
  });
  if (error) throw error;

  // The distance is from the region center, not the user: drop it.
  return (data as StoreRow[]).map((row) => {
    const { distanceMeters: _, ...store } = toNearbyStore(row);
    return store;
  });
}

/** Current offers of one store, newest first, with the caller's votes. */
export async function fetchStoreOffers(store: Store): Promise<StoreOffers> {
  if (!supabase) {
    // Mock mode: the mock store id is the store name (see mockStores).
    const offers = MOCK_OFFERS.filter((offer) => offer.storeName === store.name);
    return { offers, myVotes: {} };
  }

  const { data, error } = await supabase.rpc('get_store_offers', { p_store_id: store.id });
  if (error) throw error;

  const rows = data as StoreOfferRow[];
  return {
    offers: rows.map((row) => ({
      id: row.id,
      product: row.product,
      price: row.price,
      storeName: store.name,
      category: toOfferCategory(row.category),
      coords: store.coords,
      createdAt: new Date(row.created_at),
      photoUrl: row.photo_url,
      confirmations: row.confirmations,
      reports: row.reports,
    })),
    myVotes: Object.fromEntries(
      rows.flatMap((row) => (row.my_vote ? [[row.id, row.my_vote]] : [])),
    ),
  };
}

/** Every store within `radiusMeters` of `coords` (with or without offers), nearest first. */
export async function findNearbyStores(coords: Coords, radiusMeters = 200): Promise<NearbyStore[]> {
  if (!supabase) {
    return mockStores()
      .map((store) => ({ ...store, distanceMeters: distanceInMeters(coords, store.coords) }))
      .filter((store) => store.distanceMeters <= radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  const { data, error } = await supabase.rpc('find_nearby_stores', {
    user_lat: coords.latitude,
    user_lng: coords.longitude,
    radius_meters: radiusMeters,
  });
  if (error) throw error;
  return (data as StoreRow[]).map(toNearbyStore);
}

/** Fallback stores while Supabase isn't configured: one per mock store name. */
export function mockStores(): Store[] {
  const byName = new Map<string, Store>();
  for (const offer of MOCK_OFFERS) {
    const existing = byName.get(offer.storeName);
    if (existing) {
      existing.activeOffersCount += 1;
      if (!existing.categories.includes(offer.category)) existing.categories.push(offer.category);
    } else
      byName.set(offer.storeName, {
        id: offer.storeName,
        name: offer.storeName,
        address: null,
        coords: offer.coords,
        activeOffersCount: 1,
        categories: [offer.category],
      });
  }
  return [...byName.values()];
}

/** Last successful fetch, read synchronously so the map has pins on the very first frame. */
export function readCachedStores(): CachedStores | null {
  try {
    const raw = kvStorage.getItemSync(CACHE_KEY);
    if (!raw) return null;
    // Caches saved before categories existed have no `categories`.
    const parsed = JSON.parse(raw) as {
      savedAt: number;
      stores: (Omit<Store, 'categories'> & { categories?: unknown })[];
    };
    return {
      savedAt: parsed.savedAt,
      stores: parsed.stores.map((store) => ({
        ...store,
        categories: toOfferCategories(store.categories),
      })),
    };
  } catch {
    return null;
  }
}

export function writeCachedStores(stores: Store[]): CachedStores {
  const cache = { savedAt: Date.now(), stores };
  kvStorage.setItem(CACHE_KEY, JSON.stringify(cache)).catch(() => {});
  return cache;
}
