import { ensureUserId } from '@/lib/auth';
import { kvStorage } from '@/lib/kv-storage';
import { supabase } from '@/lib/supabase';

export type Vote = 'confirm' | 'report';
export type VoteCounts = { confirmations: number; reports: number };

const CACHE_KEY = 'my-votes-v1';

/** Error para mostrar al usuario al votar (los mensajes de validación del servidor ya vienen en español). */
export class VoteError extends Error {}

/** Registra o borra (null) el voto del usuario y devuelve los contadores actualizados de la oferta. */
export async function setOfferVote(offerId: string, vote: Vote | null): Promise<VoteCounts> {
  if (!supabase) throw new VoteError('La app todavía no está conectada al servidor.');

  await ensureUserId().catch((error: Error) => {
    throw new VoteError(error.message);
  });

  const { data, error } = await supabase
    .rpc('set_offer_vote', { p_offer_id: offerId, p_vote: vote })
    .single<VoteCounts>();

  if (error || !data) {
    throw new VoteError(
      error?.hint ? error.message : 'No pudimos registrar tu voto. Revisa tu conexión.',
    );
  }
  return data;
}

/**
 * Los votos del usuario desde el servidor. No crea un usuario anónimo: alguien que nunca
 * votó ni publicó no tiene votos que cargar.
 */
export async function fetchMyVotes(): Promise<Record<string, Vote> | null> {
  if (!supabase) return null;
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return null;

  // RLS limita esto a las filas propias del usuario que llama.
  const { data, error } = await supabase.from('offer_votes').select('offer_id, vote');
  if (error) return null;
  return Object.fromEntries(
    (data as { offer_id: string; vote: Vote }[]).map((row) => [row.offer_id, row.vote]),
  );
}

export function readCachedVotes(): Record<string, Vote> {
  try {
    return JSON.parse(kvStorage.getItemSync(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function writeCachedVotes(votes: Record<string, Vote>) {
  kvStorage.setItem(CACHE_KEY, JSON.stringify(votes)).catch(() => {});
}
