import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get('/agents/conversations').then((r) => r.data),
    refetchInterval: 30000,
  })
}

export function useSendMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ message, folderId }) => api.post('/agents/chat', { message, folderId }).then((r) => r.data),
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ['conversations'] })
      // If the chat routed to task/event agents, refresh those lists too
      const agents = data?.agents || []
      if (agents.includes('task')) {
        await qc.invalidateQueries({ queryKey: ['tasks'] })
      }
      if (agents.includes('event')) {
        await qc.invalidateQueries({ queryKey: ['events'] })
      }
    },
    onError: (error) => {
      console.error('Send message error:', error)
    }
  })
}
