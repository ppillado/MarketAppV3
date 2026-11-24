import type { Ref } from 'react';

import type { Coords } from '@/types/geo';
import type { Store } from '@/types/store';

export type PriceMapHandle = {
  centerOn: (coords: Coords) => void;
};

export type PriceMapProps = {
  ref?: Ref<PriceMapHandle>;
  showsUserLocation: boolean;
  stores: Store[];
  /** Espacio que ocupa la interfaz flotante sobre el mapa (mantiene la brújula debajo). */
  topInset?: number;
  onSelectStore: (store: Store) => void;
};
