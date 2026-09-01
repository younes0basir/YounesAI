import NetInfo from '@react-native-community/netinfo';
import { api, isNetworkError } from './api';
import { mmkvGet, mmkvSet } from './mmkv';

const QUEUE_KEY = 'offline-mutation-queue';

export interface QueuedMutation {
  id: string;
  method: 'post' | 'put' | 'patch' | 'delete';
  url: string;
  data?: unknown;
  queuedAt: number;
}

export function getQueue(): QueuedMutation[] {
  return mmkvGet<QueuedMutation[]>(QUEUE_KEY) ?? [];
}

function saveQueue(queue: QueuedMutation[]): void {
  mmkvSet(QUEUE_KEY, queue);
}

export function enqueueMutation(mutation: Omit<QueuedMutation, 'id' | 'queuedAt'>): void {
  const queue = getQueue();
  queue.push({
    ...mutation,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: Date.now(),
  });
  saveQueue(queue);
}

export async function flushQueue(): Promise<number> {
  const queue = getQueue();
  if (queue.length === 0) return 0;

  const remaining: QueuedMutation[] = [];
  let flushed = 0;
  for (const mutation of queue) {
    try {
      await api.request({ method: mutation.method, url: mutation.url, data: mutation.data });
      flushed++;
    } catch (error) {
      if (isNetworkError(error)) {
        remaining.push(mutation, ...queue.slice(queue.indexOf(mutation) + 1));
        break;
      }
      // Server rejected it (4xx/5xx) — drop it rather than retry forever.
    }
  }
  saveQueue(remaining);
  return flushed;
}

let listening = false;

/** Start retrying queued mutations whenever connectivity returns. Idempotent. */
export function startOfflineSync(onFlushed?: (count: number) => void): () => void {
  if (listening) return () => {};
  listening = true;

  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      void (async () => {
        // Don't flush while logged out — queue is account-scoped and will
        // be cleared on logout; flushing as anonymous would 401 and drop it.
        const { getToken } = await import('./api');
        const token = await getToken();
        if (!token) return;
        const count = await flushQueue();
        if (count > 0) onFlushed?.(count);
      })();
    }
  });

  return () => {
    listening = false;
    unsubscribe();
  };
}

/** Clear any queued mutations (called on account switch / logout). */
export function clearQueue(): void {
  mmkvSet(QUEUE_KEY, []);
}
