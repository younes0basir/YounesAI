import axios from 'axios';
import { isNetworkError } from '@/services/api';
import { API_BASE_URL } from '@/lib/apiUrl';

export function getApiErrorMessage(error: unknown, fallback = 'Request failed'): string {
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
