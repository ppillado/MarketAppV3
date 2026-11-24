import { useMemo } from 'react';
import Supercluster from 'supercluster';

import type { Coords } from '@/types/geo';
import type { Store } from '@/types/store';

import type { MapRegion } from '../constants';

type StoreProps = { storeId: string; offers: number };
type ClusterProps = { offers: number };

export type MapItem =
  | { kind: 'store'; store: Store }
  /** `count`: ofertas activas de todos los locales del grupo. */
  | { kind: 'cluster'; id: number; count: number; coords: Coords };

// Solo se agrupan los pines que se taparían en pantalla (a menos de ~40 px, o sea, el mismo barrio).
// Desde el zoom 15 (unas pocas cuadras de ancho) cada local se muestra por separado.
const CLUSTER_OPTIONS = { radius: 40, maxZoom: 14, minPoints: 2 };

/** Agrupa los pines de locales en clusters numerados para la región visible (supercluster, JS puro). */
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

  /** Nivel de zoom en que un cluster se separa, expresado como delta de región para animar hacia él. */
  const expansionDelta = (clusterId: number) =>
    360 / 2 ** Math.min(index.getClusterExpansionZoom(clusterId), CLUSTER_OPTIONS.maxZoom + 1);

  return { items, expansionDelta };
}

function regionToZoom(region: MapRegion) {
  return Math.round(Math.log2(360 / region.longitudeDelta));
}

function regionToBBox(region: MapRegion): [number, number, number, number] {
  // Se agrega media pantalla de margen para que los pines no aparezcan de golpe en los bordes al mover el mapa.
  const lngPad = region.longitudeDelta;
  const latPad = region.latitudeDelta;
  return [
    region.longitude - lngPad,
    Math.max(-85, region.latitude - latPad),
    region.longitude + lngPad,
    Math.min(85, region.latitude + latPad),
  ];
}
