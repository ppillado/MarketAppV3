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

/** La app cubre el Gran Concepción, así que una sola consulta para toda la región sirve a todo el mapa. */
const QUERY_RADIUS_M = 40_000;
const CACHE_KEY = 'stores-cache-v1';

/** Forma de las filas que devuelven `nearby_stores` / `find_nearby_stores` (supabase/migrations). */
type StoreRow = {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  distance_meters: number;
  active_offers_count: number;
  /** Solo nearby_stores lo devuelve. */
  categories?: string[] | null;
};

/** Forma de las filas que devuelve `get_store_offers`. */
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
  /** Los votos del usuario en estas ofertas, tal como están guardados en el servidor. */
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

/** Locales con al menos una oferta vigente en el Gran Concepción (pines del mapa). */
export async function fetchStores(): Promise<Store[]> {
  if (!supabase) throw new Error('Supabase no está configurado');

  const { data, error } = await supabase.rpc('nearby_stores', {
    user_lat: GRAN_CONCEPCION_REGION.latitude,
    user_lng: GRAN_CONCEPCION_REGION.longitude,
    radius_meters: QUERY_RADIUS_M,
  });
  if (error) throw error;

  // La distancia es desde el centro de la región, no desde el usuario: se descarta.
  return (data as StoreRow[]).map((row) => {
    const { distanceMeters: _, ...store } = toNearbyStore(row);
    return store;
  });
}

/** Ofertas vigentes de un local, más nuevas primero, con los votos del usuario. */
export async function fetchStoreOffers(store: Store): Promise<StoreOffers> {
  if (!supabase) {
    // Modo de prueba (mock): el id del local de prueba es su nombre (ver mockStores).
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

/** Todos los locales a menos de `radiusMeters` de `coords` (con o sin ofertas), más cercanos primero. */
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

/** Locales de respaldo mientras Supabase no está configurado: uno por cada nombre de local de prueba. */
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

/** Última descarga exitosa, leída de forma síncrona para que el mapa tenga pines desde el primer cuadro. */
export function readCachedStores(): CachedStores | null {
  try {
    const raw = kvStorage.getItemSync(CACHE_KEY);
    if (!raw) return null;
    // Las cachés guardadas antes de que existieran las categorías no tienen `categories`.
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
