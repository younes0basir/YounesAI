import React from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useVoiceAlerts } from '@/hooks/useVoiceAlerts';

/** Background watcher — polls pending alerts and speaks them when logged in. */
export function VoiceAlertsWatcher() {
  const user = useAuthStore((s) => s.user);
  useVoiceAlerts(Boolean(user));
  return null;
}
