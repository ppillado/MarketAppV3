import { ensureUserId } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Coords } from '@/types/geo';

const PHOTO_BUCKET = 'offer-photos';

export type NewOffer = {
  product: string;
  price: number;
  storeName: string;
  coords: Coords;
  /** Local file URI from the image picker. */
  photoUri: string | null;
};

/** User-facing error from publishing (server validation messages are already in Spanish). */
export class PublishError extends Error {}

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

  const { data, error } = await supabase.rpc('submit_offer', {
    p_product: offer.product,
    p_price: offer.price,
    p_store_name: offer.storeName,
    p_lat: offer.coords.latitude,
    p_lng: offer.coords.longitude,
    p_photo_url: photoUrl,
  });

  if (error) {
    // Validation errors raised by submit_offer carry a hint code and a Spanish message.
    throw new PublishError(
      error.hint ? error.message : 'No pudimos publicar la oferta. Revisa tu conexión.',
    );
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
