import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { AppNotification } from '@/lib/types';

const KEY = ['notifications'];

export function useNotifications() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data } = await api.get<AppNotification[]>('/api/notifications');
      return data;
    },
    refetchInterval: 60000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.put(`/api/notifications/${id}`, {
        read_at: new Date().toISOString(),
      });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
      void queryClient.invalidateQueries({ queryKey: ['pending-alerts'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: items } = await api.get<AppNotification[]>('/api/notifications');
      const unread = (items ?? []).filter((n) => !n.read_at);
      await Promise.all(
        unread.map((n) =>
          api.put(`/api/notifications/${n.id}`, { read_at: new Date().toISOString() })
        )
      );
      return unread.length;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
      void queryClient.invalidateQueries({ queryKey: ['pending-alerts'] });
    },
  });
}
