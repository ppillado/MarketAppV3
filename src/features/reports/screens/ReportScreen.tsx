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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
import { PublishError, publishOffer } from '../reportsApi';

const MAX_PRICE_DIGITS = 7; // up to $9.999.999 CLP

/** The store the offer goes to: an existing one (sends p_store_id) or a new one. */
type StoreChoice = { kind: 'existing'; id: string; name: string; address: string | null } | { kind: 'new' };

/** Params set by "+ Agregar oferta aquí" in a store's sheet. */
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
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [choice, setChoice] = useState<StoreChoice | null>(() => choiceFromParams(params));

  // The tab stays mounted: a later "+ Agregar oferta aquí" arrives as new params.
  const [seenStoreParam, setSeenStoreParam] = useState(params.storeId);
  if (params.storeId !== seenStoreParam) {
    setSeenStoreParam(params.storeId);
    const fromParams = choiceFromParams(params);
    if (fromParams) setChoice(fromParams);
  }

  // The offer is pinned where it was reported: the attached location, or else the live GPS fix.
  const offerCoords =
    location.state.status === 'done' ? location.state.coords : liveLocation.coords;
  const nearby = useNearbyStoreSearch(offerCoords, choice?.kind !== 'existing');

  // Nothing nearby to pick from: creating a new store is the only option.
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

  const onPriceChange = (text: string) =>
    setPriceDigits(text.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_PRICE_DIGITS));

  /** Back to "pick a store": drops the preselected store and searches nearby again. */
  const clearStoreChoice = () => {
    setChoice(null);
    if (params.storeId) router.setParams({ storeId: undefined, storeName: undefined });
    nearby.retry();
  };

  const onAttachLocation = async () => {
    const result = await location.locate();
    if (result.status !== 'done') return;
    // Suggest the street as the new store's address, without overwriting what was typed.
    if (result.address) setStoreAddress((current) => current || result.address || '');
    // Stores near the attached position, which may differ from the live GPS fix.
    nearby.retry();
  };

  const resetForm = () => {
    setProduct('');
    setPriceDigits('');
    setStoreName('');
    setStoreAddress('');
    photo.clearPhoto();
    location.clear();
    clearStoreChoice();
  };

  const onPublish = async () => {
    if (!effectiveChoice) return;
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
        product: product.trim(),
        price: Number(priceDigits),
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
      // New pin, or a higher offer count on the store's pin.
      storesStore.refresh();
      offersStore.refresh();
      Alert.alert('¡Oferta publicada!', 'Gracias por ayudar a tus vecinos a comprar más barato.', [
        { text: 'Ver en el mapa', onPress: () => router.navigate('/') },
        { text: 'Reportar otra', style: 'cancel' },
      ]);
    } catch (error) {
      if (error instanceof PublishError && error.code === 'store_not_found') {
        // The chosen store was removed meanwhile: let the user pick again.
        clearStoreChoice();
        storesStore.refresh();
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
