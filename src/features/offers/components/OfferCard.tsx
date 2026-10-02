import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDistance, formatPrice, formatTimeAgo } from '@/lib/format';
import type { Offer } from '@/types/offer';

type Props = {
  offer: Offer;
  distanceMeters: number;
  now: number;
};

export function OfferCard({ offer, distanceMeters, now }: Props) {
  const theme = useTheme();

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: theme.backgroundSelected }]}
      accessible
      accessibilityLabel={`${offer.product}, ${formatPrice(offer.price)} pesos, en ${offer.storeName}, ${formatDistance(distanceMeters)}, ${formatTimeAgo(offer.createdAt, now)}`}>
      <View style={styles.topRow}>
        <ThemedText style={styles.product} numberOfLines={2}>
          {offer.product}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatTimeAgo(offer.createdAt, now)}
        </ThemedText>
      </View>

      <ThemedText style={[styles.price, { color: theme.accent }]}>
        ${formatPrice(offer.price)}
      </ThemedText>

      <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

      <View style={styles.metaRow}>
        <Meta
          icon={{ ios: 'storefront.fill', android: 'storefront', web: 'storefront' }}
          text={offer.storeName}
          style={styles.store}
        />
        <Meta
          icon={{ ios: 'location.fill', android: 'near_me', web: 'near_me' }}
          text={formatDistance(distanceMeters)}
        />
      </View>
    </ThemedView>
  );
}

function Meta({
  icon,
  text,
  style,
}: {
  icon: SymbolViewProps['name'];
  text: string;
  style?: object;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.meta, style]}>
      <SymbolView name={icon} tintColor={theme.textSecondary} size={16} />
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.metaText}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three + Spacing.one,
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  product: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 600,
  },
  price: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.one,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
  },
  store: {
    flex: 1,
  },
  metaText: {
    flexShrink: 1,
  },
});
