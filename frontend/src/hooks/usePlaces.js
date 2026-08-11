import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'

export function usePlaces() {
  return useQuery({
    queryKey: ['places'],
    queryFn: () => api.get('/places').then((r) => r.data),
  })
}

export function useCreatePlace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload) => api.post('/places', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['places'] }),
  })
}

export function useUpdatePlace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/places/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['places'] }),
  })
}

export function useDeletePlace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.delete(`/places/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['places'] }),
  })
}
