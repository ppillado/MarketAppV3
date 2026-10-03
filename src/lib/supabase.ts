import { createClient } from '@supabase/supabase-js';

import { kvStorage } from './kv-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Supabase client, or null when the project isn't configured yet (see .env.example).
 * Callers fall back to local mock data in that case.
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
        },
      })
    : null;
