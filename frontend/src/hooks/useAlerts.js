import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

const POLL_INTERVAL = 15000;

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.9;
  u.volume = 1;
  window.speechSynthesis.speak(u);
}

function playRing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.setValueAtTime(1000, now + 0.15);
    osc.frequency.setValueAtTime(800, now + 0.3);
    osc.frequency.setValueAtTime(1000, now + 0.45);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.8);

    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1000, now + 1);
      osc2.frequency.setValueAtTime(1200, now + 1.15);
      osc2.frequency.setValueAtTime(1000, now + 1.3);
      osc2.frequency.setValueAtTime(1200, now + 1.45);
      gain2.gain.setValueAtTime(0.3, now + 1);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 1.8);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 1);
      osc2.stop(now + 1.8);
    }, 1000);
  } catch {}
}

export function usePendingAlerts() {
  const handledRef = useRef(new Set());
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['pending-alerts'],
    queryFn: () => api.get('/alerts/pending').then((r) => r.data),
    refetchInterval: POLL_INTERVAL,
  });

  const markRead = useMutation({
    mutationFn: (id) =>
      api.put(`/notifications/${id}`, { read_at: new Date().toISOString() }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    const alerts = Array.isArray(data) ? data : [];
    for (const alert of alerts) {
      if (handledRef.current.has(alert.id)) continue;
      handledRef.current.add(alert.id);

      if (alert.type === 'reminder_warning') {
        speak(`Reminder: ${alert.title}. ${alert.body || ''}`);
      } else if (alert.type === 'reminder_due') {
        playRing();
        setTimeout(() => speak(`Reminder: ${alert.title} is due now`), 300);
      } else if (alert.type === 'task_due') {
        speak(`Task due soon: ${alert.title}. ${alert.body || ''}`);
      } else if (alert.type === 'task_overdue') {
        playRing();
        setTimeout(() => speak(`Overdue task: ${alert.title}. ${alert.body || ''}`), 300);
      }

      markRead.mutate(alert.id);
    }
  }, [data, markRead]);

  return { alerts: Array.isArray(data) ? data : [] };
}
