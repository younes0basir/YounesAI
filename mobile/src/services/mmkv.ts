import AsyncStorage from '@react-native-async-storage/async-storage';
import { MMKV } from 'react-native-mmkv';

const ASYNC_PREFIX = 'younesai-mmkv:';

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
 * Expo Go has no native MMKV — use AsyncStorage-backed cache so query/offline
 * data survives app restarts. Standalone builds (EAS / expo run:android) use MMKV.
 */
function createAsyncStorageShim(): KeyValueStorage {
  const map = new Map<string, string>();

  return {
    getString: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, value);
      void AsyncStorage.setItem(ASYNC_PREFIX + key, value).catch(() => {});
    },
    delete: (key) => {
      map.delete(key);
      void AsyncStorage.removeItem(ASYNC_PREFIX + key).catch(() => {});
    },
  };
}

function initStorage(): { storage: KeyValueStorage; usingAsyncFallback: boolean } {
  try {
    return { storage: new MMKV({ id: 'younesai-app' }), usingAsyncFallback: false };
  } catch {
    return { storage: createAsyncStorageShim(), usingAsyncFallback: true };
  }
}

const { storage: mmkvStorage, usingAsyncFallback } = initStorage();

export const storage = mmkvStorage;

/** Load persisted keys from AsyncStorage before first render (Expo Go only). */
export async function hydrateMmkv(): Promise<void> {
  if (!usingAsyncFallback) return;

  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(ASYNC_PREFIX));
    if (ours.length === 0) return;

    const pairs = await Promise.all(
      ours.map(async (fullKey) => [fullKey, await AsyncStorage.getItem(fullKey)] as const)
    );
    for (const [fullKey, value] of pairs) {
      if (value == null) continue;
      storage.set(fullKey.slice(ASYNC_PREFIX.length), value);
    }
  } catch {
    // Non-fatal — app still runs with empty cache.
  }
}

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

/** Persisted TanStack Query cache key — must stay in sync with app/_layout.tsx */
export const PERSISTED_QUERY_KEY = 'younesai-query-cache';

/** Account-scoped keys that must be wiped on logout / account switch. */
export const ACCOUNT_MMKV_KEYS = ['chat-session-id', 'offline-mutation-queue'] as const;

/**
 * Delete all account-scoped MMKV / AsyncStorage state plus the persisted
 * query cache so the next account never sees the previous one's data.
 */
export function clearAccountStorage(): void {
  for (const key of ACCOUNT_MMKV_KEYS) storage.delete(key);
  storage.delete(PERSISTED_QUERY_KEY);
  // Expo Go fallback — ensure AsyncStorage is also cleared (shim already
  // fires async remove, but be explicit for the next cold start).
  if (usingAsyncFallback) {
    for (const key of [...ACCOUNT_MMKV_KEYS, PERSISTED_QUERY_KEY]) {
      void AsyncStorage.removeItem(ASYNC_PREFIX + key).catch(() => {});
    }
  }
}

/** Adapter so TanStack Query's persistQueryClient can cache into MMKV. */
export const mmkvQueryStorage: SyncStorage = {
  getItem: (key) => storage.getString(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
