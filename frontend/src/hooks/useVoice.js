import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';

export function useTranscribe() {
  return useMutation({
    mutationFn: async (audioBlob) => {
      const form = new FormData();
      form.append('audio', audioBlob, 'recording.webm');
      const res = await api.post('/agents/voice/transcribe', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
  });
}

export function useVoiceProcess() {
  return useMutation({
    mutationFn: async ({ audioBlob, context }) => {
      const form = new FormData();
      form.append('audio', audioBlob, 'recording.webm');
      if (context) form.append('context', JSON.stringify(context));
      const res = await api.post('/agents/voice/process', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
  });
}
