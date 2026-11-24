import Storage from 'expo-sqlite/kv-store';

/** Pequeño almacenamiento clave-valor persistente (con SQLite en el celular, localStorage en web). */
export const kvStorage = {
  getItemSync: (key: string) => Storage.getItemSync(key),
  setItem: (key: string, value: string) => Storage.setItem(key, value),
  removeItem: (key: string) => Storage.removeItem(key),
};
