import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { mmkvGet, mmkvSet } from '@/services/mmkv';

/** HTTPS via nginx + Let's Encrypt on Oracle VM (sslip.io). */
export const DEFAULT_API_URL = 'https://84-8-220-241.sslip.io';

/** Local override for `expo start` — Android emulator can't reach localhost, needs 10.0.2.2. */
export const DEFAULT_LOCAL_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

/** Env-configured local URL (EXPO_PUBLIC_API_URL_LOCAL) or platform default. */
export const LOCAL_API_URL: string =
  (process.env.EXPO_PUBLIC_API_URL_LOCAL as string | undefined) || DEFAULT_LOCAL_URL;

const OVERRIDE_KEY = 'backend-url-override';

/** Runtime backend switcher persisted in MMKV (Settings → Backend). */
export function getStoredBackendUrl(): string | null {
  return mmkvGet<string>(OVERRIDE_KEY);
}

export function setStoredBackendUrl(url: string | null): void {
  const { storage } = require('@/services/mmkv');
  if (!url) storage.delete(OVERRIDE_KEY);
  else mmkvSet(OVERRIDE_KEY, url);
}

export function getApiBaseUrl(): string {
  const override = getStoredBackendUrl();
  if (override) return override;
  return (
    (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
    process.env.EXPO_PUBLIC_API_URL ||
    DEFAULT_API_URL
  );
}

/** Baked-in value kept for error messages / backwards compat. */
export const API_BASE_URL: string = getApiBaseUrl();
