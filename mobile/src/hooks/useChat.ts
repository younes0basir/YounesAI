import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { mmkvGet, mmkvSet } from '@/services/mmkv';
import { queryClient } from '@/lib/queryClient';
import type { AgentChatResult, ConversationMessage } from '@/lib/types';

export const SESSION_KEY = 'chat-session-id';

export function getChatSessionId(): string {
  let id = mmkvGet<string>(SESSION_KEY);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    mmkvSet(SESSION_KEY, id);
  }
  return id;
}

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const { data } = await api.get<ConversationMessage[]>('/api/agents/conversations');
      return Array.isArray(data) ? data : [];
    },
  });
}

async function invalidateAfterAgents(agents: string[] | undefined) {
  const list = agents ?? [];
  const tasks = [queryClient.invalidateQueries({ queryKey: ['conversations'] })];
  if (list.includes('task')) tasks.push(queryClient.invalidateQueries({ queryKey: ['tasks'] }));
  if (list.includes('event')) tasks.push(queryClient.invalidateQueries({ queryKey: ['events'] }));
  if (list.includes('project'))
    tasks.push(queryClient.invalidateQueries({ queryKey: ['projects'] }));
  if (list.includes('email')) tasks.push(queryClient.invalidateQueries({ queryKey: ['emails'] }));
  if (list.includes('file') || list.includes('desktop')) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ['search'] }));
    tasks.push(queryClient.invalidateQueries({ queryKey: ['files'] }));
  }
  if (list.includes('memory'))
    tasks.push(queryClient.invalidateQueries({ queryKey: ['memories'] }));
  if (list.includes('place')) tasks.push(queryClient.invalidateQueries({ queryKey: ['places'] }));
  if (list.includes('image')) tasks.push(queryClient.invalidateQueries({ queryKey: ['images'] }));
  if (list.includes('general'))
    tasks.push(queryClient.invalidateQueries({ queryKey: ['conversations'] }));
  await Promise.all(tasks);
}

export function useSendMessage() {
  return useMutation({
    mutationFn: async ({ message, folderId }: { message: string; folderId?: string }) => {
      const { data } = await api.post<AgentChatResult>('/api/agents/chat', {
        message,
        folderId,
        sessionId: getChatSessionId(),
      });
      return data;
    },
    onSuccess: async (data) => {
      if (data?.sessionId) mmkvSet(SESSION_KEY, data.sessionId);
      await invalidateAfterAgents(data?.agents);
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useSendVoice() {
  return useMutation({
    mutationFn: async (uri: string) => {
      const form = new FormData();
      form.append('audio', {
        uri,
        name: 'voice.m4a',
        type: 'audio/m4a',
      } as unknown as Blob);
      form.append('sessionId', getChatSessionId());
      const { data } = await api.post('/api/agents/voice/process', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      // backend now returns flattened shape; tolerate legacy nested shape
      const normalized: AgentChatResult =
        data?.agentResponse != null
          ? {
              ...data.agentResponse,
              transcription: data.transcription,
              sessionId: data.agentResponse.sessionId || data.sessionId,
            }
          : data;
      return normalized as AgentChatResult;
    },
    onSuccess: async (data) => {
      if (data?.sessionId) mmkvSet(SESSION_KEY, data.sessionId);
      await invalidateAfterAgents(data?.agents);
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
