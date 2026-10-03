import { useMemo } from 'react';
import Supercluster from 'supercluster';

import type { Coords } from '@/types/geo';
import type { Offer } from '@/types/offer';

import type { MapRegion } from '../constants';

type OfferProps = { offerId: string };

export type MapItem =
  | { kind: 'offer'; offer: Offer }
  | { kind: 'cluster'; id: number; count: number; coords: Coords };

// Only pins that would overlap on screen (< ~40 px apart, i.e. same neighborhood) merge.
// From zoom 15 (a few blocks across) every offer shows on its own.
const CLUSTER_OPTIONS = { radius: 40, maxZoom: 14, minPoints: 2 };

/** Groups offers into numbered clusters for the visible region (supercluster, pure JS). */
export function useOfferClusters(offers: Offer[], region: MapRegion) {
  const index = useMemo(() => {
    const cluster = new Supercluster<OfferProps>(CLUSTER_OPTIONS);
    cluster.load(
      offers.map((offer) => ({
        type: 'Feature',
        properties: { offerId: offer.id },
        geometry: {
          type: 'Point',
          coordinates: [offer.coords.longitude, offer.coords.latitude],
        },
      })),
    );
    return cluster;
  }, [offers]);

  const items = useMemo(() => {
    const byId = new Map(offers.map((offer) => [offer.id, offer]));
    return index.getClusters(regionToBBox(region), regionToZoom(region)).flatMap((feature): MapItem[] => {
      const [longitude, latitude] = feature.geometry.coordinates;
      if ('cluster' in feature.properties && feature.properties.cluster) {
        return [
          {
            kind: 'cluster',
            id: feature.properties.cluster_id,
            count: feature.properties.point_count,
            coords: { latitude, longitude },
          },
        ];
      }
      const offer = byId.get((feature.properties as OfferProps).offerId);
      return offer ? [{ kind: 'offer', offer }] : [];
    });
  }, [index, offers, region]);

  /** Zoom level at which a cluster splits apart, as a region delta to animate to. */
  const expansionDelta = (clusterId: number) =>
    360 / 2 ** Math.min(index.getClusterExpansionZoom(clusterId), CLUSTER_OPTIONS.maxZoom + 1);

  return { items, expansionDelta };
}

function regionToZoom(region: MapRegion) {
  return Math.round(Math.log2(360 / region.longitudeDelta));
}

function regionToBBox(region: MapRegion): [number, number, number, number] {
  // Pad by half a screen so pins don't pop in at the edges while panning.
  const lngPad = region.longitudeDelta;
  const latPad = region.latitudeDelta;
  return [
    region.longitude - lngPad,
    Math.max(-85, region.latitude - latPad),
    region.longitude + lngPad,
    Math.min(85, region.latitude + latPad),
  ];
}
