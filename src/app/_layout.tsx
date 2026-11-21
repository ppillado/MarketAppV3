import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { LocationProvider } from '@/features/location/LocationProvider';
import { OfferVotesProvider } from '@/features/offers/OfferVotesProvider';
import { OffersProvider } from '@/features/offers/OffersProvider';
import { StoresProvider } from '@/features/stores/StoresProvider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <LocationProvider>
        <OffersProvider>
          <StoresProvider>
            <OfferVotesProvider>
              <AnimatedSplashOverlay />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="store/[id]"
                  options={{
                    // Native bottom sheet over the map: half height, drag up to full.
                    presentation: 'formSheet',
                    sheetAllowedDetents: [0.6, 1],
                    sheetGrabberVisible: true,
                    sheetCornerRadius: 24,
                  }}
                />
              </Stack>
            </OfferVotesProvider>
          </StoresProvider>
        </OffersProvider>
      </LocationProvider>
    </ThemeProvider>
  );
}
