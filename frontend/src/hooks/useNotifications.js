import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function useNotifications(filters = {}) {
  return useQuery({
    queryKey: ['notifications', filters],
    queryFn: () => api.get('/notifications', { params: filters }).then((r) => r.data),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) =>
      api.put(`/notifications/${id}`, { read_at: new Date().toISOString() }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
