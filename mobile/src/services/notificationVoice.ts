import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import type { AppNotification } from '@/lib/types';
import { mmkvGet, mmkvSet } from './mmkv';

const VOICE_ALERTS_KEY = 'notifications.voiceEnabled';

/**
 * expo-notifications was removed from Expo Go in SDK 53 (remote push).
 * The static import crashes the entire app in Expo Go, so we load it
 * lazily and degrade gracefully — voice speech still works, local
 * Notifications just become no-ops in Expo Go.
 */
let Notifications: typeof import('expo-notifications') | null = null;
let notificationsAvailable = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require('expo-notifications') as typeof import('expo-notifications');
  notificationsAvailable = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (e) {
  if (__DEV__) {
    console.warn(
      '[YounesAI] expo-notifications unavailable in this runtime (Expo Go SDK 53+). Local notifications disabled — voice alerts still work via expo-speech.',
      e
    );
  }
  Notifications = null;
  notificationsAvailable = false;
}

export function isNotificationsAvailable(): boolean {
  return notificationsAvailable;
}

export function voiceAlertsEnabled(): boolean {
  return mmkvGet<boolean>(VOICE_ALERTS_KEY) ?? true;
}

export function setVoiceAlertsEnabled(enabled: boolean): void {
  mmkvSet(VOICE_ALERTS_KEY, enabled);
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (!Notifications) return false;

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('alerts', {
        name: 'Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
        sound: 'default',
      });
    } catch {
      // channel creation not supported in this runtime (Expo Go)
    }
  }

  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;

    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    } as never);
    return (requested as { granted: boolean }).granted;
  } catch {
    return false;
  }
}

export function alertSpeechText(alert: AppNotification): string {
  const title = alert.title?.trim() || 'Notification';
  const body = (alert.body || alert.message || '').trim();

  switch (alert.type) {
    case 'reminder_warning':
      return body ? `Reminder: ${title}. ${body}` : `Reminder: ${title}`;
    case 'reminder_due':
      return body ? `Reminder due now: ${title}. ${body}` : `Reminder due now: ${title}`;
    case 'task_due':
      return body ? `Task due soon: ${title}. ${body}` : `Task due soon: ${title}`;
    case 'task_overdue':
      return body ? `Overdue task: ${title}. ${body}` : `Overdue task: ${title}`;
    default:
      return body ? `${title}. ${body}` : title;
  }
}

export async function speakAlert(text: string): Promise<void> {
  if (!voiceAlertsEnabled() || !text.trim()) return;
  Speech.stop();
  await new Promise<void>((resolve) => {
    Speech.speak(text, {
      rate: 0.92,
      pitch: 1,
      onDone: resolve,
      onStopped: resolve,
      onError: () => resolve(),
    });
  });
}

export async function playDueRing(): Promise<void> {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  await new Promise((r) => setTimeout(r, 350));
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

export async function presentNotificationAlert(alert: AppNotification): Promise<void> {
  if (!Notifications) return;
  const title = alert.title?.trim() || 'YounesAI';
  const body = (alert.body || alert.message || '').trim();

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: body || alertSpeechText(alert),
        sound: true,
        data: { id: alert.id, type: alert.type },
      },
      trigger: null,
      ...(Platform.OS === 'android' ? { channelId: 'alerts' } : {}),
    } as never);
  } catch {
    // Expo Go without notification support — silently ignore
  }
}

/** Show a device notification and optionally speak the alert aloud. */
export async function deliverVoiceAlert(alert: AppNotification): Promise<void> {
  await presentNotificationAlert(alert);
  if (!voiceAlertsEnabled()) return;

  if (alert.type === 'reminder_due') {
    await playDueRing();
    await new Promise((r) => setTimeout(r, 280));
  }

  await speakAlert(alertSpeechText(alert));
}

export async function previewVoiceAlert(alert: AppNotification): Promise<void> {
  if (alert.type === 'reminder_due') {
    await playDueRing();
    await new Promise((r) => setTimeout(r, 200));
  }
  await speakAlert(alertSpeechText(alert));
}
