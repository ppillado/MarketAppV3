import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
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

import { CategoryChips } from '@/components/category-chips';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DEFAULT_CATEGORY, type OfferCategory } from '@/constants/categories';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useUserLocation } from '@/features/location/LocationProvider';
import { useOffersStore } from '@/features/offers/OffersProvider';
import { useNearbyStoreSearch } from '@/features/stores/hooks/useNearbyStoreSearch';
import { useStoresStore } from '@/features/stores/StoresProvider';
import { useTheme } from '@/hooks/use-theme';
import { formatPrice } from '@/lib/format';

import { FormField, FormTextInput } from '../components/FormField';
import { NearbyStorePicker } from '../components/NearbyStorePicker';
import { useCurrentLocation, type CurrentLocationState } from '../hooks/useCurrentLocation';
import { usePhotoPicker } from '../hooks/usePhotoPicker';
import {
  normalizeProductName,
  PRODUCT_MAX_LENGTH,
  validatePrice,
  validateProduct,
} from '../offerValidation';
import { PublishError, publishOffer } from '../reportsApi';

const MAX_PRICE_DIGITS = 6; // hasta $999.999 CLP; validatePrice lo limita a $500.000

/** Códigos de error de submit_offer que se muestran bajo un campo específico (además de la alerta). */
const PRODUCT_ERROR_CODES = new Set(['invalid_product_name']);
const PRICE_ERROR_CODES = new Set(['invalid_price', 'price_outlier']);

type ServerFieldError = { field: 'product' | 'price'; message: string } | null;

/** El local al que va la oferta: uno existente (envía p_store_id) o uno nuevo. */
type StoreChoice = { kind: 'existing'; id: string; name: string; address: string | null } | { kind: 'new' };

/** Parámetros que envía "+ Agregar oferta aquí" desde la ficha de un local. */
type ReportParams = { storeId?: string; storeName?: string };

const choiceFromParams = ({ storeId, storeName }: ReportParams): StoreChoice | null =>
  storeId && storeName ? { kind: 'existing', id: storeId, name: storeName, address: null } : null;

