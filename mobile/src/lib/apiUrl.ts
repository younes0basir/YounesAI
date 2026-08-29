import Constants from 'expo-constants';

const DEFAULT_API_URL = 'http://84.8.220.241:3000';

/** Resolved once at module load — baked into the APK via app.config.js extra.apiUrl. */
export const API_BASE_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  process.env.EXPO_PUBLIC_API_URL ||
  DEFAULT_API_URL;
