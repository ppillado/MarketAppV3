/** Variante web: el localStorage del navegador (expo-sqlite necesita configuración WASM extra en web). */
export const kvStorage = {
  getItemSync: (key: string) => globalThis.localStorage?.getItem(key) ?? null,
  setItem: async (key: string, value: string) => globalThis.localStorage?.setItem(key, value),
  removeItem: async (key: string) => globalThis.localStorage?.removeItem(key),
};
