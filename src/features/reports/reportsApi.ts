import type { OfferCategory } from '@/constants/categories';
import { ensureUserId } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Coords } from '@/types/geo';

/**
 * Conexión entre la pantalla "Reportar" y Supabase.
 * Aquí se publica una oferta nueva: primero se sube la foto (si hay) y luego se llama a la
 * función del servidor `submit_offer`, que valida todo antes de guardar. La app nunca escribe
 * directamente en la tabla `offers`: las reglas de seguridad (RLS) no lo permiten.
 */

// Nombre del "bucket" (carpeta en la nube) de Supabase Storage donde se guardan las fotos.
const PHOTO_BUCKET = 'offer-photos';

// ── 1. Tipos de datos ───────────────────────────────────────────────────────────────────────────

/** Dónde está la oferta: en un local que ya existe, o en uno nuevo que se crea junto con la oferta. */
export type OfferStore =
  | { id: string }
  | { id: null; name: string; address: string | null; coords: Coords };

/** Datos que la pantalla "Reportar" entrega para publicar una oferta. */
export type NewOffer = {
  product: string;
  price: number;
  category: OfferCategory;
  store: OfferStore;
  /** Ruta local de la foto elegida con el selector de imágenes (o null si no hay foto). */
  photoUri: string | null;
};

// ── 2. Errores para el usuario ──────────────────────────────────────────────────────────────────

/** Error que se le muestra al usuario al publicar (los mensajes del servidor ya vienen en español). */
export class PublishError extends Error {
  /**
   * Código `hint` que devuelve submit_offer cuando rechaza la oferta, por ejemplo
   * 'store_not_found' o 'invalid_category' (categoría no aceptada por el servidor).
   * Permite que la app reaccione distinto según el tipo de error.
   */
  readonly code: string | null;

  constructor(message: string, code: string | null = null) {
    super(message);
    this.code = code;
  }
}

// ── 3. Publicar la oferta ───────────────────────────────────────────────────────────────────────

/**
 * Publica una oferta en 3 pasos:
 *  1. Se asegura de que el celular tenga un usuario (anónimo si es la primera vez).
 *  2. Sube la foto (si hay) a la carpeta personal del usuario en Storage.
 *  3. Llama a la función `submit_offer` del servidor, que valida el reporte y lo guarda.
 * Devuelve el id de la oferta creada.
 */
export async function publishOffer(offer: NewOffer): Promise<string> {
  if (!supabase) throw new PublishError('La app todavía no está conectada al servidor.');

  // Paso 1: identificar al usuario (se necesita para la carpeta de fotos y los límites anti-spam).
  const userId = await ensureUserId().catch((error: Error) => {
    throw new PublishError(error.message);
  });

  // Paso 2: subir la foto primero, porque la oferta guarda la URL pública de la imagen.
  const photoUrl = offer.photoUri ? await uploadPhoto(offer.photoUri, userId) : null;

  // Paso 3: llamada RPC (función remota) a submit_offer con los datos del formulario.
  const { store } = offer;
  const { data, error } = await supabase.rpc('submit_offer', {
    p_product: offer.product,
    p_price: offer.price,
    p_photo_url: photoUrl,
    p_category: offer.category,
    // Si el local ya existe, solo se envía su id y la oferta toma su nombre y ubicación.
    // Si no, se envían los datos del local nuevo y el servidor lo crea junto con la oferta.
    ...(store.id !== null
      ? { p_store_id: store.id }
      : {
          p_store_id: null,
          p_store_name: store.name,
          p_store_address: store.address,
          p_lat: store.coords.latitude,
          p_lng: store.coords.longitude,
        }),
  });

  // Manejo de errores: se traduce la respuesta del servidor a un mensaje claro para el usuario.
  if (error) {
    if (error.hint === 'invalid_category') {
      throw new PublishError('Elige una categoría válida para el producto.', error.hint);
    }
    // Los errores de validación de submit_offer traen un código `hint` y un mensaje en español.
    // Si no hay `hint`, el problema fue de conexión y se muestra un mensaje genérico.
    throw error.hint
      ? new PublishError(error.message, error.hint)
      : new PublishError('No pudimos publicar la oferta. Revisa tu conexión.');
  }
  return data as string;
}

// ── 4. Subida de la foto ────────────────────────────────────────────────────────────────────────

/**
 * Sube la foto a Supabase Storage y devuelve su URL pública.
 * La ruta empieza con el id del usuario (`<userId>/...`): la política de seguridad del bucket
 * solo permite subir a la carpeta propia, y submit_offer vuelve a revisarlo en el servidor.
 */
async function uploadPhoto(uri: string, userId: string): Promise<string> {
  const client = supabase!;
  // Se lee el archivo local de la foto como datos binarios.
  const body = await fetch(uri).then((response) => response.arrayBuffer());
  // Nombre único: fecha actual + texto aleatorio, para que dos fotos nunca se pisen.
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;

  const { error } = await client.storage
    .from(PHOTO_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new PublishError('No pudimos subir la foto. Inténtalo de nuevo o publícala sin foto.');

  return client.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}
