import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getCategoryLabel, type OfferCategory } from '@/constants/categories';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { usePreferences } from '@/features/preferences/PreferencesProvider';
import { useTheme } from '@/hooks/use-theme';
import { normalizeText } from '@/lib/text';

import { OfferCard } from '../components/OfferCard';
import { OffersToolbar, type OfferSort } from '../components/OffersToolbar';
import { useOffers, type OfferWithDistance } from '../hooks/useOffers';
import { isFavoriteCategory, sortOffersForUser } from '../recommendOffers';

const byRecent = (a: OfferWithDistance, b: OfferWithDistance) =>
  b.offer.createdAt.getTime() - a.offer.createdAt.getTime();

const COMPARATORS: Record<
  Exclude<OfferSort, 'forYou'>,
  (a: OfferWithDistance, b: OfferWithDistance) => number
> = {
  recent: byRecent,
  price: (a, b) => a.offer.price - b.offer.price || byRecent(a, b),
  distance: (a, b) =>
    a.distanceMeters === null || b.distanceMeters === null
      ? byRecent(a, b)
      : a.distanceMeters - b.distanceMeters || byRecent(a, b),
};

export default function OffersScreen() {
  const theme = useTheme();
  // Fixed reference time (reset on refresh), so "hace X min" stays consistent while scrolling.
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<OfferSort>('recent');
  const [category, setCategory] = useState<OfferCategory | null>(null);
  const { withDistance, hasLocation, error, refreshing, refresh } = useOffers();
  const { favoriteCategories, isLoading: preferencesLoading } = usePreferences();

  const onRefresh = async () => {
    await refresh();
    setNow(Date.now());
  };

  // Without a GPS fix there is nothing to sort by distance; fall back to recency.
  const effectiveSort = sort === 'distance' && !hasLocation ? 'recent' : sort;
  const search = normalizeText(query);
  const matching = withDistance.filter(
    ({ offer }) =>
      (category === null || offer.category === category) &&
      normalizeText(offer.product).includes(search),
  );
  const forYou = effectiveSort === 'forYou';
  // "Para ti" without favorites still ranks by distance, freshness and votes.
  const visible = forYou
    ? sortOffersForUser(matching, favoriteCategories, now)
    : matching.sort(COMPARATORS[effectiveSort]);
  const filtered = search !== '' || category !== null;
  const showInterestsBanner = forYou && favoriteCategories.length === 0 && !preferencesLoading;

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
            category={category}
            onCategoryChange={setCategory}
          />
          {showInterestsBanner && (
            <ThemedView type="backgroundElement" style={[styles.notice, styles.banner]}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.bannerText}>
                Elige tus intereses para personalizar “Para ti”.
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.navigate('/profile')}
                style={({ pressed }) => [
                  styles.bannerButton,
                  { backgroundColor: theme.accent },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                  Elegir intereses
                </ThemedText>
              </Pressable>
            </ThemedView>
          )}
          {error && (
            <ThemedView type="backgroundElement" style={styles.notice}>
              <ThemedText type="small" themeColor="textSecondary">
                {error}
              </ThemedText>
            </ThemedView>
          )}
        </View>

        <FlatList
          data={visible}
          keyExtractor={({ offer }) => offer.id}
          renderItem={({ item }) => (
            <OfferCard
              offer={item.offer}
              distanceMeters={item.distanceMeters}
              now={now}
              forYou={forYou && isFavoriteCategory(item.offer, favoriteCategories)}
            />
          )}
          ItemSeparatorComponent={Separator}
          ListEmptyComponent={
            <View style={styles.empty}>
              <ThemedText type="smallBold">
                {filtered ? 'Sin resultados' : 'Aún no hay ofertas cerca'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                {emptyMessage(query.trim(), search !== '', category)}
              </ThemedText>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.textSecondary}
              colors={[theme.accent]}
              progressBackgroundColor={theme.backgroundElement}
            />
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

function emptyMessage(query: string, hasSearch: boolean, category: OfferCategory | null) {
  const inCategory = category ? ` en ${getCategoryLabel(category)}` : '';
  if (hasSearch) return `No hay ofertas para “${query}”${inCategory}. Prueba con otro producto.`;
  if (category) return `Aún no hay ofertas${inCategory}. Prueba con otra categoría.`;
  return 'Sé el primero en reportar un precio desde la pestaña Reportar.';
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
  emptyText: {
    textAlign: 'center',
  },
  notice: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  bannerText: {
    flex: 1,
  },
  bannerButton: {
    paddingVertical: Spacing.one + Spacing.half,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
  },
  pressed: {
    opacity: 0.75,
  },
});
