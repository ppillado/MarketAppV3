import { useMemo } from 'react';
import Supercluster from 'supercluster';

import type { Coords } from '@/types/geo';
import type { Store } from '@/types/store';

import type { MapRegion } from '../constants';

type StoreProps = { storeId: string; offers: number };
type ClusterProps = { offers: number };

export type MapItem =
  | { kind: 'store'; store: Store }
  /** `count`: active offers of all the stores in the group. */
  | { kind: 'cluster'; id: number; count: number; coords: Coords };

// Only pins that would overlap on screen (< ~40 px apart, i.e. same neighborhood) merge.
// From zoom 15 (a few blocks across) every store shows on its own.
const CLUSTER_OPTIONS = { radius: 40, maxZoom: 14, minPoints: 2 };

/** Groups store pins into numbered clusters for the visible region (supercluster, pure JS). */
export function useStoreClusters(stores: Store[], region: MapRegion) {
  const index = useMemo(() => {
    const cluster = new Supercluster<StoreProps, ClusterProps>({
      ...CLUSTER_OPTIONS,
      map: (props) => ({ offers: props.offers }),
      reduce: (accumulated, props) => {
        accumulated.offers += props.offers;
      },
    });
    cluster.load(
      stores.map((store) => ({
        type: 'Feature',
        properties: { storeId: store.id, offers: store.activeOffersCount },
        geometry: {
          type: 'Point',
          coordinates: [store.coords.longitude, store.coords.latitude],
        },
      })),
    );
    return cluster;
  }, [stores]);

  const items = useMemo(() => {
    const byId = new Map(stores.map((store) => [store.id, store]));
    return index.getClusters(regionToBBox(region), regionToZoom(region)).flatMap((feature): MapItem[] => {
      const [longitude, latitude] = feature.geometry.coordinates;
      if ('cluster' in feature.properties && feature.properties.cluster) {
        return [
          {
            kind: 'cluster',
            id: feature.properties.cluster_id,
            count: feature.properties.offers,
            coords: { latitude, longitude },
          },
        ];
      }
      const store = byId.get((feature.properties as StoreProps).storeId);
      return store ? [{ kind: 'store', store }] : [];
    });
  }, [index, stores, region]);

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
