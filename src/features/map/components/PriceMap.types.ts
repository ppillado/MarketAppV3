import type { Ref } from 'react';

import type { Coords } from '../hooks/useUserLocation';

export type PriceMapHandle = {
  centerOn: (coords: Coords) => void;
};

export type PriceMapProps = {
  ref?: Ref<PriceMapHandle>;
  showsUserLocation: boolean;
};
