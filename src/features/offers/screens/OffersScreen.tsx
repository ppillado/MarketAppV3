import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { distanceInMeters } from '@/lib/geo';
import { normalizeText } from '@/lib/text';
import type { Offer } from '@/types/offer';

import { OfferCard } from '../components/OfferCard';
import { OffersToolbar, type OfferSort } from '../components/OffersToolbar';
import { MOCK_OFFERS, MOCK_USER_COORDS } from '../mockOffers';

type OfferWithDistance = { offer: Offer; distance: number };

const ITEMS: OfferWithDistance[] = MOCK_OFFERS.map((offer) => ({
  offer,
  distance: distanceInMeters(MOCK_USER_COORDS, offer.coords),
}));

const byRecent = (a: OfferWithDistance, b: OfferWithDistance) =>
  b.offer.createdAt.getTime() - a.offer.createdAt.getTime();

const COMPARATORS: Record<OfferSort, (a: OfferWithDistance, b: OfferWithDistance) => number> = {
  recent: byRecent,
  price: (a, b) => a.offer.price - b.offer.price || byRecent(a, b),
  distance: (a, b) => a.distance - b.distance || byRecent(a, b),
};

export default function OffersScreen() {
  // Fixed reference time per mount, so "hace X min" stays consistent while scrolling.
  const [now] = useState(() => Date.now());
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<OfferSort>('recent');

  const search = normalizeText(query);
  const visible = ITEMS.filter(({ offer }) => normalizeText(offer.product).includes(search)).sort(
    COMPARATORS[sort],
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={[styles.inner, styles.header]}>
          <View style={styles.titleBlock}>
            <ThemedText type="subtitle">Ofertas</ThemedText>
            <ThemedText themeColor="textSecondary">
              Precios reportados por tus vecinos en el Gran Concepción.
            </ThemedText>
          </View>
          <OffersToolbar
            query={query}
            onQueryChange={setQuery}
            sort={sort}
            onSortChange={setSort}
          />
        </View>

        <FlatList
          data={visible}
          keyExtractor={({ offer }) => offer.id}
          renderItem={({ item }) => (
            <OfferCard offer={item.offer} distanceMeters={item.distance} now={now} />
          )}
          ItemSeparatorComponent={Separator}
          ListEmptyComponent={
            <View style={styles.empty}>
              <ThemedText type="smallBold">Sin resultados</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                No hay ofertas para “{query.trim()}”. Prueba con otro producto.
              </ThemedText>
            </View>
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.inner,
            styles.list,
            { paddingBottom: BottomTabInset + Spacing.five },
          ]}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
  },
  header: {
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.four,
  },
  titleBlock: {
    gap: Spacing.one,
  },
  list: {
    paddingTop: Spacing.one,
  },
  separator: {
    height: Spacing.three,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.six,
  },
});
