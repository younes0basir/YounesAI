import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { Email, EmailApproval } from '@/lib/types';

export const AI_INBOX_FILTER = 'AI_INBOX';

export const EMAIL_CATEGORIES = [
  { id: 'ALL', label: 'All' },
  { id: AI_INBOX_FILTER, label: 'AI Inbox' },
  { id: 'IMPORTANT', label: 'Important' },
  { id: 'ACTION_REQUIRED', label: 'Action' },
  { id: 'PERSONAL', label: 'Personal' },
  { id: 'NEWSLETTER', label: 'Newsletters' },
  { id: 'PROMOTION', label: 'Promos' },
  { id: 'SPAM', label: 'Spam' },
] as const;

export function useEmails(category: string) {
  return useQuery({
    queryKey: ['emails', category],
    queryFn: async () => {
      const params: Record<string, string | number> = { page: 1, limit: 50 };
      if (category === AI_INBOX_FILTER) params.view = 'ai';
      else if (category && category !== 'ALL') params.category = category;
      const { data } = await api.get<Email[]>('/api/email', { params });
      return data;
    },
  });
}

export function useEmailDetail(id: string | null) {
  return useQuery({
    queryKey: ['email', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await api.get<Email>(`/api/email/${id}`);
      return data;
    },
  });
}

export type EmailAction =
  | 'archive'
  | 'delete'
  | 'mark_important'
  | 'mute_sender'
  | 'reclassify'
  | 'summarize'
  | 'create_task';

export function useEmailAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ emailId, action }: { emailId: string; action: EmailAction }) => {
      const { data } = await api.post(`/api/email/${emailId}/actions`, { action });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['emails'] });
      void queryClient.invalidateQueries({ queryKey: ['email'] });
    },
  });
}

export function usePendingApprovals() {
  return useQuery({
    queryKey: ['email-approvals'],
    queryFn: async () => {
      const { data } = await api.get<EmailApproval[]>('/api/email/approvals/pending');
      return data;
    },
    refetchInterval: 30000,
  });
}

export function useResolveApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { data } = await api.post(
        `/api/email/approvals/${id}/${approve ? 'approve' : 'reject'}`
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['email-approvals'] });
      void queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
  });
}
