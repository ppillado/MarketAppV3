import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * Para soportar el renderizado estático, este valor debe recalcularse en el lado del cliente en web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
