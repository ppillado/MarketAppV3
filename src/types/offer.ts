import type { Coords } from './geo';

/** A community price report. Shown as a pin on the map and as a card in the Ofertas feed. */
export type Offer = {
  id: string;
  product: string;
  /** Integer CLP. */
  price: number;
  storeName: string;
  coords: Coords;
  createdAt: Date;
  /** Community votes: "👍 Confirmar" (price still valid) and "👎 Agotado/Error". */
  confirmations: number;
  reports: number;
};
