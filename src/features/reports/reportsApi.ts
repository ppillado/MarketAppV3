import type { OfferCategory } from '@/constants/categories';
import { ensureUserId } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Coords } from '@/types/geo';

const PHOTO_BUCKET = 'offer-photos';

/** Where the offer is: an existing store, or a new one created together with the offer. */
export type OfferStore =
  | { id: string }
  | { id: null; name: string; address: string | null; coords: Coords };

export type NewOffer = {
  product: string;
  price: number;
  category: OfferCategory;
  store: OfferStore;
  /** Local file URI from the image picker. */
  photoUri: string | null;
};

/** User-facing error from publishing (server validation messages are already in Spanish). */
export class PublishError extends Error {
  /**
   * submit_offer's `hint` code when the server rejected the offer, e.g. 'store_not_found' or
   * 'invalid_category' (category slug not accepted by the server).
   */
  readonly code: string | null;

  constructor(message: string, code: string | null = null) {
    super(message);
    this.code = code;
  }
}

/**
 * Publishes an offer: uploads the photo (if any) to the user's own Storage folder, then calls
 * the `submit_offer` RPC, which validates the report server-side before inserting it.
 */
export async function publishOffer(offer: NewOffer): Promise<string> {
  if (!supabase) throw new PublishError('La app todavía no está conectada al servidor.');

  const userId = await ensureUserId().catch((error: Error) => {
    throw new PublishError(error.message);
  });
  const photoUrl = offer.photoUri ? await uploadPhoto(offer.photoUri, userId) : null;

  const { store } = offer;
  const { data, error } = await supabase.rpc('submit_offer', {
    p_product: offer.product,
    p_price: offer.price,
    p_photo_url: photoUrl,
    p_category: offer.category,
    // An existing store gives the offer its name and location; otherwise a new store is created.
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

  if (error) {
    if (error.hint === 'invalid_category') {
      throw new PublishError('Elige una categoría válida para el producto.', error.hint);
    }
    // Validation errors raised by submit_offer carry a hint code and a Spanish message.
    throw error.hint
      ? new PublishError(error.message, error.hint)
      : new PublishError('No pudimos publicar la oferta. Revisa tu conexión.');
  }
  return data as string;
}

async function uploadPhoto(uri: string, userId: string): Promise<string> {
  const client = supabase!;
  const body = await fetch(uri).then((response) => response.arrayBuffer());
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;

  const { error } = await client.storage
    .from(PHOTO_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new PublishError('No pudimos subir la foto. Inténtalo de nuevo o publícala sin foto.');

  return client.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}
