import { useMemo } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { PRO_FEATURES, tierMeetsMinimum } from '@/lib/plans';
import type { EntitlementFeature, PlanTier } from '@/lib/types';

export interface EntitlementResult {
  tier: PlanTier;
  used: number;
  limit: number;
  remaining: number;
  allowed: boolean;
  showUpgrade: boolean;
  requiresPro: boolean;
}

export function useEntitlement(feature: EntitlementFeature): EntitlementResult {
  const user = useAuthStore((s) => s.user);
  const tier = user?.plan_tier ?? 'starter';
  const usage = user?.usage?.[feature];
  const used = usage?.used ?? 0;
  const limit = usage?.limit ?? 0;
  const requiresPro = PRO_FEATURES.includes(feature);
  const hasPlanAccess = !requiresPro || tierMeetsMinimum(tier, 'pro');
  const allowed = hasPlanAccess && limit > 0 && used < limit;

  return useMemo(
    () => ({
      tier,
      used,
      limit,
      remaining: limit > 0 ? Math.max(0, limit - used) : 0,
      allowed,
      showUpgrade: !allowed,
      requiresPro,
    }),
    [tier, used, limit, allowed, requiresPro]
  );
}