export default function ReportScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<ReportParams>();
  const location = useCurrentLocation();
  const liveLocation = useUserLocation();
  const offersStore = useOffersStore();
  const storesStore = useStoresStore();
  const photo = usePhotoPicker();
  const [product, setProduct] = useState('');
  const [priceDigits, setPriceDigits] = useState('');
  const [category, setCategory] = useState<OfferCategory>(DEFAULT_CATEGORY);
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [publishing, setPublishing] = useState(false);
  // Los errores se muestran al salir del campo (blur) o tras intentar publicar, no mientras se escribe.
  const [touched, setTouched] = useState({ product: false, price: false });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [serverFieldError, setServerFieldError] = useState<ServerFieldError>(null);
  const [choice, setChoice] = useState<StoreChoice | null>(() => choiceFromParams(params));

  // La pestaña sigue montada: un nuevo "+ Agregar oferta aquí" llega como parámetros nuevos.
  const [seenStoreParam, setSeenStoreParam] = useState(params.storeId);
  if (params.storeId !== seenStoreParam) {
    setSeenStoreParam(params.storeId);
    const fromParams = choiceFromParams(params);
    if (fromParams) setChoice(fromParams);
  }

  // La oferta se ubica donde se reportó: la ubicación adjunta o, si no hay, la posición GPS en vivo.
  const offerCoords =
    location.state.status === 'done' ? location.state.coords : liveLocation.coords;
  const nearby = useNearbyStoreSearch(offerCoords, choice?.kind !== 'existing');

  // No hay locales cercanos para elegir: crear un local nuevo es la única opción.
  const noStoresToPick =
    nearby.search.status === 'no-location' ||
    nearby.search.status === 'error' ||
    (nearby.search.status === 'done' && nearby.search.stores.length === 0);
  const effectiveChoice: StoreChoice | null = choice ?? (noStoresToPick ? { kind: 'new' } : null);

  const hasStore =
    effectiveChoice?.kind === 'existing' ||
    (effectiveChoice?.kind === 'new' && storeName.trim() !== '');
  const isComplete = product.trim() !== '' && Number(priceDigits) > 0 && hasStore;
  const canPublish = isComplete && !publishing;

  const productError = validateProduct(product);
  const priceError = validatePrice(Number(priceDigits));
  const productMessage =
    (serverFieldError?.field === 'product' && serverFieldError.message) ||
    ((touched.product || submitAttempted) && productError) ||
    null;
  const priceMessage =
    (serverFieldError?.field === 'price' && serverFieldError.message) ||
    ((touched.price || submitAttempted) && priceError) ||
    null;

  const onProductChange = (text: string) => {
    setProduct(text);
    if (serverFieldError?.field === 'product') setServerFieldError(null);
  };

  const onPriceChange = (text: string) => {
    setPriceDigits(text.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_PRICE_DIGITS));
    if (serverFieldError?.field === 'price') setServerFieldError(null);
  };

  /** Volver a "elegir un local": quita el local preseleccionado y vuelve a buscar cerca. */
  const clearStoreChoice = () => {
    setChoice(null);
    if (params.storeId) router.setParams({ storeId: undefined, storeName: undefined });
    nearby.retry();
  };

  const onAttachLocation = async () => {
    const result = await location.locate();
    if (result.status !== 'done') return;
    // Sugiere la calle como dirección del local nuevo, sin borrar lo que ya se escribió.
    if (result.address) setStoreAddress((current) => current || result.address || '');
    // Locales cerca de la posición adjunta, que puede ser distinta a la posición GPS en vivo.
    nearby.retry();
  };

  const resetForm = () => {
    setProduct('');
    setPriceDigits('');
    setCategory(DEFAULT_CATEGORY);
    setStoreName('');
    setStoreAddress('');
    photo.clearPhoto();
    location.clear();
    clearStoreChoice();
    setTouched({ product: false, price: false });
    setSubmitAttempted(false);
    setServerFieldError(null);
  };

  const onPublish = async () => {
    if (!effectiveChoice) return;
    // Mismas reglas que submit_offer: muestra los mensajes bajo los campos en vez de enviar.
    if (productError || priceError) {
      setSubmitAttempted(true);
      return;
    }
    if (effectiveChoice.kind === 'new' && !offerCoords) {
      Alert.alert(
        'Falta la ubicación',
        'Toca el ícono de ubicación junto al local para indicar dónde está la oferta.',
      );
      return;
    }

    setPublishing(true);
    try {
      await publishOffer({
        product: normalizeProductName(product),
        price: Number(priceDigits),
        category,
        store:
          effectiveChoice.kind === 'existing'
            ? { id: effectiveChoice.id }
            : {
                id: null,
                name: storeName.trim(),
                address: storeAddress.trim() || null,
                coords: offerCoords!,
              },
        photoUri: photo.photoUri,
      });
      resetForm();
      // Pin nuevo, o un conteo de ofertas mayor en el pin del local.
      storesStore.refresh();
      offersStore.refresh();
      Alert.alert('¡Oferta publicada!', 'Gracias por ayudar a tus vecinos a comprar más barato.', [
        { text: 'Ver en el mapa', onPress: () => router.navigate('/') },
        { text: 'Reportar otra', style: 'cancel' },
      ]);
    } catch (error) {
      if (error instanceof PublishError && error.code === 'store_not_found') {
        // El local elegido fue eliminado mientras tanto: el usuario debe elegir de nuevo.
        clearStoreChoice();
        storesStore.refresh();
      }
      // Los errores del servidor de un campo específico también quedan bajo ese campo; el formulario conserva lo escrito.
      if (error instanceof PublishError && error.code) {
        if (PRODUCT_ERROR_CODES.has(error.code)) {
          setServerFieldError({ field: 'product', message: error.message });
        } else if (PRICE_ERROR_CODES.has(error.code)) {
          setServerFieldError({ field: 'price', message: error.message });
        }
      }
      Alert.alert(
        'No se pudo publicar',
        error instanceof PublishError ? error.message : 'Ocurrió un error inesperado.',
      );
    } finally {
      setPublishing(false);
    }
  };

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

            <FormField label="Producto" error={productMessage}>
              <FormTextInput
                value={product}
                onChangeText={onProductChange}
                onBlur={() => setTouched((prev) => ({ ...prev, product: true }))}
                placeholder="Ej: Pan amasado 1 kg"
                autoCapitalize="sentences"
                returnKeyType="next"
                maxLength={PRODUCT_MAX_LENGTH}
                style={productMessage ? { borderColor: theme.danger } : undefined}
              />
            </FormField>

            <FormField label="Categoría">
              <CategoryChips
                value={category}
                onChange={(next) => setCategory(next ?? DEFAULT_CATEGORY)}
                layout="wrap"
                accessibilityLabel="Categoría del producto"
              />
            </FormField>

            <FormField label="Precio" error={priceMessage}>
              <View
                style={[
                  styles.priceBox,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: priceMessage ? theme.danger : theme.backgroundSelected,
                  },
                ]}>
                <ThemedText style={[styles.priceText, styles.priceSymbol]} themeColor="textSecondary">
                  $
                </ThemedText>
                <TextInput
                  value={formatPrice(priceDigits)}
                  onChangeText={onPriceChange}
                  onBlur={() => setTouched((prev) => ({ ...prev, price: true }))}
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

            {effectiveChoice?.kind === 'existing' ? (
              <FormField label="Local o supermercado">
                <View
                  style={[
                    styles.selectedStore,
                    { backgroundColor: `${theme.accent}1A`, borderColor: theme.accent },
                  ]}>
                  <SymbolView
                    name={{ ios: 'storefront.fill', android: 'storefront', web: 'storefront' }}
                    tintColor={theme.accent}
                    size={22}
                  />
                  <View style={styles.flex}>
                    <ThemedText type="smallBold" numberOfLines={2}>
                      {effectiveChoice.name}
                    </ThemedText>
                    {effectiveChoice.address && (
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {effectiveChoice.address}
                      </ThemedText>
                    )}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cambiar de local"
                    onPress={clearStoreChoice}
                    hitSlop={8}
                    style={({ pressed }) => pressed && styles.pressed}>
                    <ThemedText type="smallBold" style={{ color: theme.accent }}>
                      Cambiar
                    </ThemedText>
                  </Pressable>
                </View>
              </FormField>
            ) : (
              <FormField label="Local o supermercado">
                <NearbyStorePicker
                  search={nearby.search}
                  selected={effectiveChoice?.kind === 'new' ? 'new' : null}
                  onSelectStore={(store) =>
                    setChoice({
                      kind: 'existing',
                      id: store.id,
                      name: store.name,
                      address: store.address,
                    })
                  }
                  onCreateNew={() => setChoice({ kind: 'new' })}
                  onRetry={nearby.retry}
                />
              </FormField>
            )}

            {effectiveChoice?.kind === 'new' && (
              <>
              <FormField label="Nombre del nuevo local" hint={locationHint(location.state)}>
                <View style={styles.storeRow}>
                  <FormTextInput
                    value={storeName}
                    onChangeText={setStoreName}
                    placeholder="Ej: Almacén Don Pedro"
                    autoCapitalize="words"
                    maxLength={80}
                    style={styles.flex}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Usar mi ubicación actual"
                    onPress={onAttachLocation}
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
  
              <FormField label="Dirección (opcional)">
                <FormTextInput
                  value={storeAddress}
                  onChangeText={setStoreAddress}
                  placeholder="Ej: O'Higgins 1234, Concepción"
                  autoCapitalize="words"
                  maxLength={160}
                />
              </FormField>
              </>
            )}

            <FormField label="Foto (opcional)">
              {photo.photoUri ? (
                <View style={styles.photoPreview}>
                  <Image
                    source={{ uri: photo.photoUri }}
                    style={styles.photoImage}
                    contentFit="cover"
                    accessibilityLabel="Foto de la etiqueta"
                  />
                  <View style={styles.photoActions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={photo.choosePhoto}
                      style={({ pressed }) => [styles.photoAction, pressed && styles.pressed]}>
                      <ThemedText type="smallBold" style={styles.photoActionText}>
                        Cambiar
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Quitar foto"
                      onPress={photo.clearPhoto}
                      style={({ pressed }) => [styles.photoAction, pressed && styles.pressed]}>
                      <ThemedText type="smallBold" style={styles.photoActionText}>
                        Quitar
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tomar o seleccionar una foto"
                  onPress={photo.choosePhoto}
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
              )}
            </FormField>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canPublish }}
              disabled={!canPublish}
              onPress={onPublish}
              style={({ pressed }) => [
                styles.publishButton,
                { backgroundColor: theme.accent },
                !isComplete && styles.disabled,
                pressed && styles.pressed,
              ]}>
              {publishing ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <ThemedText style={[styles.publishText, { color: theme.onAccent }]}>
                  Publicar Oferta
                </ThemedText>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function locationHint(state: CurrentLocationState) {
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
  selectedStore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
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
  photoPreview: {
    borderRadius: Spacing.four,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  photoActions: {
    position: 'absolute',
    right: Spacing.two,
    bottom: Spacing.two,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  photoAction: {
    paddingVertical: Spacing.one + Spacing.half,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  photoActionText: {
    color: '#ffffff',
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
