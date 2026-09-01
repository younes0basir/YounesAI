import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../stores/useAuth';

const ADMIN_KEY_STORAGE = 'admin_api_key';

export function getAdminKey() {
  return localStorage.getItem(ADMIN_KEY_STORAGE) || '';
}

export function setAdminKey(key) {
  if (key) localStorage.setItem(ADMIN_KEY_STORAGE, key);
  else localStorage.removeItem(ADMIN_KEY_STORAGE);
}

function adminHeaders() {
  const key = getAdminKey();
  return key ? { 'X-Admin-Key': key } : {};
}

function useIsAdmin() {
  const user = useAuth((s) => s.user);
  return Boolean(user?.is_admin);
}

export function useAdminStats(enabled = true) {
  const key = getAdminKey();
  const isAdmin = useIsAdmin();
  const canQuery = Boolean(key) || isAdmin;
  return useQuery({
    queryKey: ['admin-stats', key, isAdmin],
    queryFn: async () => {
      const res = await api.get('/admin/stats', { headers: adminHeaders() });
      return res.data;
    },
    enabled: enabled && canQuery,
    retry: false,
  });
}

export function useAdminUsers({ search = '', limit = 50, offset = 0 } = {}, enabled = true) {
  const key = getAdminKey();
  const isAdmin = useIsAdmin();
  const canQuery = Boolean(key) || isAdmin;
  return useQuery({
    queryKey: ['admin-users', key, isAdmin, search, limit, offset],
    queryFn: async () => {
      const res = await api.get('/admin/users', {
        headers: adminHeaders(),
        params: { search: search || undefined, limit, offset },
      });
      return res.data;
    },
    enabled: enabled && canQuery,
    retry: false,
    keepPreviousData: true,
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const res = await api.get('/plans');
      return res.data;
    },
  });
}

export function useUpdateUserPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, plan_tier }) => {
      const res = await api.patch(
        `/admin/users/${userId}/plan`,
        { plan_tier },
        { headers: adminHeaders() }
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });
}
