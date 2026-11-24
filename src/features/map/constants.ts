export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

/** Vista inicial: Gran Concepción (Concepción, Talcahuano, San Pedro, Chiguayante, Hualpén). */
export const GRAN_CONCEPCION_REGION: MapRegion = {
  latitude: -36.8201,
  longitude: -73.0444,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

/** Zoom al centrar en el usuario (~4 km de ancho, para que los pines de precios cercanos sigan visibles). */
export const USER_REGION_DELTA = 0.04;
