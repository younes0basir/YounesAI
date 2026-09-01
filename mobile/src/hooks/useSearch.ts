import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { normalizeSearchResults } from '@/lib/normalizeSearch';

export function useSearch(query: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['search', userId, query],
    enabled: query.trim().length >= 2 && !!userId,
    queryFn: async () => {
      const { data } = await api.get('/api/search', {
        params: { q: query.trim() },
      });
      return normalizeSearchResults(data);
    },
  });
}
