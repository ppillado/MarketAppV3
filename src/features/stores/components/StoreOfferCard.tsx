import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { CategoryPill } from '@/components/category-pill';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { TrustBadge } from '@/features/offers/components/TrustBadge';
import { VoteBar } from '@/features/offers/components/VoteBar';
import { useTheme } from '@/hooks/use-theme';
import { formatPrice, formatTimeAgo } from '@/lib/format';
import type { Offer } from '@/types/offer';

type Props = {
  offer: Offer;
  /** When the store's offers were loaded (see useOfferVote). */
  fetchedAt: number;
  now: number;
};

/** An offer inside a store's sheet: the store is already in the header, so no store/directions row. */
export function StoreOfferCard({ offer, fetchedAt, now }: Props) {
  const theme = useTheme();

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: theme.backgroundSelected }]}>
      <View style={styles.row}>
        {offer.photoUrl && (
          <Image
            source={{ uri: offer.photoUrl }}
            style={[styles.photo, { backgroundColor: theme.backgroundSelected }]}
            contentFit="cover"
            transition={150}
            accessibilityLabel={`Foto de la etiqueta de ${offer.product}`}
          />
        )}

        <View style={styles.text}>
          <View style={styles.topRow}>
            <ThemedText style={styles.product} numberOfLines={2}>
              {offer.product}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatTimeAgo(offer.createdAt, now)}
            </ThemedText>
          </View>
          <View style={styles.pills}>
            <CategoryPill category={offer.category} />
            <TrustBadge offer={offer} fetchedAt={fetchedAt} />
          </View>
          <ThemedText style={[styles.price, { color: theme.accent }]}>
            ${formatPrice(offer.price)}
          </ThemedText>
        </View>
      </View>

      <VoteBar offer={offer} fetchedAt={fetchedAt} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  photo: {
    width: 68,
    height: 68,
    borderRadius: Spacing.three,
  },
  text: {
    flex: 1,
    gap: Spacing.one,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  product: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 600,
  },
  price: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
});
