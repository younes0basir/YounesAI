import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { api } from './api';
import type { Place } from '@/lib/types';

const GEOFENCE_TASK = 'younesai-geofence-sync';

// Must be registered at module scope so the OS can relaunch into it.
// Geofencing requires a development build; Expo Go will no-op.
try {
  if (!TaskManager.isTaskDefined(GEOFENCE_TASK)) {
    TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
      if (error) return;
      const { eventType } = data as {
        eventType: Location.LocationGeofencingEventType;
        region: Location.LocationRegion;
      };
      if (eventType === Location.LocationGeofencingEventType.Enter) {
        void pushLocationContext();
      }
    });
  }
} catch {
  // TaskManager unavailable (e.g. Expo Go) — geofencing disabled.
}

/**
 * Fetch the user's saved places from the backend and register them as
 * geofences so the app can refresh location-aware context on entry/exit.
 */
export async function syncGeofences(): Promise<number> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return 0;

  const { data: places } = await api.get<Place[]>('/api/places');
  const regions = places
    .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    .map((p) => ({
      identifier: p.id,
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      radius: p.radius_m ?? 150,
      notifyOnEnter: true,
      notifyOnExit: true,
    }));

  if (regions.length === 0) return 0;

  const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK).catch(() => false);
  if (started) await Location.stopGeofencingAsync(GEOFENCE_TASK);
  await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
  return regions.length;
}

/**
 * Current-position context push: tells the backend where the user is so
 * place-aware agents can rank nearby tasks/events. Fire-and-forget.
 */
export async function pushLocationContext(): Promise<void> {
  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    await api.post('/api/agents/place', {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      source: 'mobile-geofence',
    });
  } catch {
    // Location context is best-effort; never block the UI on it.
  }
}

export { GEOFENCE_TASK };
