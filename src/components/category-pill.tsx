import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { getCategoryInfo, type OfferCategory } from '@/constants/categories';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Etiqueta pequeña y discreta con la categoría de una oferta (se muestra en las tarjetas). */
export function CategoryPill({ category }: { category: OfferCategory }) {
  const theme = useTheme();
  const info = getCategoryInfo(category);

  return (
    <View
      accessibilityLabel={`Categoría: ${info.label}`}
      style={[styles.pill, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.text} numberOfLines={1}>
        {info.emoji} {info.label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: 999,
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
  },
});
