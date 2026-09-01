import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/useAuthStore';
import type { CalendarEvent } from '@/lib/types';

const EVENTS_KEY = ['events'];

export function useEvents() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: [...EVENTS_KEY, userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await api.get<CalendarEvent[]>('/api/calendar_events');
      return data;
    },
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (event: Partial<CalendarEvent>) => {
      const startsAt = event.starts_at ?? new Date().toISOString();
      const endsAt =
        event.ends_at ?? new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString();
      const { data } = await api.post<CalendarEvent>('/api/calendar_events', {
        title: event.title,
        description: event.description ?? null,
        starts_at: startsAt,
        ends_at: endsAt,
        location_text: event.location_text ?? null,
      });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EVENTS_KEY }),
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<CalendarEvent> & { id: string }) => {
      const { data } = await api.put<CalendarEvent>(`/api/calendar_events/${id}`, patch);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EVENTS_KEY }),
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/calendar_events/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EVENTS_KEY }),
  });
}
