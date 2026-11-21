import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Offer } from '@/types/offer';

import { isOfferUnderReview, isOfferVerified } from '../offerTrust';
import { useOfferVote } from '../OfferVotesProvider';

/**
 * "✓ Verificada" (community-confirmed) or "⚠ En revisión" (more reports than confirmations).
 * Uses the live counts, so it updates as soon as the user votes. Renders nothing otherwise.
 */
export function TrustBadge({ offer, fetchedAt }: { offer: Offer; fetchedAt?: number }) {
  const theme = useTheme();
  const counts = useOfferVote(offer, fetchedAt);

  const badge = isOfferVerified(counts)
    ? {
        text: '✓ Verificada',
        color: theme.accent,
        label: 'Oferta verificada por la comunidad',
      }
    : isOfferUnderReview(counts)
      ? {
          text: '⚠ En revisión',
          color: theme.warning,
          label: 'Oferta en revisión: tiene más reportes que confirmaciones',
        }
      : null;

  if (!badge) return null;

  return (
    <View
      accessible
      accessibilityLabel={badge.label}
      style={[styles.pill, { backgroundColor: `${badge.color}1F` }]}>
      <ThemedText type="small" style={[styles.text, { color: badge.color }]} numberOfLines={1}>
        {badge.text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: 999,
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 600,
  },
});
