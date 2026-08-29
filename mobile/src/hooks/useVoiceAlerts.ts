import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { deliverVoiceAlert, ensureNotificationPermissions } from '@/services/notificationVoice';
import type { AppNotification } from '@/lib/types';

const POLL_MS = 15000;

/** Polls voice-eligible alerts and reads them aloud (mirrors web useAlerts). */
export function useVoiceAlerts(active: boolean) {
  const handledRef = useRef(new Set<string>());
  const queryClient = useQueryClient();

  useEffect(() => {
    if (active) void ensureNotificationPermissions();
  }, [active]);

  const { data } = useQuery({
    queryKey: ['pending-alerts'],
    queryFn: async () => {
      const { data: alerts } = await api.get<AppNotification[]>('/api/alerts/pending');
      return alerts;
    },
    enabled: active,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!active || !data?.length) return;

    void (async () => {
      for (const alert of data) {
        if (handledRef.current.has(alert.id)) continue;
        handledRef.current.add(alert.id);

        await deliverVoiceAlert(alert);

        await api
          .put(`/api/notifications/${alert.id}`, {
            read_at: new Date().toISOString(),
          })
          .catch(() => {});
      }

      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['pending-alerts'] });
    })();
  }, [active, data, queryClient]);
}
