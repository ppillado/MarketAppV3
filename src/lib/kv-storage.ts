import Storage from 'expo-sqlite/kv-store';

/** Small persistent key-value store (SQLite-backed on native, localStorage on web). */
export const kvStorage = {
  getItemSync: (key: string) => Storage.getItemSync(key),
  setItem: (key: string, value: string) => Storage.setItem(key, value),
  removeItem: (key: string) => Storage.removeItem(key),
};
