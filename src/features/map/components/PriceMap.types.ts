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
  onSelectStore: (store: Store) => void;
};
