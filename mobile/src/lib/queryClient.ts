import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24,
      retry: 1,
    },
  },
});

/**
 * Purge all cached queries (memory) — call on logout / account switch
 * before the next account loads. The persisted MMKV cache is cleared
 * separately via clearAccountStorage().
 */
export function clearQueryCache(): void {
  queryClient.clear();
  // Also cancel any in-flight refetches that might repopulate with the
  // previous user's data after logout.
  void queryClient.cancelQueries();
}
