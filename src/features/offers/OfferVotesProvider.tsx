import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';

import { useStoresStore } from '@/features/stores/StoresProvider';
import { supabase } from '@/lib/supabase';
import type { Offer } from '@/types/offer';

import { shouldHideOffer } from './offerTrust';
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

/**
 * Counters after the user's vote, newer than the offers list until it refreshes.
 * `confirmed`: they come from set_offer_vote's response (not the optimistic guess).
 */
type CountsOverride = VoteCounts & { at: number; confirmed: boolean };

type OfferVotes = {
  votes: Record<string, Vote>;
  counts: Record<string, CountsOverride>;
  pending: Record<string, true>;
  toggleVote: (offer: Offer, vote: Vote, shown: VoteCounts) => void;
  /** Merges the server's votes for these offers (e.g. from get_store_offers). */
  syncVotes: (offerIds: string[], serverVotes: Record<string, Vote>) => void;
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
  const { refresh: refreshOffers } = useOffersStore();
  const { refresh: refreshStores } = useStoresStore();

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
      const setOfferCounts = (value: VoteCounts, confirmed = false) =>
        setCounts((prev) => ({
          ...prev,
          [offer.id]: {
            confirmations: value.confirmations,
            reports: value.reports,
            at: Date.now(),
            confirmed,
          },
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
        .then(
          (result) => {
            setOfferCounts(result, true);
            // The server hid it (same rule): lists drop it now via useIsOfferHidden, and the
            // background refresh updates the store pins' counts and categories.
            if (shouldHideOffer(result.confirmations, result.reports)) {
              Alert.alert(
                'Oferta ocultada',
                'Oferta ocultada por reportes de la comunidad. Gracias por avisar a tus vecinos.',
              );
              refreshOffers();
              refreshStores();
            }
          },
          (error) => {
            // Back to what was shown before (e.g. cannot_vote_own_offer, network errors).
            setVote(previous);
            setOfferCounts(shown);
            Alert.alert(
              'No se registró tu voto',
              error instanceof VoteError ? error.message : 'Ocurrió un error inesperado.',
            );
          },
        )
        .finally(() => setPending(({ [offer.id]: _, ...rest }) => rest));
    },
    [votes, updateVotes, refreshOffers, refreshStores],
  );

  const syncVotes = useCallback(
    (offerIds: string[], serverVotes: Record<string, Vote>) => {
      if (offerIds.length === 0) return;
      updateVotes((prev) => {
        const next = { ...prev };
        for (const id of offerIds) {
          if (serverVotes[id]) next[id] = serverVotes[id];
          else delete next[id];
        }
        return next;
      });
    },
    [updateVotes],
  );

  return (
    <OfferVotesContext value={{ votes, counts, pending, toggleVote, syncVotes }}>
      {children}
    </OfferVotesContext>
  );
}

/** Merges server votes for a set of offers into the shared vote state. */
export function useSyncVotes() {
  const context = use(OfferVotesContext);
  if (!context) throw new Error('useSyncVotes must be used inside <OfferVotesProvider>');
  return context.syncVotes;
}

/**
 * Vote state for one offer, with counts that include the current user's vote.
 * `fetchedAt`: when `offer` was loaded, if not from the shared offers list (e.g. a store's
 * offers); defaults to the offers list's last update.
 */
export function useOfferVote(offer: Offer, fetchedAt?: number) {
  const context = use(OfferVotesContext);
  if (!context) throw new Error('useOfferVote must be used inside <OfferVotesProvider>');
  const { updatedAt } = useOffersStore();

  const override = context.counts[offer.id];
  // Use the vote response until a newer copy of the offer arrives from the server.
  const shown: VoteCounts =
    override && override.at > (fetchedAt ?? updatedAt ?? 0)
      ? override
      : { confirmations: offer.confirmations, reports: offer.reports };

  return {
    myVote: context.votes[offer.id] ?? null,
    ...shown,
    pending: Boolean(context.pending[offer.id]),
    toggle: (vote: Vote) => context.toggleVote(offer, vote, shown),
  };
}

/**
 * `isHidden(offer, fetchedAt?)`: true when the user's last vote (confirmed by the server, and
 * newer than this copy of the offer) left it meeting the server's hide rule. A newer list from
 * the server always wins, so an offer that becomes visible again comes back on refresh.
 */
export function useIsOfferHidden() {
  const context = use(OfferVotesContext);
  if (!context) throw new Error('useIsOfferHidden must be used inside <OfferVotesProvider>');
  const { updatedAt } = useOffersStore();
  const { counts } = context;

  return useCallback(
    (offer: Offer, fetchedAt?: number) => {
      const override = counts[offer.id];
      return Boolean(
        override?.confirmed &&
          override.at > (fetchedAt ?? updatedAt ?? 0) &&
          shouldHideOffer(override.confirmations, override.reports),
      );
    },
    [counts, updatedAt],
  );
}

/** How many offers the current user has voted on. */
export function useMyVoteCount() {
  const context = use(OfferVotesContext);
  if (!context) throw new Error('useMyVoteCount must be used inside <OfferVotesProvider>');
  return Object.keys(context.votes).length;
}
