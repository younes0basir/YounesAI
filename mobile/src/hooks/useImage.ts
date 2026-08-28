import { useMutation } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { ImageResult } from '@/lib/types';

export interface GenerateImageInput {
  prompt: string;
  width: number;
  height: number;
  steps: number;
  seed: number;
}

export function useGenerateImage() {
  return useMutation({
    mutationFn: async (input: GenerateImageInput) => {
      const { data } = await api.post<ImageResult>('/api/image/generate', input, {
        timeout: 120000,
      });
      return data;
    },
  });
}
