import { useCallback, useEffect, useState } from 'react';

import { useSyncVotes } from '@/features/offers/OfferVotesProvider';
import type { Offer } from '@/types/offer';
import type { Store } from '@/types/store';

import { fetchStoreOffers } from '../storesApi';

type StoreOffersState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'done'; offers: Offer[]; fetchedAt: number };

/** Current offers of one store (get_store_offers); also syncs the user's votes on them. */
export function useStoreOffers(store: Store | null) {
  const syncVotes = useSyncVotes();
  const [state, setState] = useState<StoreOffersState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    fetchStoreOffers(store).then(
      ({ offers, myVotes }) => {
        if (cancelled) return;
        syncVotes(
          offers.map((offer) => offer.id),
          myVotes,
        );
        setState({ status: 'done', offers, fetchedAt: Date.now() });
      },
      () => {
        if (!cancelled) setState({ status: 'error' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [store, attempt, syncVotes]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  return { state, reload };
}
