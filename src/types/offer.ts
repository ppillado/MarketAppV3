import type { OfferCategory } from '@/constants/categories';

import type { Coords } from './geo';

/** Un reporte de precio de la comunidad. Se muestra como pin en el mapa y como tarjeta en la lista de Ofertas. */
export type Offer = {
  id: string;
  product: string;
  /** Entero en CLP. */
  price: number;
  storeName: string;
  category: OfferCategory;
  coords: Coords;
  createdAt: Date;
  /** URL pública de la foto de la etiqueta de precio, si quien reportó adjuntó una. */
  photoUrl: string | null;
  /** Votos de la comunidad: "👍 Confirmar" (el precio sigue vigente) y "👎 Agotado/Error". */
  confirmations: number;
  reports: number;
};
