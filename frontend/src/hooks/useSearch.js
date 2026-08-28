import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export function useGlobalSearch(query) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => api.get('/search', { params: { q: query } }).then((r) => r.data),
    enabled: Boolean(query && query.trim()),
  });
}
