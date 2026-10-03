import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { normalizeText } from '@/lib/text';

import { OfferCard } from '../components/OfferCard';
import { OffersToolbar, type OfferSort } from '../components/OffersToolbar';
import { useOffers, type OfferWithDistance } from '../hooks/useOffers';

const byRecent = (a: OfferWithDistance, b: OfferWithDistance) =>
  b.offer.createdAt.getTime() - a.offer.createdAt.getTime();

const COMPARATORS: Record<OfferSort, (a: OfferWithDistance, b: OfferWithDistance) => number> = {
  recent: byRecent,
  price: (a, b) => a.offer.price - b.offer.price || byRecent(a, b),
  distance: (a, b) =>
    a.distanceMeters === null || b.distanceMeters === null
      ? byRecent(a, b)
      : a.distanceMeters - b.distanceMeters || byRecent(a, b),
};

export default function OffersScreen() {
  // Fixed reference time per mount, so "hace X min" stays consistent while scrolling.
  const [now] = useState(() => Date.now());
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<OfferSort>('recent');
  const { withDistance, hasLocation } = useOffers();

  // Without a GPS fix there is nothing to sort by distance; fall back to recency.
  const effectiveSort = sort === 'distance' && !hasLocation ? 'recent' : sort;
  const search = normalizeText(query);
  const visible = withDistance
    .filter(({ offer }) => normalizeText(offer.product).includes(search))
    .sort(COMPARATORS[effectiveSort]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={[styles.inner, styles.header]}>
          <View style={styles.titleBlock}>
            <ThemedText type="subtitle">Ofertas</ThemedText>
            <ThemedText themeColor="textSecondary">
              {hasLocation
                ? 'Precios reportados por tus vecinos en el Gran Concepción.'
                : 'Activa tu ubicación para ver a qué distancia está cada oferta.'}
            </ThemedText>
          </View>
          <OffersToolbar
            query={query}
            onQueryChange={setQuery}
            sort={effectiveSort}
            onSortChange={setSort}
            distanceSortEnabled={hasLocation}
          />
        </View>

        <FlatList
          data={visible}
          keyExtractor={({ offer }) => offer.id}
          renderItem={({ item }) => (
            <OfferCard offer={item.offer} distanceMeters={item.distanceMeters} now={now} />
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
