import axios from 'axios';
import { isNetworkError } from '@/services/api';
import { API_BASE_URL } from '@/lib/apiUrl';
import type { EntitlementFeature } from '@/lib/types';

export interface QuotaErrorDetails {
  kind: 'quota_exceeded' | 'feature_not_available';
  feature?: EntitlementFeature | string;
  used?: number;
  limit?: number;
  plan?: string;
  resetsAt?: string;
  message: string;
}

export function isQuotaError(error: unknown): error is QuotaErrorDetails {
  const details = parseQuotaError(error);
  return details != null;
}

export function parseQuotaError(error: unknown): QuotaErrorDetails | null {
  if (!axios.isAxiosError(error)) return null;
  const body = error.response?.data as
    | {
        error?: string;
        feature?: string;
        used?: number;
        limit?: number;
        plan?: string;
        resetsAt?: string;
      }
    | undefined;

  if (body?.error === 'quota_exceeded') {
    return {
      kind: 'quota_exceeded',
      feature: body.feature,
      used: body.used,
      limit: body.limit,
      plan: body.plan,
      resetsAt: body.resetsAt,
      message: `Daily limit reached (${body.used ?? '?'}/${body.limit ?? '?'}). Upgrade for more.`,
    };
  }

  if (body?.error === 'feature_not_available') {
    return {
      kind: 'feature_not_available',
      feature: body.feature,
      plan: body.plan,
      message: 'This feature requires a Pro or Platinum plan.',
    };
  }

  return null;
}

export function getApiErrorMessage(error: unknown, fallback = 'Request failed'): string {
  const quota = parseQuotaError(error);
  if (quota) return quota.message;

  if (isNetworkError(error)) {
    return `Cannot reach server at ${API_BASE_URL}`;
  }
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { error?: string; message?: string } | undefined;
    const msg = body?.error ?? body?.message;
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (error.response?.status === 401) return 'Invalid email or password.';
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
