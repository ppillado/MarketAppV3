import { ensureUserId } from '@/lib/auth';
import { kvStorage } from '@/lib/kv-storage';
import { supabase } from '@/lib/supabase';

export type Vote = 'confirm' | 'report';
export type VoteCounts = { confirmations: number; reports: number };

const CACHE_KEY = 'my-votes-v1';

/** User-facing error from voting (server validation messages are already in Spanish). */
export class VoteError extends Error {}

/** Sets or clears (null) the user's vote and returns the offer's updated counters. */
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
 * The user's votes from the server. Doesn't create an anonymous user: someone who never
 * voted or published has no votes to load.
 */
export async function fetchMyVotes(): Promise<Record<string, Vote> | null> {
  if (!supabase) return null;
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return null;

  // RLS limits this to the caller's own rows.
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
