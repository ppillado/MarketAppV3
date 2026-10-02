import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { openDirections } from '@/lib/directions';
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
      style={[styles.card, { borderColor: theme.backgroundSelected }]}>
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

      <View style={styles.bottomRow}>
        <View style={styles.metaColumn}>
          <Meta
            icon={{ ios: 'storefront.fill', android: 'storefront', web: 'storefront' }}
            text={offer.storeName}
          />
          <Meta
            icon={{ ios: 'location.fill', android: 'near_me', web: 'near_me' }}
            text={formatDistance(distanceMeters)}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ir a ${offer.storeName}`}
          onPress={() => openDirections(offer.coords, offer.storeName)}
          style={({ pressed }) => [
            styles.goButton,
            { backgroundColor: theme.accent },
            pressed && styles.pressed,
          ]}>
          <SymbolView
            name={{ ios: 'car.fill', android: 'directions_car', web: 'directions_car' }}
            tintColor={theme.onAccent}
            size={18}
          />
          <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
            Ir
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

function Meta({ icon, text }: { icon: SymbolViewProps['name']; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.meta}>
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
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  metaColumn: {
    flex: 1,
    gap: Spacing.one,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
  },
  metaText: {
    flexShrink: 1,
  },
  goButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
    minHeight: 44,
    paddingHorizontal: Spacing.three + Spacing.one,
    borderRadius: 999,
  },
  pressed: {
    opacity: 0.75,
  },
});
