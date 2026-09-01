import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, isNetworkError } from '@/services/api';
import { enqueueMutation } from '@/services/offlineQueue';
import { useAuthStore } from '@/stores/useAuthStore';
import type { Task } from '@/lib/types';

const TASKS_KEY = ['tasks'];

export function useTasks(filter?: Record<string, string>) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: [...TASKS_KEY, userId, filter ?? {}],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await api.get<Task[]>('/api/tasks', { params: filter });
      return data;
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (task: Partial<Task>) => {
      const { data } = await api.post<Task>('/api/tasks', task);
      return data;
    },
    onMutate: async (task) => {
      await queryClient.cancelQueries({ queryKey: TASKS_KEY });
      const previous = queryClient.getQueriesData<Task[]>({ queryKey: TASKS_KEY });
      const optimistic: Task = {
        id: `optimistic-${Date.now()}`,
        title: task.title ?? 'New task',
        status: 'pending',
        ...task,
      };
      queryClient.setQueriesData<Task[]>({ queryKey: TASKS_KEY }, (old) =>
        old ? [optimistic, ...old] : [optimistic]
      );
      return { previous };
    },
    onError: (error, task, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      if (isNetworkError(error)) enqueueMutation({ method: 'post', url: '/api/tasks', data: task });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Task> & { id: string }) => {
      const { data } = await api.put<Task>(`/api/tasks/${id}`, patch);
      return data;
    },
    onMutate: async ({ id, ...patch }) => {
      await queryClient.cancelQueries({ queryKey: TASKS_KEY });
      const previous = queryClient.getQueriesData<Task[]>({ queryKey: TASKS_KEY });
      queryClient.setQueriesData<Task[]>({ queryKey: TASKS_KEY }, (old) =>
        old?.map((t) => (t.id === id ? { ...t, ...patch } : t))
      );
      return { previous };
    },
    onError: (error, { id, ...patch }, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      if (isNetworkError(error))
        enqueueMutation({ method: 'put', url: `/api/tasks/${id}`, data: patch });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

/** Swipe-to-archive uses the backend's soft delete (sets deleted_at). */
export function useArchiveTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/tasks/${id}`);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: TASKS_KEY });
      const previous = queryClient.getQueriesData<Task[]>({ queryKey: TASKS_KEY });
      queryClient.setQueriesData<Task[]>({ queryKey: TASKS_KEY }, (old) =>
        old?.filter((t) => t.id !== id)
      );
      return { previous };
    },
    onError: (error, id, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      if (isNetworkError(error)) enqueueMutation({ method: 'delete', url: `/api/tasks/${id}` });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}
