export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

/** Default viewport: Gran Concepción (Concepción, Talcahuano, San Pedro, Chiguayante, Hualpén). */
export const GRAN_CONCEPCION_REGION: MapRegion = {
  latitude: -36.8201,
  longitude: -73.0444,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

/** Zoom used when centering on the user (~4 km across, so nearby price pins stay visible). */
export const USER_REGION_DELTA = 0.04;
