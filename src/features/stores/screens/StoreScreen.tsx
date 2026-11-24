import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryChips } from '@/components/category-chips';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  CATEGORIES,
  getCategoryLabel,
  isOfferCategory,
  type OfferCategory,
} from '@/constants/categories';
import { Spacing } from '@/constants/theme';
import { useUserLocation } from '@/features/location/LocationProvider';
import { useIsOfferHidden } from '@/features/offers/OfferVotesProvider';
import { useTheme } from '@/hooks/use-theme';
import { openDirections } from '@/lib/directions';
import { formatDistance } from '@/lib/format';
import { distanceInMeters } from '@/lib/geo';
import type { Store } from '@/types/store';

import { StoreOfferCard } from '../components/StoreOfferCard';
import { useStoreOffers } from '../hooks/useStoreOffers';
import { useStoresStore } from '../StoresProvider';

/** Ficha de local (hoja sobre el mapa): encabezado, "+ Agregar oferta aquí" y sus ofertas vigentes. */
export default function StoreScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; category?: string }>();
  const { stores } = useStoresStore();
  const store = stores.find((candidate) => candidate.id === params.id) ?? null;
  const { state, reload } = useStoreOffers(store);
  const isHidden = useIsOfferHidden();
  // Hora de referencia fija, para que "hace X min" no cambie mientras se hace scroll.
  const [now] = useState(() => Date.now());
  // Se abre con el filtro de categoría del mapa, si hay; "Todas" muestra todas las ofertas del local.
  const [category, setCategory] = useState<OfferCategory | null>(() =>
    isOfferCategory(params.category) ? params.category : null,
  );

  if (!store) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ThemedText type="smallBold">Este local ya no está disponible</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Puede que ya no tenga ofertas vigentes.
        </ThemedText>
      </ThemedView>
    );
  }

  // Las ofertas que el voto del usuario acaba de ocultar (regla del servidor) salen de la lista de inmediato.
  const allOffers =
    state.status === 'done'
      ? state.offers.filter((offer) => !isHidden(offer, state.fetchedAt))
      : [];
  const offers = category ? allOffers.filter((offer) => offer.category === category) : allOffers;
  // Chips solo para las categorías que este local realmente tiene (más el filtro activo).
  const storeCategories = CATEGORIES.filter(
    (info) => info.id === category || allOffers.some((offer) => offer.category === info.id),
  );
  const showFilter = state.status === 'done' && (category !== null || storeCategories.length > 1);

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={offers}
        keyExtractor={(offer) => offer.id}
        renderItem={({ item }) =>
          state.status === 'done' ? (
            <StoreOfferCard offer={item} fetchedAt={state.fetchedAt} now={now} />
          ) : null
        }
        ListHeaderComponent={
          <>
            <StoreHeader
              store={store}
              offersCount={state.status === 'done' ? allOffers.length : store.activeOffersCount}
            />
            {showFilter && (
              <View style={styles.filter}>
                <CategoryChips
                  value={category}
                  onChange={setCategory}
                  allLabel="Todas"
                  options={storeCategories}
                  accessibilityLabel="Filtrar ofertas del local por categoría"
                  contentContainerStyle={styles.filterChips}
                />
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.listState}>
            {state.status === 'loading' && <ActivityIndicator color={theme.textSecondary} />}
            {state.status === 'error' && (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  No pudimos cargar las ofertas. Revisa tu conexión.
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  onPress={reload}
                  style={({ pressed }) => [
                    styles.retryButton,
                    { borderColor: theme.backgroundSelected },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold">Reintentar</ThemedText>
                </Pressable>
              </>
            )}
            {state.status === 'done' && category !== null && allOffers.length > 0 && (
              <>
                <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                  Este local no tiene ofertas vigentes de {getCategoryLabel(category)}.
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setCategory(null)}
                  style={({ pressed }) => [
                    styles.retryButton,
                    { borderColor: theme.backgroundSelected },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold">Ver todas las ofertas</ThemedText>
                </Pressable>
              </>
            )}
            {state.status === 'done' && allOffers.length === 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                Este local no tiene ofertas vigentes. ¡Sé el primero en reportar una!
              </ThemedText>
            )}
          </View>
        }
        ItemSeparatorComponent={Separator}
        // Espacio extra para que los botones de voto de la última tarjeta no queden bajo la barra de navegación de Android.
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.five + Spacing.four },
        ]}
        showsVerticalScrollIndicator={false}
      />
    </ThemedView>
  );
}

function StoreHeader({ store, offersCount }: { store: Store; offersCount: number }) {
  const theme = useTheme();
  const { coords } = useUserLocation();
  const distance = coords ? distanceInMeters(coords, store.coords) : null;

  const onAddOffer = () => {
    // Cierra la hoja y luego abre Reportar con este local preseleccionado.
    router.back();
    router.navigate({ pathname: '/report', params: { storeId: store.id, storeName: store.name } });
  };

  return (
    <View style={styles.header}>
      <View style={styles.titleBlock}>
        <ThemedText type="subtitle" style={styles.title} numberOfLines={2}>
          {store.name}
        </ThemedText>
        {store.address && (
          <Meta
            icon={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }}
            text={store.address}
          />
        )}
        <View style={styles.metaRow}>
          {distance !== null && (
            <Meta
              icon={{ ios: 'location.fill', android: 'near_me', web: 'near_me' }}
              text={formatDistance(distance)}
            />
          )}
          <Meta
            icon={{ ios: 'tag.fill', android: 'sell', web: 'sell' }}
            text={`${offersCount} ${offersCount === 1 ? 'oferta vigente' : 'ofertas vigentes'}`}
          />
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={onAddOffer}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: theme.accent },
            pressed && styles.pressed,
          ]}>
          <ThemedText style={[styles.addText, { color: theme.onAccent }]}>
            + Agregar oferta aquí
          </ThemedText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ir a ${store.name}`}
          onPress={() => openDirections(store.coords, store.name)}
          style={({ pressed }) => [
            styles.goButton,
            { borderColor: theme.accent },
            pressed && styles.pressed,
          ]}>
          <SymbolView
            name={{ ios: 'car.fill', android: 'directions_car', web: 'directions_car' }}
            tintColor={theme.accent}
            size={18}
          />
          <ThemedText type="smallBold" style={{ color: theme.accent }}>
            Ir
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

function Meta({ icon, text }: { icon: SymbolViewProps['name']; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.meta}>
      <SymbolView name={icon} tintColor={theme.textSecondary} size={16} />
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={styles.metaText}>
        {text}
      </ThemedText>
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    padding: Spacing.four,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  header: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  titleBlock: {
    gap: Spacing.one + Spacing.half,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.three,
    rowGap: Spacing.one,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
  },
  metaText: {
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  addButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    boxShadow: '0 6px 16px rgba(14, 159, 110, 0.35)',
  },
  addText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 700,
  },
  goButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
    minHeight: 52,
    paddingHorizontal: Spacing.three + Spacing.one,
    borderRadius: Spacing.four,
    borderWidth: 1.5,
  },
  filter: {
    // Los chips hacen scroll de borde a borde dentro del padding horizontal de la hoja.
    marginHorizontal: -Spacing.four,
    paddingBottom: Spacing.three,
  },
  filterChips: {
    paddingHorizontal: Spacing.four,
  },
  listState: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.five,
  },
  centerText: {
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 999,
    borderWidth: 1,
  },
  separator: {
    height: Spacing.three,
  },
  pressed: {
    opacity: 0.75,
  },
});
