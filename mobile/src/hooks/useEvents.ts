import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { CalendarEvent } from '@/lib/types';

const EVENTS_KEY = ['events'];

export function useEvents() {
  return useQuery({
    queryKey: EVENTS_KEY,
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
      const { data } = await api.post<CalendarEvent>('/api/calendar_events', event);
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
