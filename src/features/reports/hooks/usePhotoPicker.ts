import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { Alert, Linking } from 'react-native';

// JPEG at 0.6 keeps a phone photo around 0.5–1.5 MB, well under the 5 MB bucket limit,
// while the price tag stays readable.
const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.6,
  allowsEditing: true,
  exif: false,
};

/** Price-tag photo for a report: take one with the camera or pick one from the gallery. */
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

  // The system photo picker needs no permission on Android 13+ and iOS 14+.
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
