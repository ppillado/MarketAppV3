import { createContext, use, useCallback, useState, type ReactNode } from 'react';

import type { Offer } from '@/types/offer';

export type Vote = 'confirm' | 'report';

type OfferVotes = {
  voteFor: (offerId: string) => Vote | null;
  toggleVote: (offerId: string, vote: Vote) => void;
};

const OfferVotesContext = createContext<OfferVotes | null>(null);

/**
 * The current user's votes on offers, shared by the map card and the Ofertas feed.
 * TODO: persist to Supabase (one vote per user per offer) when the backend is connected.
 */
export function OfferVotesProvider({ children }: { children: ReactNode }) {
  const [votes, setVotes] = useState<Record<string, Vote>>({});

  const voteFor = useCallback((offerId: string) => votes[offerId] ?? null, [votes]);

  // Tapping your current vote again removes it; tapping the other one switches.
  const toggleVote = useCallback((offerId: string, vote: Vote) => {
    setVotes(({ [offerId]: current, ...rest }) =>
      current === vote ? rest : { ...rest, [offerId]: vote },
    );
  }, []);

  return <OfferVotesContext value={{ voteFor, toggleVote }}>{children}</OfferVotesContext>;
}

/** Vote state for one offer, with counts that include the current user's vote. */
export function useOfferVote(offer: Offer) {
  const votes = use(OfferVotesContext);
  if (!votes) throw new Error('useOfferVote must be used inside <OfferVotesProvider>');

  const myVote = votes.voteFor(offer.id);
  return {
    myVote,
    confirmations: offer.confirmations + (myVote === 'confirm' ? 1 : 0),
    reports: offer.reports + (myVote === 'report' ? 1 : 0),
    toggle: (vote: Vote) => votes.toggleVote(offer.id, vote),
  };
}
