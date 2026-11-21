import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CATEGORIES, type CategoryInfo, type OfferCategory } from '@/constants/categories';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** Selected category; null = "all" (only selectable when `allLabel` is given). */
  value: OfferCategory | null;
  onChange: (value: OfferCategory | null) => void;
  /** Adds a leading chip (e.g. "Todas") that selects null. */
  allLabel?: string;
  /** Categories to offer, in order (defaults to all of them). */
  options?: readonly CategoryInfo[];
  /** 'scroll': one horizontal row. 'wrap': chips wrap onto several lines. */
  layout?: 'scroll' | 'wrap';
  /** Solid chips with a shadow, for floating over the map. */
  floating?: boolean;
  /** Extra padding inside the scroll row (e.g. to align with the screen gutter). */
  contentContainerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** Single-choice category chips, styled like the Ofertas sort chips. */
export function CategoryChips({
  value,
  onChange,
  allLabel,
  options = CATEGORIES,
  layout = 'scroll',
  floating = false,
  contentContainerStyle,
  accessibilityLabel = 'Categoría',
}: Props) {
  const items: { id: OfferCategory | null; label: string }[] = [
    ...(allLabel ? [{ id: null, label: allLabel }] : []),
    ...options.map((category) => ({ id: category.id, label: `${category.emoji} ${category.label}` })),
  ];

  const chips = items.map((item) => (
    <Chip
      key={item.id ?? 'all'}
      label={item.label}
      selected={item.id === value}
      floating={floating}
      onPress={() => onChange(item.id)}
    />
  ));

  if (layout === 'wrap') {
    return (
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={accessibilityLabel}
        style={[styles.wrap, contentContainerStyle]}>
        {chips}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={[styles.row, contentContainerStyle]}>
      {chips}
    </ScrollView>
  );
}

/** Multi-choice category chips (wrapping rows), e.g. the user's favorite categories. */
export function MultiCategoryChips({
  value,
  onToggle,
  options = CATEGORIES,
  accessibilityLabel = 'Categorías',
}: {
  value: readonly OfferCategory[];
  onToggle: (category: OfferCategory) => void;
  options?: readonly CategoryInfo[];
  accessibilityLabel?: string;
}) {
  return (
    <View accessibilityLabel={accessibilityLabel} style={styles.wrap}>
      {options.map((category) => (
        <Chip
          key={category.id}
          label={`${category.emoji} ${category.label}`}
          selected={value.includes(category.id)}
          floating={false}
          multiple
          onPress={() => onToggle(category.id)}
        />
      ))}
    </View>
  );
}

function Chip({
  label,
  selected,
  floating,
  multiple = false,
  onPress,
}: {
  label: string;
  selected: boolean;
  floating: boolean;
  /** Checkbox semantics (multi-select) instead of radio. */
  multiple?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const idle = floating
    ? { backgroundColor: theme.background, borderColor: theme.backgroundSelected }
    : { backgroundColor: 'transparent', borderColor: theme.backgroundSelected };

  return (
    <Pressable
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={multiple ? { checked: selected } : { selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        floating && styles.floating,
        selected ? { backgroundColor: theme.text, borderColor: theme.text } : idle,
        pressed && styles.pressed,
      ]}>
      <ThemedText
        type="smallBold"
        style={{ color: selected ? theme.background : theme.textSecondary }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.two,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: 1,
  },
  floating: {
    paddingVertical: Spacing.one + Spacing.half,
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
  },
  pressed: {
    opacity: 0.7,
  },
});
