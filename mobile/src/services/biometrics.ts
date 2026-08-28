import * as LocalAuthentication from 'expo-local-authentication';
import { mmkvGet, mmkvSet, mmkvDelete } from './mmkv';

const ENABLED_KEY = 'biometrics-enabled';

export type BiometricKind = 'fingerprint' | 'face' | 'iris' | null;

/** Hardware present, biometrics enrolled — regardless of user opt-in. */
export async function getBiometricKind(): Promise<BiometricKind> {
  try {
    const [hasHardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    if (!hasHardware || !enrolled) return null;
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'face';
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'fingerprint';
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'iris';
    return 'fingerprint';
  } catch {
    return null;
  }
}

export function biometricsEnabled(): boolean {
  return mmkvGet<boolean>(ENABLED_KEY) ?? false;
}

export function setBiometricsEnabled(enabled: boolean): void {
  if (enabled) mmkvSet(ENABLED_KEY, true);
  else mmkvDelete(ENABLED_KEY);
}

export async function authenticate(reason: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Use password',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
