/** Community trust rules for offers, shared by the cards, the vote flow and the lists. */

type Counts = { confirmations: number; reports: number };

/** Real community backing: at least 2 confirmations and more confirmations than reports. */
export function isOfferVerified({ confirmations, reports }: Counts) {
  return confirmations >= 2 && confirmations > reports;
}

/**
 * Same rule as the server's `public.offer_should_hide` (see
 * supabase/migrations/20261008000000_offer_moderation.sql). Keep both in sync.
 */
export function shouldHideOffer(confirmations: number, reports: number) {
  return reports >= 3 && reports - confirmations >= 2;
}

/** More reports than confirmations, but not hidden yet: warn neighbors before they go. */
export function isOfferUnderReview({ confirmations, reports }: Counts) {
  return reports >= 1 && reports > confirmations && !shouldHideOffer(confirmations, reports);
}
