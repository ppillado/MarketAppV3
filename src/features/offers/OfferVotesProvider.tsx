import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { Offer } from '@/types/offer';

import { useOffersStore } from './OffersProvider';
import {
  fetchMyVotes,
  readCachedVotes,
  setOfferVote,
  VoteError,
  writeCachedVotes,
  type Vote,
  type VoteCounts,
} from './votesApi';

export type { Vote } from './votesApi';

/** Counters returned by set_offer_vote, newer than the offers list until it refreshes. */
type CountsOverride = VoteCounts & { at: number };

type OfferVotes = {
  votes: Record<string, Vote>;
  counts: Record<string, CountsOverride>;
  pending: Record<string, true>;
  toggleVote: (offer: Offer, vote: Vote, shown: VoteCounts) => void;
};

const OfferVotesContext = createContext<OfferVotes | null>(null);

const delta = (vote: Vote | null, kind: Vote) => (vote === kind ? 1 : 0);

/**
 * The current user's votes, shared by the map card and the Ofertas feed. Votes apply
 * optimistically, are stored in Supabase (one per user per offer via set_offer_vote) and
 * cached locally so the pressed buttons show instantly and offline.
 */
export function OfferVotesProvider({ children }: { children: ReactNode }) {
  const [votes, setVotes] = useState<Record<string, Vote>>(readCachedVotes);
  const [counts, setCounts] = useState<Record<string, CountsOverride>>({});
  const [pending, setPending] = useState<Record<string, true>>({});

  // Sync with the server copy (e.g. after reinstalling, or votes made on another session).
  useEffect(() => {
    fetchMyVotes().then((serverVotes) => {
      if (!serverVotes) return;
      setVotes(serverVotes);
      writeCachedVotes(serverVotes);
    });
  }, []);

  const updateVotes = useCallback(
    (update: (prev: Record<string, Vote>) => Record<string, Vote>) => {
      setVotes((prev) => {
        const next = update(prev);
        writeCachedVotes(next);
        return next;
      });
    },
    [],
  );

  const toggleVote = useCallback(
    (offer: Offer, vote: Vote, shown: VoteCounts) => {
      const previous = votes[offer.id] ?? null;
      // Tapping your current vote again removes it; tapping the other one switches.
      const next = previous === vote ? null : vote;
      const setVote = (value: Vote | null) =>
        updateVotes(({ [offer.id]: _, ...rest }) =>
          value ? { ...rest, [offer.id]: value } : rest,
        );
      const setOfferCounts = (value: VoteCounts) =>
        setCounts((prev) => ({
          ...prev,
          [offer.id]: { ...value, at: Date.now() },
        }));

      // Optimistic update.
      setVote(next);
      setOfferCounts({
        confirmations: shown.confirmations - delta(previous, 'confirm') + delta(next, 'confirm'),
        reports: shown.reports - delta(previous, 'report') + delta(next, 'report'),
      });

      // Mock mode: votes stay local.
      if (!supabase) return;

      setPending((prev) => ({ ...prev, [offer.id]: true }));
      setOfferVote(offer.id, next)
        .then(setOfferCounts, (error) => {
          setVote(previous);
          setOfferCounts(shown);
          Alert.alert(
            'No se registró tu voto',
            error instanceof VoteError ? error.message : 'Ocurrió un error inesperado.',
          );
        })
        .finally(() => setPending(({ [offer.id]: _, ...rest }) => rest));
    },
    [votes, updateVotes],
  );

  return (
    <OfferVotesContext value={{ votes, counts, pending, toggleVote }}>{children}</OfferVotesContext>
  );
}

/** Vote state for one offer, with counts that include the current user's vote. */
export function useOfferVote(offer: Offer) {
  const context = use(OfferVotesContext);
  if (!context) throw new Error('useOfferVote must be used inside <OfferVotesProvider>');
  const { updatedAt } = useOffersStore();

  const override = context.counts[offer.id];
  // Use the vote response until a newer offers list arrives from the server.
  const shown: VoteCounts =
    override && override.at > (updatedAt ?? 0)
      ? override
      : { confirmations: offer.confirmations, reports: offer.reports };

  return {
    myVote: context.votes[offer.id] ?? null,
    ...shown,
    pending: Boolean(context.pending[offer.id]),
    toggle: (vote: Vote) => context.toggleVote(offer, vote, shown),
  };
}

/** How many offers the current user has voted on. */
export function useMyVoteCount() {
  const context = use(OfferVotesContext);
  if (!context) throw new Error('useMyVoteCount must be used inside <OfferVotesProvider>');
  return Object.keys(context.votes).length;
}
