import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { NearbyStoreSearch } from '@/features/stores/hooks/useNearbyStoreSearch';
import { useTheme } from '@/hooks/use-theme';
import { formatDistance } from '@/lib/format';
import type { NearbyStore } from '@/types/store';

type Props = {
  search: NearbyStoreSearch;
  /** 'new' cuando se elige "Crear nuevo local", null cuando aún no se elige nada. */
  selected: 'new' | null;
  onSelectStore: (store: NearbyStore) => void;
  onCreateNew: () => void;
  onRetry: () => void;
};

/** "¿Estás en alguno de estos locales?": locales existentes cercanos más "+ Crear nuevo local". */
export function NearbyStorePicker({ search, selected, onSelectStore, onCreateNew, onRetry }: Props) {
  const theme = useTheme();
  const stores = search.status === 'done' ? search.stores : [];

  return (
    <View style={styles.container}>
      {search.status === 'loading' && (
        <View style={styles.statusRow}>
          <ActivityIndicator color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            Buscando locales cercanos…
          </ThemedText>
        </View>
      )}
      {search.status === 'no-location' && (
        <ThemedText type="small" themeColor="textSecondary">
          Activa tu ubicación para ver los locales que ya existen cerca de ti.
        </ThemedText>
      )}
      {search.status === 'error' && (
        <View style={styles.statusRow}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            No pudimos buscar locales cercanos.
          </ThemedText>
          <Pressable accessibilityRole="button" onPress={onRetry} hitSlop={8}>
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              Reintentar
            </ThemedText>
          </Pressable>
        </View>
      )}
      {search.status === 'done' && stores.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          No encontramos locales registrados a menos de 200 m.
        </ThemedText>
      )}
      {stores.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          ¿Estás en alguno de estos locales?
        </ThemedText>
      )}

      {stores.map((store) => (
        <Option
          key={store.id}
          icon="store"
          title={store.name}
          subtitle={[
            formatDistance(store.distanceMeters),
            store.activeOffersCount > 0
              ? `${store.activeOffersCount} ${store.activeOffersCount === 1 ? 'oferta' : 'ofertas'}`
              : null,
            store.address,
          ]
            .filter(Boolean)
            .join(' · ')}
          selected={false}
          onPress={() => onSelectStore(store)}
        />
      ))}

      <Option
        icon="add"
        title="+ Crear nuevo local"
        subtitle={stores.length > 0 ? 'No está en la lista' : null}
        selected={selected === 'new'}
        onPress={onCreateNew}
      />
    </View>
  );
}

type OptionProps = {
  icon: 'store' | 'add';
  title: string;
  subtitle: string | null;
  selected: boolean;
  onPress: () => void;
};

function Option({ icon, title, subtitle, selected, onPress }: OptionProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: selected ? `${theme.accent}1A` : theme.backgroundElement,
          borderColor: selected ? theme.accent : theme.backgroundSelected,
        },
        pressed && styles.pressed,
      ]}>
      <SymbolView
        name={
          icon === 'store'
            ? { ios: 'storefront.fill', android: 'storefront', web: 'storefront' }
            : { ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }
        }
        tintColor={icon === 'add' || selected ? theme.accent : theme.textSecondary}
        size={22}
      />
      <View style={styles.flex}>
        <ThemedText
          type="smallBold"
          numberOfLines={1}
          style={icon === 'add' ? { color: theme.accent } : undefined}>
          {title}
        </ThemedText>
        {subtitle && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.75,
  },
});
