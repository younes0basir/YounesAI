import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/useAuthStore';
import type { Reminder } from '@/lib/types';

const KEY = ['reminders'];

export function useReminders() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: [...KEY, userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await api.get<Reminder[]>('/api/reminders');
      return data;
    },
  });
}

export function useCreateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Reminder>) => {
      const { data } = await api.post<Reminder>('/api/reminders', {
        title: payload.title,
        message: payload.message ?? null,
        trigger_at: payload.trigger_at ?? null,
      });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/reminders/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSnoozeReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, minutes }: { id: string; minutes: number }) => {
      const { data } = await api.post(`/api/reminders/${id}/snooze`, { minutes });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDismissReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/api/reminders/${id}/dismiss`);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
