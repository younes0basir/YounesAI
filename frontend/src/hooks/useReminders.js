import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'

export function useReminders() {
  return useQuery({
    queryKey: ['reminders'],
    queryFn: () => api.get('/reminders').then((r) => r.data),
  })
}

export function useCreateReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => api.post('/reminders', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders'] }),
  })
}

export function useUpdateReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/reminders/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders'] }),
  })
}

export function useDeleteReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/reminders/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders'] }),
  })
}

export function useSnoozeReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, minutes }) => api.post(`/reminders/${id}/snooze`, { minutes }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders'] }),
  })
}

export function useDismissReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.post(`/reminders/${id}/dismiss`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders'] }),
  })
}
