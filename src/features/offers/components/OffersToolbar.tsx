import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type OfferSort = 'recent' | 'price' | 'distance';

const SORT_OPTIONS: { value: OfferSort; label: string }[] = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'price', label: 'Menor precio' },
  { value: 'distance', label: 'Más cercano' },
];

type Props = {
  query: string;
  onQueryChange: (query: string) => void;
  sort: OfferSort;
  onSortChange: (sort: OfferSort) => void;
  /** "Más cercano" needs the user's position. */
  distanceSortEnabled: boolean;
};

export function OffersToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  distanceSortEnabled,
}: Props) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.search,
          { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
        ]}>
        <SymbolView
          name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
          tintColor={theme.textSecondary}
          size={18}
        />
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Buscar producto"
          placeholderTextColor={theme.textSecondary}
          selectionColor={theme.accent}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Buscar producto"
          style={[styles.searchInput, { color: theme.text }]}
        />
        {query !== '' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Borrar búsqueda"
            hitSlop={8}
            onPress={() => onQueryChange('')}>
            <SymbolView
              name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
              tintColor={theme.textSecondary}
              size={18}
            />
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        accessibilityRole="radiogroup">
        {SORT_OPTIONS.map((option) => {
          const selected = option.value === sort;
          const disabled = option.value === 'distance' && !distanceSortEnabled;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onSortChange(option.value)}
              style={({ pressed }) => [
                styles.chip,
                selected
                  ? { backgroundColor: theme.text, borderColor: theme.text }
                  : { backgroundColor: 'transparent', borderColor: theme.backgroundSelected },
                disabled && styles.disabled,
                pressed && styles.pressed,
              ]}>
              <ThemedText
                type="smallBold"
                style={{ color: selected ? theme.background : theme.textSecondary }}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.two,
  },
  chips: {
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
});
