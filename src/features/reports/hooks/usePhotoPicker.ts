import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { Alert, Linking } from 'react-native';

// JPEG al 0.6 deja una foto de celular en unos 0.5–1.5 MB, muy por debajo del límite de 5 MB del bucket,
// y el precio de la etiqueta sigue siendo legible.
const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.6,
  allowsEditing: true,
  exif: false,
};

/** Foto de la etiqueta de precio para un reporte: se toma con la cámara o se elige de la galería. */
export function usePhotoPicker() {
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const takePhoto = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permiso de cámara',
        'Activa la cámara para MarketApp en Ajustes para fotografiar la etiqueta.',
        permission.canAskAgain
          ? [{ text: 'OK' }]
          : [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Abrir Ajustes', onPress: () => Linking.openSettings() },
            ],
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }, []);

  // El selector de fotos del sistema no necesita permiso en Android 13+ ni en iOS 14+.
  const pickFromLibrary = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }, []);

  const choosePhoto = useCallback(() => {
    Alert.alert('Foto de la etiqueta', 'Una foto del precio da más confianza a tu reporte.', [
      { text: 'Tomar foto', onPress: takePhoto },
      { text: 'Elegir de la galería', onPress: pickFromLibrary },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }, [takePhoto, pickFromLibrary]);

  const clearPhoto = useCallback(() => setPhotoUri(null), []);

  return { photoUri, choosePhoto, clearPhoto };
}
