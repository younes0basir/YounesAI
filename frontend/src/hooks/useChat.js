import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

const SESSION_KEY = 'younesai_chat_session_id';

export function getChatSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get('/agents/conversations').then((r) => r.data),
    refetchInterval: 30000,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ message, folderId, sessionId }) =>
      api
        .post('/agents/chat', {
          message,
          folderId,
          sessionId: sessionId || getChatSessionId(),
        })
        .then((r) => r.data),
    onSuccess: async (data) => {
      if (data?.sessionId) {
        sessionStorage.setItem(SESSION_KEY, data.sessionId);
      }
      await qc.invalidateQueries({ queryKey: ['conversations'] });
      const agents = data?.agents || [];
      if (agents.includes('task')) {
        await qc.invalidateQueries({ queryKey: ['tasks'] });
      }
      if (agents.includes('event')) {
        await qc.invalidateQueries({ queryKey: ['events'] });
      }
      if (agents.includes('project')) {
        await qc.invalidateQueries({ queryKey: ['projects'] });
      }
    },
    onError: (error) => {
      console.error('Send message error:', error);
    },
  });
}
