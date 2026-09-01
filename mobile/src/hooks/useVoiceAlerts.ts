import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  deliverVoiceAlert,
  ensureNotificationPermissions,
  voiceAlertsEnabled,
} from '@/services/notificationVoice';
import { mmkvGet, mmkvSet } from '@/services/mmkv';
import type { AppNotification } from '@/lib/types';

const POLL_MS = 15000;
const HANDLED_KEY_BASE = 'voiceAlerts.handledIds.v2.';
const MAX_SPOKEN_PER_POLL = 2; // prevent login spam when 20 pending are queued
const DEDUP_PERSIST_LIMIT = 200;
const SPOKEN_COOLDOWN_MS = 10_000;

function handledKey(userId: string | null): string {
  return `${HANDLED_KEY_BASE}${userId ?? 'anon'}`;
}

function loadHandledSet(userId: string | null): Set<string> {
  try {
    const arr = mmkvGet<string[]>(handledKey(userId));
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function persistHandledSet(userId: string | null, set: Set<string>): void {
  try {
    const arr = Array.from(set).slice(-DEDUP_PERSIST_LIMIT);
    mmkvSet(handledKey(userId), arr);
  } catch {}
}

/** Polls voice-eligible alerts and reads them aloud (mirrors web useAlerts). */
export function useVoiceAlerts(active: boolean) {
  const userId = useAuthStore((s) => s.user?.id) ?? null;
  const handledRef = useRef<Set<string>>(loadHandledSet(userId));
  const lastSpokenAtRef = useRef<number>(0);
  const queryClient = useQueryClient();

  // Switching accounts must load the correct per-account dedup set so
  // accounts don't replay each other's alerts.
  useEffect(() => {
    handledRef.current = loadHandledSet(userId);
    // If user switched, drop in-memory cooldown so the new account can speak promptly once
    lastSpokenAtRef.current = 0;
  }, [userId]);

  useEffect(() => {
    if (active && voiceAlertsEnabled()) void ensureNotificationPermissions();
  }, [active]);

  const { data } = useQuery({
    queryKey: ['pending-alerts', userId],
    queryFn: async () => {
      const { data: alerts } = await api.get<AppNotification[]>('/api/alerts/pending');
      return alerts;
    },
    enabled: active && !!userId,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!active || !data?.length) return;
    if (!voiceAlertsEnabled()) {
      // Still mark as read so we don't queue forever, but stay silent
      void (async () => {
        for (const alert of data) {
          if (handledRef.current.has(alert.id)) continue;
          handledRef.current.add(alert.id);
          await api
            .put(`/api/notifications/${alert.id}`, { read_at: new Date().toISOString() })
            .catch(() => {});
        }
        persistHandledSet(userId, handledRef.current);
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        void queryClient.invalidateQueries({ queryKey: ['pending-alerts'] });
      })();
      return;
    }

    void (async () => {
      const now = Date.now();
      if (now - lastSpokenAtRef.current < SPOKEN_COOLDOWN_MS) return;

      // Only speak unread alerts we haven't already handled in this install.
      // Filter to recent (last 2h) to avoid login spam from stale backlog.
      const RECENT_MS = 2 * 60 * 60 * 1000;
      const unseen = data.filter((a) => {
        if (handledRef.current.has(a.id)) return false;
        if (!a.created_at) return true;
        const age = now - new Date(a.created_at).getTime();
        return Number.isFinite(age) ? age < RECENT_MS : true;
      });
      const staleUnseen = data.filter((a) => !handledRef.current.has(a.id) && !unseen.includes(a));
      if (unseen.length === 0 && staleUnseen.length === 0) return;

      // Speak at most N per poll (newest first is already DESC from backend).
      // Remaining unseen are marked read silently so login doesn't replay 20 voices.
      const toSpeak = unseen.slice(0, MAX_SPOKEN_PER_POLL);
      const toSilence = [...unseen.slice(MAX_SPOKEN_PER_POLL), ...staleUnseen];

      for (const alert of toSpeak) {
        handledRef.current.add(alert.id);
        persistHandledSet(userId, handledRef.current);
        lastSpokenAtRef.current = Date.now();
        await deliverVoiceAlert(alert);
        await api
          .put(`/api/notifications/${alert.id}`, { read_at: new Date().toISOString() })
          .catch(() => {});
      }

      // Silently ack the rest without voice to avoid login spam
      for (const alert of toSilence) {
        handledRef.current.add(alert.id);
        await api
          .put(`/api/notifications/${alert.id}`, { read_at: new Date().toISOString() })
          .catch(() => {});
      }
      if (toSilence.length) persistHandledSet(userId, handledRef.current);

      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['pending-alerts'] });
    })();
  }, [active, data, queryClient, userId]);
}
