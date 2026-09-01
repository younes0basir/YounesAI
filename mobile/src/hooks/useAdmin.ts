import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/useAuthStore';
import type { PlanTier } from '@/lib/types';

export interface AdminPlanLimits {
  ai_chat_daily: number;
  voice_daily: number;
  image_daily: number;
  gmail_accounts: number;
  premium_agents: boolean;
  agent_rate_limit_per_min: number;
}

export interface AdminPlanCatalogItem {
  tier: PlanTier;
  label: string;
  limits: AdminPlanLimits;
}

export interface AdminUserUsage {
  ai_chat: { used: number; limit: number };
  voice: { used: number; limit: number };
  image: { used: number; limit: number };
}

export interface AdminUser {
  id: string;
  email: string;
  display_name: string | null;
  plan_tier: PlanTier;
  is_admin: boolean;
  plan_updated_at: string | null;
  created_at: string;
  usage: AdminUserUsage;
  limits: AdminPlanLimits;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminStatsResponse {
  totalUsers: number;
  byTier: Record<PlanTier, number>;
  todayUsage: { ai_chat_total: number; voice_total: number; image_total: number };
  plans: AdminPlanCatalogItem[];
  date: string;
}

const ADMIN_KEY_MMKV = 'admin_api_key';

import { mmkvGet, mmkvSet, mmkvDelete } from '@/services/mmkv';

export function getAdminKey(): string {
  return mmkvGet<string>(ADMIN_KEY_MMKV) ?? '';
}

export function setAdminKey(key: string): void {
  if (!key) mmkvDelete(ADMIN_KEY_MMKV);
  else mmkvSet(ADMIN_KEY_MMKV, key);
}

function adminHeaders(): Record<string, string> {
  const key = getAdminKey();
  return key ? { 'X-Admin-Key': key } : {};
}

function useCanAdmin(): boolean {
  const user = useAuthStore((s) => s.user);
  return Boolean(user?.is_admin) || Boolean(getAdminKey());
}

export function useAdminStats(enabled = true) {
  const user = useAuthStore((s) => s.user);
  const key = getAdminKey();
  const canQuery = Boolean(user?.is_admin) || Boolean(key);
  return useQuery<AdminStatsResponse>({
    queryKey: ['admin-stats', key, user?.is_admin, user?.id],
    enabled: enabled && canQuery,
    retry: false,
    queryFn: async () => {
      const { data } = await api.get('/api/admin/stats', { headers: adminHeaders() });
      return data as AdminStatsResponse;
    },
  });
}

export function useAdminUsers(
  { search = '', limit = 25, offset = 0 }: { search?: string; limit?: number; offset?: number },
  enabled = true
) {
  const user = useAuthStore((s) => s.user);
  const key = getAdminKey();
  const canQuery = Boolean(user?.is_admin) || Boolean(key);
  return useQuery<AdminUsersResponse>({
    queryKey: ['admin-users', key, user?.is_admin, search, limit, offset],
    enabled: enabled && canQuery,
    retry: false,
    queryFn: async () => {
      const { data } = await api.get('/api/admin/users', {
        headers: adminHeaders(),
        params: { search: search || undefined, limit, offset },
      });
      return data as AdminUsersResponse;
    },
  });
}

export function useUpdateUserPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, plan_tier }: { userId: string; plan_tier: PlanTier }) => {
      const { data } = await api.patch(
        `/api/admin/users/${userId}/plan`,
        { plan_tier },
        { headers: adminHeaders() }
      );
      return data as { user: AdminUser };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      void qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });
}

export function usePlans() {
  return useQuery<{ plans: AdminPlanCatalogItem[] }>({
    queryKey: ['plans'],
    queryFn: async () => {
      const { data } = await api.get('/api/plans');
      return data;
    },
  });
}
