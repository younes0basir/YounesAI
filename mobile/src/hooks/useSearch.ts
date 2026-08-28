import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { SearchResult } from '@/lib/types';

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    enabled: query.trim().length >= 2,
    queryFn: async () => {
      const { data } = await api.get<SearchResult[]>('/api/search', {
        params: { q: query.trim() },
      });
      return Array.isArray(data) ? data : [];
    },
  });
}
