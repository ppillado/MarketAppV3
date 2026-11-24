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
 * Contadores después del voto del usuario, más nuevos que la lista de ofertas hasta que esta se refresca.
 * `confirmed`: vienen de la respuesta de set_offer_vote (no de la estimación optimista).
 */
type CountsOverride = VoteCounts & { at: number; confirmed: boolean };

type OfferVotes = {
  votes: Record<string, Vote>;
  counts: Record<string, CountsOverride>;
  pending: Record<string, true>;
  toggleVote: (offer: Offer, vote: Vote, shown: VoteCounts) => void;
  /** Combina los votos del servidor para estas ofertas (ej. desde get_store_offers). */
  syncVotes: (offerIds: string[], serverVotes: Record<string, Vote>) => void;
};

const OfferVotesContext = createContext<OfferVotes | null>(null);

const delta = (vote: Vote | null, kind: Vote) => (vote === kind ? 1 : 0);

/**
 * Los votos del usuario actual, compartidos por la tarjeta del mapa y la lista de Ofertas. Los votos se aplican
 * de forma optimista, se guardan en Supabase (uno por usuario y oferta, vía set_offer_vote) y
 * en la caché local, para que los botones presionados se vean al instante y sin conexión.
 */
export function OfferVotesProvider({ children }: { children: ReactNode }) {
  const [votes, setVotes] = useState<Record<string, Vote>>(readCachedVotes);
  const [counts, setCounts] = useState<Record<string, CountsOverride>>({});
  const [pending, setPending] = useState<Record<string, true>>({});
  const { refresh: refreshOffers } = useOffersStore();
  const { refresh: refreshStores } = useStoresStore();

  // Sincroniza con la copia del servidor (ej. después de reinstalar, o votos hechos en otra sesión).
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
      // Tocar de nuevo tu voto actual lo quita; tocar el otro lo cambia.
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

      // Actualización optimista.
      setVote(next);
      setOfferCounts({
        confirmations: shown.confirmations - delta(previous, 'confirm') + delta(next, 'confirm'),
        reports: shown.reports - delta(previous, 'report') + delta(next, 'report'),
      });

      // Modo de prueba (mock): los votos quedan solo en el celular.
      if (!supabase) return;

      setPending((prev) => ({ ...prev, [offer.id]: true }));
      setOfferVote(offer.id, next)
        .then(
          (result) => {
            setOfferCounts(result, true);
            // El servidor la ocultó (misma regla): las listas la quitan ahora vía useIsOfferHidden, y la
            // actualización en segundo plano corrige los conteos y categorías de los pines de locales.
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
            // Vuelve a lo que se mostraba antes (ej. cannot_vote_own_offer, errores de red).
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

/** Combina los votos del servidor de un grupo de ofertas con el estado compartido de votos. */
export function useSyncVotes() {
  const context = use(OfferVotesContext);
  if (!context) throw new Error('useSyncVotes must be used inside <OfferVotesProvider>');
  return context.syncVotes;
}

/**
 * Estado del voto de una oferta, con conteos que incluyen el voto del usuario actual.
 * `fetchedAt`: cuándo se cargó `offer`, si no viene de la lista compartida de ofertas (ej. las
 * ofertas de un local); por defecto, la última actualización de la lista de ofertas.
 */
export function useOfferVote(offer: Offer, fetchedAt?: number) {
  const context = use(OfferVotesContext);
  if (!context) throw new Error('useOfferVote must be used inside <OfferVotesProvider>');
  const { updatedAt } = useOffersStore();

  const override = context.counts[offer.id];
  // Usa la respuesta del voto hasta que llegue del servidor una copia más nueva de la oferta.
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
 * `isHidden(offer, fetchedAt?)`: verdadero cuando el último voto del usuario (confirmado por el servidor y
 * más nuevo que esta copia de la oferta) hizo que cumpla la regla de ocultamiento del servidor. Una lista más
 * nueva del servidor siempre gana, así una oferta que vuelve a ser visible reaparece al refrescar.
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

/** Cuántas ofertas ha votado el usuario actual. */
export function useMyVoteCount() {
  const context = use(OfferVotesContext);
  if (!context) throw new Error('useMyVoteCount must be used inside <OfferVotesProvider>');
  return Object.keys(context.votes).length;
}
