import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { normalizeSearchResults } from '@/lib/normalizeSearch';

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    enabled: query.trim().length >= 2,
    queryFn: async () => {
      const { data } = await api.get('/api/search', {
        params: { q: query.trim() },
      });
      return normalizeSearchResults(data);
    },
  });
}
