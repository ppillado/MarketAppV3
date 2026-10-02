import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { FormField, FormTextInput } from '../components/FormField';
import { useCurrentLocation } from '../hooks/useCurrentLocation';

const MAX_PRICE_DIGITS = 7; // up to $9.999.999 CLP

export default function ReportScreen() {
  const theme = useTheme();
  const location = useCurrentLocation();
  const [product, setProduct] = useState('');
  const [priceDigits, setPriceDigits] = useState('');
  const [store, setStore] = useState('');

  const canPublish = product.trim() !== '' && Number(priceDigits) > 0 && store.trim() !== '';

  const onPriceChange = (text: string) =>
    setPriceDigits(text.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_PRICE_DIGITS));

  const onAddPhoto = () =>
    Alert.alert('Foto', 'La cámara y la galería se activan en el próximo build de la app.');

  const onPublish = () =>
    // TODO: send to Supabase (server-side outlier validation) once the backend is connected.
    Alert.alert(
      'Oferta lista',
      `${product.trim()} a $${formatPrice(priceDigits)} en ${store.trim()}.\n\nEl envío se activará al conectar el servidor.`,
    );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.content,
              { paddingBottom: BottomTabInset + Spacing.five },
            ]}>
            <View style={styles.header}>
              <ThemedText type="subtitle">Reportar precio</ThemedText>
              <ThemedText themeColor="textSecondary">
                Ayuda a tu barrio a comprar más barato.
              </ThemedText>
            </View>

            <FormField label="Producto">
              <FormTextInput
                value={product}
                onChangeText={setProduct}
                placeholder="Ej: Pan amasado 1 kg"
                autoCapitalize="sentences"
                returnKeyType="next"
                maxLength={80}
              />
            </FormField>

            <FormField label="Precio">
              <View
                style={[
                  styles.priceBox,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.backgroundSelected,
                  },
                ]}>
                <ThemedText style={[styles.priceText, styles.priceSymbol]} themeColor="textSecondary">
                  $
                </ThemedText>
                <TextInput
                  value={formatPrice(priceDigits)}
                  onChangeText={onPriceChange}
                  placeholder="0"
                  placeholderTextColor={theme.textSecondary}
                  selectionColor={theme.accent}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  accessibilityLabel="Precio en pesos"
                  style={[styles.priceText, styles.priceInput, { color: theme.text }]}
                />
              </View>
            </FormField>

            <FormField label="Local o supermercado" hint={locationHint(location.state)}>
              <View style={styles.storeRow}>
                <FormTextInput
                  value={store}
                  onChangeText={setStore}
                  placeholder="Ej: Almacén Don Pedro"
                  autoCapitalize="words"
                  maxLength={80}
                  style={styles.flex}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Usar mi ubicación actual"
                  onPress={location.locate}
                  disabled={location.state.status === 'loading'}
                  style={({ pressed }) => [
                    styles.locationButton,
                    {
                      backgroundColor:
                        location.state.status === 'done' ? theme.accent : theme.backgroundElement,
                      borderColor: theme.backgroundSelected,
                    },
                    pressed && styles.pressed,
                  ]}>
                  {location.state.status === 'loading' ? (
                    <ActivityIndicator color={theme.text} />
                  ) : (
                    <SymbolView
                      name={{ ios: 'location.fill', android: 'my_location', web: 'my_location' }}
                      tintColor={location.state.status === 'done' ? theme.onAccent : theme.text}
                      size={22}
                    />
                  )}
                </Pressable>
              </View>
            </FormField>

            <FormField label="Foto (opcional)">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tomar o seleccionar una foto"
                onPress={onAddPhoto}
                style={({ pressed }) => [
                  styles.photoArea,
                  { borderColor: theme.textSecondary, backgroundColor: theme.backgroundElement },
                  pressed && styles.pressed,
                ]}>
                <SymbolView
                  name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }}
                  tintColor={theme.textSecondary}
                  size={32}
                />
                <ThemedText type="smallBold">Tomar o seleccionar foto</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Una foto de la etiqueta da más confianza a tu reporte
                </ThemedText>
              </Pressable>
            </FormField>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canPublish }}
              disabled={!canPublish}
              onPress={onPublish}
              style={({ pressed }) => [
                styles.publishButton,
                { backgroundColor: theme.accent },
                !canPublish && styles.disabled,
                pressed && styles.pressed,
              ]}>
              <ThemedText style={[styles.publishText, { color: theme.onAccent }]}>
                Publicar Oferta
              </ThemedText>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** 1990 -> "1.990" (Chilean thousands separator). */
function formatPrice(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function locationHint(state: ReturnType<typeof useCurrentLocation>['state']) {
  switch (state.status) {
    case 'idle':
      return 'Toca el ícono para usar mi ubicación actual.';
    case 'loading':
      return 'Obteniendo tu ubicación…';
    case 'done':
      return `Ubicación adjunta${state.address ? `: ${state.address}` : ''}`;
    case 'error':
      return state.message;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.one,
  },
  priceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  priceText: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: 700,
  },
  priceSymbol: {
    fontWeight: 500,
  },
  priceInput: {
    flex: 1,
    padding: 0,
    fontVariant: ['tabular-nums'],
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  locationButton: {
    width: 52,
    height: 52,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoArea: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  publishButton: {
    marginTop: Spacing.two,
    minHeight: 60,
    borderRadius: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 16px rgba(14, 159, 110, 0.35)',
  },
  publishText: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 700,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.75,
  },
});
