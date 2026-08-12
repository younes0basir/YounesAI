import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'

export const EMAIL_CATEGORIES = [
  { id: 'IMPORTANT', label: 'Important', tone: 'bg-rose-50 text-rose-700' },
  { id: 'ACTION_REQUIRED', label: 'Action Required', tone: 'bg-amber-50 text-amber-700' },
  { id: 'PERSONAL', label: 'Personal', tone: 'bg-blue-50 text-blue-700' },
  { id: 'NEWSLETTER', label: 'Newsletters', tone: 'bg-violet-50 text-violet-700' },
  { id: 'PROMOTION', label: 'Promotions', tone: 'bg-orange-50 text-orange-700' },
  { id: 'SPAM', label: 'Spam', tone: 'bg-slate-100 text-slate-600' },
  { id: 'UNKNOWN', label: 'Unknown', tone: 'bg-slate-50 text-slate-500' },
]

export const AI_INBOX_FILTER = 'AI_INBOX'

export function useGmailAccounts() {
  return useQuery({
    queryKey: ['gmail-accounts'],
    queryFn: () => api.get('/integrations/gmail/accounts').then((r) => r.data),
  })
}

export function useGmailSyncStatus() {
  return useQuery({
    queryKey: ['gmail-sync-status'],
    queryFn: () => api.get('/integrations/gmail/sync/status').then((r) => r.data),
    refetchInterval: 30000,
  })
}

export function useConnectGmail() {
  return useMutation({
    mutationFn: () => api.get('/integrations/gmail/connect').then((r) => r.data),
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url
    },
  })
}

export function useDisconnectGmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (accountId) => api.delete(`/integrations/gmail/accounts/${accountId}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gmail-accounts'] })
      qc.invalidateQueries({ queryKey: ['gmail-sync-status'] })
    },
  })
}

export function useSyncGmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (accountId) =>
      accountId
        ? api.post('/integrations/gmail/sync', { accountId }).then((r) => r.data)
        : api.post('/integrations/gmail/sync/all').then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emails'] })
      qc.invalidateQueries({ queryKey: ['gmail-sync-status'] })
    },
  })
}

export function useEmails(category, page = 1, limit = 50) {
  return useQuery({
    queryKey: ['emails', category, page, limit],
    queryFn: () => {
      const params = { page, limit }
      if (category === AI_INBOX_FILTER) {
        params.view = 'ai'
      } else if (category && category !== 'ALL') {
        params.category = category
      }
      return api.get('/email', { params }).then((r) => r.data)
    },
  })
}

export function useEmailDetail(id) {
  return useQuery({
    queryKey: ['email', id],
    queryFn: () => api.get(`/email/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useEmailAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ emailId, action }) =>
      api.post(`/email/${emailId}/actions`, { action }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emails'] })
      qc.invalidateQueries({ queryKey: ['email'] })
    },
  })
}

export function useEmailBatchAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ action, emailIds }) =>
      api.post('/email/batch', { action, emailIds }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emails'] })
      qc.invalidateQueries({ queryKey: ['email-approvals'] })
    },
  })
}

export function usePendingApprovals() {
  return useQuery({
    queryKey: ['email-approvals'],
    queryFn: () => api.get('/email/approvals/pending').then((r) => r.data),
    refetchInterval: 15000,
  })
}

export function useResolveApproval() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, approve }) =>
      api.post(`/email/approvals/${id}/${approve ? 'approve' : 'reject'}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-approvals'] })
      qc.invalidateQueries({ queryKey: ['emails'] })
    },
  })
}
