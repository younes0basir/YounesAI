import { MMKV } from 'react-native-mmkv';

// Mirrors the (unexported) Storage contract of createSyncStoragePersister.
interface SyncStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

interface KeyValueStorage {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  delete: (key: string) => void;
}

/**
 * react-native-mmkv is not bundled into Expo Go, so construction throws there.
 * Fall back to an in-memory shim so the app stays usable in Expo Go; dev
 * builds (expo run:android / EAS) get real persisted MMKV automatically.
 */
function createStorage(): KeyValueStorage {
  try {
    return new MMKV({ id: 'younesai-app' });
  } catch {
    const map = new Map<string, string>();
    return {
      getString: (key) => map.get(key),
      set: (key, value) => void map.set(key, value),
      delete: (key) => void map.delete(key),
    };
  }
}

export const storage = createStorage();

export function mmkvGet<T>(key: string): T | null {
  const raw = storage.getString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function mmkvSet(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}

export function mmkvDelete(key: string): void {
  storage.delete(key);
}

/** Adapter so TanStack Query's persistQueryClient can cache into MMKV. */
export const mmkvQueryStorage: SyncStorage = {
  getItem: (key) => storage.getString(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
