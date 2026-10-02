import type { Ref } from 'react';

import type { Coords } from '@/types/geo';

export type PriceMapHandle = {
  centerOn: (coords: Coords) => void;
};

export type PriceMapProps = {
  ref?: Ref<PriceMapHandle>;
  showsUserLocation: boolean;
};
