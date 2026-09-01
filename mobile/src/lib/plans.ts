import type { EntitlementFeature, PlanTier } from '@/lib/types';

export const PLAN_ORDER: PlanTier[] = ['starter', 'pro', 'platinum'];

export const PLAN_LABELS: Record<PlanTier, string> = {
  starter: 'Starter',
  pro: 'Pro',
  platinum: 'Platinum',
};

export const FEATURE_LABELS: Record<EntitlementFeature, string> = {
  ai_chat: 'AI messages',
  voice: 'Voice commands',
  image: 'Image generations',
};

export const PRO_FEATURES: EntitlementFeature[] = ['voice', 'image'];

export interface PlanFeatureRow {
  label: string;
  starter: string;
  pro: string;
  platinum: string;
}

export const PLAN_COMPARISON: PlanFeatureRow[] = [
  {
    label: 'AI messages / day',
    starter: '10',
    pro: '100',
    platinum: '500',
  },
  {
    label: 'Voice AI / day',
    starter: '—',
    pro: '20',
    platinum: '100',
  },
  {
    label: 'Image generation / day',
    starter: '—',
    pro: '10',
    platinum: '50',
  },
  {
    label: 'Gmail accounts',
    starter: '1',
    pro: '2',
    platinum: '5',
  },
  {
    label: 'Premium agents',
    starter: 'No',
    pro: 'Yes',
    platinum: 'Yes',
  },
];

export function tierRank(tier: PlanTier): number {
  return PLAN_ORDER.indexOf(tier);
}

export function tierMeetsMinimum(current: PlanTier, required: PlanTier): boolean {
  return tierRank(current) >= tierRank(required);
}

export function formatUsage(used: number, limit: number): string {
  if (limit <= 0) return 'Not included';
  return `${used}/${limit} today`;
}
