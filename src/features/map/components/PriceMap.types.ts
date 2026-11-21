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
  /** Space taken by UI floating over the top of the map (keeps the compass below it). */
  topInset?: number;
  onSelectStore: (store: Store) => void;
};
