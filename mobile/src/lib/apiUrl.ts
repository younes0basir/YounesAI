import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** HTTPS via nginx + Let's Encrypt on Oracle VM (sslip.io). */
export const DEFAULT_API_URL = 'https://84-8-220-241.sslip.io';

/** Local override for `expo start` — Android emulator can't reach localhost, needs 10.0.2.2. */
export const DEFAULT_LOCAL_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

/** Env-configured local URL (EXPO_PUBLIC_API_URL_LOCAL) or platform default. */
export const LOCAL_API_URL: string =
  (process.env.EXPO_PUBLIC_API_URL_LOCAL as string | undefined) || DEFAULT_LOCAL_URL;

/** Resolved once at module load — baked into the APK via app.config.js extra.apiUrl. */
export const API_BASE_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  process.env.EXPO_PUBLIC_API_URL ||
  DEFAULT_API_URL;

/** Alias for runtime switcher (kept for Settings UI). */
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
