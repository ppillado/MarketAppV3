import type { OfferCategory } from '@/constants/categories';

import type { Coords } from './geo';

/** Un local que agrupa ofertas. Se muestra como un pin en el mapa. */
export type Store = {
  id: string;
  name: string;
  address: string | null;
  coords: Coords;
  /** Ofertas reportadas en los últimos 7 días. */
  activeOffersCount: number;
  /** Categorías distintas de esas ofertas (vacío si no se conocen, ej. find_nearby_stores). */
  categories: OfferCategory[];
};

/** Un local devuelto por una búsqueda por cercanía, con su distancia al punto buscado. */
export type NearbyStore = Store & { distanceMeters: number };
