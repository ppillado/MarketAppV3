import { createClient } from '@supabase/supabase-js';

import { kvStorage } from './kv-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Cliente de Supabase, o null cuando el proyecto todavía no está configurado (ver .env.example).
 * En ese caso, quienes lo usan recurren a datos de prueba locales.
 */
export const supabase =
  url && publishableKey
    ? createClient(url, publishableKey, {
        auth: {
          storage: {
            getItem: async (key) => kvStorage.getItemSync(key),
            setItem: (key, value) => kvStorage.setItem(key, value),
            removeItem: (key) => kvStorage.removeItem(key),
          },
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          // PKCE: las redirecciones OAuth (ej. al vincular Google) devuelven un código de un solo uso, no tokens.
          flowType: 'pkce',
        },
      })
    : null;
