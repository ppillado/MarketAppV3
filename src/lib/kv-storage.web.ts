/** Web variant: the browser's localStorage (expo-sqlite needs extra WASM setup on web). */
export const kvStorage = {
  getItemSync: (key: string) => globalThis.localStorage?.getItem(key) ?? null,
  setItem: async (key: string, value: string) => globalThis.localStorage?.setItem(key, value),
  removeItem: async (key: string) => globalThis.localStorage?.removeItem(key),
};
