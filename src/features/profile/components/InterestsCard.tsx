import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { MultiCategoryChips } from '@/components/category-chips';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { usePreferences } from '@/features/preferences/PreferencesProvider';
import { useTheme } from '@/hooks/use-theme';

/** "Tus intereses": categorías favoritas para el ranking "Para ti"; se guardan con cada toque. */
export function InterestsCard() {
  const theme = useTheme();
  const { favoriteCategories, isSaving, error, toggleFavoriteCategory, clearFavoriteCategories } =
    usePreferences();
  const count = favoriteCategories.length;

  const status = isSaving
    ? 'Guardando…'
    : (error ??
      (count === 0
        ? 'Ninguna seleccionada'
        : `${count} ${count === 1 ? 'seleccionada' : 'seleccionadas'}`));

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.section, { borderColor: theme.backgroundSelected }]}>
      <View style={styles.header}>
        <SymbolView
          name={{ ios: 'star.fill', android: 'star', web: 'star' }}
          tintColor={theme.accent}
          size={20}
        />
        <ThemedText type="smallBold" style={styles.title}>
          Tus intereses
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Elige tus categorías preferidas para priorizarlas en “Para ti”.
      </ThemedText>

      <MultiCategoryChips
        value={favoriteCategories}
        onToggle={toggleFavoriteCategory}
        accessibilityLabel="Categorías favoritas"
      />

      <View style={styles.footer}>
        <ThemedText
          type="small"
          themeColor="textSecondary"
          accessibilityLiveRegion="polite"
          style={styles.status}>
          {status}
        </ThemedText>
        {count > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Limpiar categorías favoritas"
            hitSlop={8}
            onPress={clearFavoriteCategories}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              Limpiar
            </ThemedText>
          </Pressable>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
    padding: Spacing.three + Spacing.one,
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  status: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
