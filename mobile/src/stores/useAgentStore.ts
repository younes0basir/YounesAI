import { create } from 'zustand';
import { api } from '@/services/api';
import { mmkvGet, mmkvSet } from '@/services/mmkv';
import { getChatSessionId, SESSION_KEY } from '@/hooks/useChat';
import { queryClient } from '@/lib/queryClient';
import { getApiErrorMessage } from '@/lib/apiErrors';
import type { AgentChatResult, AgentStep } from '@/lib/types';

const AGENT_LABELS: Record<string, string> = {
  task: 'Task Agent',
  event: 'Event Agent',
  email: 'Email Agent',
  file: 'File Agent',
  place: 'Place Agent',
  memory: 'Memory Agent',
  image: 'Image Agent',
  general: 'General Agent',
  gemma: 'Gemma Agent',
};

function toSteps(agents: string[] | undefined): AgentStep[] {
  const list = agents && agents.length > 0 ? agents : ['general'];
  return list.map((agent, i) => ({
    id: `${agent}-${i}`,
    agent,
    label: AGENT_LABELS[agent] ?? `${agent} Agent`,
    status: 'pending',
  }));
}

interface AgentState {
  sessionId: string | null;
  isProcessing: boolean;
  isRecording: boolean;
  lastResponse: string | null;
  lastImage: string | null;
  lastTranscription: string | null;
  steps: AgentStep[];
  sendMessage: (message: string) => Promise<void>;
  sendVoice: (uri: string) => Promise<void>;
  setRecording: (recording: boolean) => void;
  reset: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  sessionId: mmkvGet<string>(SESSION_KEY) ?? null,
  isProcessing: false,
  isRecording: false,
  lastResponse: null,
  lastImage: null,
  lastTranscription: null,
  steps: [],

  async sendMessage(message) {
    set({ isProcessing: true, lastResponse: null, lastImage: null, lastTranscription: null });
    try {
      const sessionId = getChatSessionId();
      const { data } = await api.post<AgentChatResult>('/api/agents/chat', {
        message,
        sessionId,
      });
      if (data.sessionId) {
        mmkvSet(SESSION_KEY, data.sessionId);
        set({ sessionId: data.sessionId });
      }
      await runStepSequence(toSteps(data.agents), set);
      set({
        lastResponse: data.response || data.message || null,
        lastImage:
          (data as any).image ??
          (data as any).entities?.attachments?.find?.((a: any) => a.type === 'image')?.url ??
          null,
        lastTranscription: null,
        isProcessing: false,
      });
      // keep chat history in sync
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (data.agents?.includes('task'))
        void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (data.agents?.includes('event'))
        void queryClient.invalidateQueries({ queryKey: ['events'] });
      if (data.agents?.includes('image'))
        void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (error) {
      set({
        isProcessing: false,
        steps: [{ id: 'error', agent: 'general', label: 'Request failed', status: 'error' }],
        lastResponse: getApiErrorMessage(error, 'Something went wrong'),
      });
    }
  },

  async sendVoice(uri) {
    set({ isProcessing: true, lastResponse: null, lastImage: null, lastTranscription: null });
    try {
      // unified voice endpoint: flatten nested agentResponse for backwards compat
      const form = new FormData();
      form.append('audio', { uri, name: 'voice.m4a', type: 'audio/m4a' } as unknown as Blob);
      form.append('sessionId', getChatSessionId());
      const { data: raw } = await api.post('/api/agents/voice/process', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      const data: AgentChatResult =
        raw?.agentResponse != null
          ? {
              ...raw.agentResponse,
              transcription: raw.transcription,
              sessionId: raw.agentResponse.sessionId || raw.sessionId,
            }
          : raw;
      if (data.sessionId) {
        mmkvSet(SESSION_KEY, data.sessionId);
        set({ sessionId: data.sessionId });
      }
      await runStepSequence(toSteps(data.agents), set);
      set({
        lastResponse: data.response || data.message || null,
        lastImage:
          (data as any).image ??
          (data as any).entities?.attachments?.find?.((a: any) => a.type === 'image')?.url ??
          null,
        lastTranscription: data.transcription ?? (raw?.transcription as string | undefined) ?? null,
        isProcessing: false,
      });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (data.agents?.includes('task'))
        void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (data.agents?.includes('event'))
        void queryClient.invalidateQueries({ queryKey: ['events'] });
    } catch (error) {
      set({
        isProcessing: false,
        steps: [{ id: 'error', agent: 'general', label: 'Voice request failed', status: 'error' }],
        lastResponse: getApiErrorMessage(error, 'Something went wrong'),
      });
    }
  },

  setRecording: (recording) => set({ isRecording: recording }),

  reset: () =>
    set({
      sessionId: null,
      isProcessing: false,
      isRecording: false,
      lastResponse: null,
      lastImage: null,
      lastTranscription: null,
      steps: [],
    }),
}));

/**
 * The chat endpoint returns the final agent list after orchestration completes,
 * so steps are replayed as a short sequence to give live feedback in the UI.
 */
async function runStepSequence(
  steps: AgentStep[],
  set: (partial: Partial<AgentState>) => void
): Promise<void> {
  for (let i = 0; i < steps.length; i++) {
    set({
      steps: steps.map((s, j) => ({
        ...s,
        status: j < i ? 'done' : j === i ? 'active' : 'pending',
      })),
    });
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  set({ steps: steps.map((s) => ({ ...s, status: 'done' })) });
}
