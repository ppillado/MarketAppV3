import type { Ref } from 'react';

import type { Coords } from '@/types/geo';
import type { Offer } from '@/types/offer';

export type PriceMapHandle = {
  centerOn: (coords: Coords) => void;
};

export type PriceMapProps = {
  ref?: Ref<PriceMapHandle>;
  showsUserLocation: boolean;
  offers: Offer[];
  selectedOfferId: string | null;
  onSelectOffer: (offer: Offer | null) => void;
};
