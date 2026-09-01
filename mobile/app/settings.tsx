import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Fingerprint,
  LogOut,
  MapPin,
  RefreshCw,
  ScanFace,
  Server,
  Shield,
  Sparkles,
  Volume2,
} from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAuthStore } from '@/stores/useAuthStore';
import { getApiBaseUrl, DEFAULT_API_URL, LOCAL_API_URL } from '@/lib/apiUrl';
import { getStoredBackendUrl, setStoredBackendUrl } from '@/lib/apiUrl';
import { flushQueue, getQueue } from '@/services/offlineQueue';
import { syncGeofences } from '@/services/geofence';
import {
  authenticate,
  biometricsEnabled,
  getBiometricKind,
  setBiometricsEnabled,
  type BiometricKind,
} from '@/services/biometrics';
import { useRouter } from 'expo-router';
import { PLAN_LABELS, formatUsage } from '@/lib/plans';
import { api } from '@/services/api';
import {
  ensureNotificationPermissions,
  setVoiceAlertsEnabled,
  voiceAlertsEnabled,
} from '@/services/notificationVoice';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [queued, setQueued] = useState(getQueue().length);
  const [geofences, setGeofences] = useState<number | null>(null);
  const [bioKind, setBioKind] = useState<BiometricKind>(null);
  const [bioOn, setBioOn] = useState(biometricsEnabled());
  const [voiceAlertsOn, setVoiceAlertsOn] = useState(voiceAlertsEnabled());
  const [backendStatus, setBackendStatus] = useState<string | null>(null);
  const [backendUrl, setBackendUrl] = useState(getApiBaseUrl());
  const isAdmin = Boolean(user?.is_admin);

  useEffect(() => {
    setQueued(getQueue().length);
    void getBiometricKind().then(setBioKind);
    setBackendUrl(getApiBaseUrl());
  }, []);

  const toggleBiometrics = async (next: boolean) => {
    if (next) {
      const ok = await authenticate('Confirm to enable biometric unlock');
      if (!ok) return;
    }
    setBiometricsEnabled(next);
    setBioOn(next);
  };

  const retryQueue = async () => {
    await flushQueue();
    setQueued(getQueue().length);
  };

  const enablePlaces = async () => {
    setGeofences(await syncGeofences());
  };

  const testBackend = async () => {
    setBackendStatus('Checking…');
    try {
      const { data } = await api.get('/api/health');
      setBackendStatus(data?.status === 'ok' ? `Connected (${backendUrl})` : 'Unexpected response');
    } catch {
      setBackendStatus('Unreachable');
    }
  };

  const switchBackend = (mode: 'deployed' | 'local') => {
    const url = mode === 'local' ? LOCAL_API_URL : DEFAULT_API_URL;
    setStoredBackendUrl(mode === 'deployed' ? null : url);
    setBackendUrl(url);
    setBackendStatus(null);
    // Force re-test so user sees result
    setTimeout(() => void testBackend(), 120);
  };

  const toggleVoiceAlerts = async (next: boolean) => {
    if (next) {
      const ok = await ensureNotificationPermissions();
      if (!ok) return;
    }
    setVoiceAlertsEnabled(next);
    setVoiceAlertsOn(next);
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas-soft" edges={['top']}>
      <ScreenHeader title="Settings" subtitle="Account · Privacy · Sync" />
      <ScrollView
        contentContainerClassName="gap-3.5 px-4 pb-12 pt-2"
        showsVerticalScrollIndicator={false}
      >
        <GlassCard variant="elevated" className="p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-ink">
              <Text className="text-lg font-extrabold text-white">
                {(user?.display_name ?? 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-bold text-ink" numberOfLines={1}>
                {user?.display_name}
              </Text>
              <Text className="text-xs font-medium text-ink-muted" numberOfLines={1}>
                {user?.email}
              </Text>
            </View>
            <View className="h-2 w-2 rounded-full bg-emerald-500" />
          </View>
          <View className="mt-3 h-px bg-glass-border" />
          <Text className="mt-3 text-[11px] font-bold uppercase tracking-widest text-ink-faint">
            Account
          </Text>
        </GlassCard>

        <GlassCard className="p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
              <Sparkles size={18} color="#6366F1" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-ink">Subscription</Text>
              <Text className="mt-0.5 text-xs text-ink-soft">
                {PLAN_LABELS[user?.plan_tier ?? 'starter']} ·{' '}
                {formatUsage(user?.usage?.ai_chat?.used ?? 0, user?.usage?.ai_chat?.limit ?? 0)} AI
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.push('/plans')}
            className="mt-3 self-start rounded-full bg-ink px-4 py-2"
          >
            <Text className="text-xs font-bold text-white">View plans</Text>
          </Pressable>
          {isAdmin ? (
            <Pressable
              onPress={() => router.push('/admin' as any)}
              className="mt-2 self-start flex-row items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-4 py-2"
            >
              <Shield size={12} color="#7C3AED" />
              <Text className="text-xs font-bold text-violet-700">Admin dashboard</Text>
            </Pressable>
          ) : null}
        </GlassCard>

        {bioKind ? (
          <GlassCard className="p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 flex-row items-center gap-3 pr-3">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
                  {bioKind === 'face' ? (
                    <ScanFace size={18} color="#6366F1" />
                  ) : (
                    <Fingerprint size={18} color="#6366F1" />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-ink">Biometric unlock</Text>
                  <Text className="mt-0.5 text-xs text-ink-soft">
                    Require {bioKind === 'face' ? 'Face ID' : 'fingerprint'} to open the app
                  </Text>
                </View>
              </View>
              <Switch
                value={bioOn}
                onValueChange={(v) => void toggleBiometrics(v)}
                trackColor={{ false: '#E2E8F0', true: '#6366F1' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </GlassCard>
        ) : null}

        <GlassCard className="p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 flex-row items-center gap-3 pr-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
                <Volume2 size={18} color="#6366F1" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-ink">Voice alerts</Text>
                <Text className="mt-0.5 text-xs text-ink-soft">
                  Speak reminders and task alerts aloud · shows phone notifications
                </Text>
              </View>
            </View>
            <Switch
              value={voiceAlertsOn}
              onValueChange={(v) => void toggleVoiceAlerts(v)}
              trackColor={{ false: '#E2E8F0', true: '#6366F1' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </GlassCard>

        <GlassCard className="p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="h-8 w-8 items-center justify-center rounded-xl bg-slate-100 border border-glass-border">
                <Server size={14} color="#0F172A" />
              </View>
              <Text className="text-[11px] font-extrabold uppercase tracking-widest text-ink-faint">
                Backend
              </Text>
            </View>
            {backendStatus ? (
              <View
                className={`rounded-full px-2.5 py-1 ${backendStatus.startsWith('Connected') ? 'bg-emerald-50 border border-emerald-200' : backendStatus === 'Checking…' ? 'bg-amber-50 border border-amber-200' : 'bg-accent-roseSoft border border-rose-200'}`}
              >
                <Text
                  className={`text-[10px] font-bold ${backendStatus.startsWith('Connected') ? 'text-emerald-700' : backendStatus === 'Checking…' ? 'text-amber-700' : 'text-accent-rose'}`}
                >
                  {backendStatus}
                </Text>
              </View>
            ) : null}
          </View>
          <Text className="mt-2 text-sm font-medium text-ink" numberOfLines={1}>
            {backendUrl}
          </Text>
          <Text className="mt-1 text-[11px] text-ink-faint" numberOfLines={1}>
            Deployed: {DEFAULT_API_URL} · Local: {LOCAL_API_URL}
          </Text>
          <View className="mt-3 flex-row gap-2">
            <Pressable onPress={testBackend} className="rounded-full bg-ink px-4 py-2">
              <Text className="text-xs font-bold text-white">
                {backendStatus ? 'Retest' : 'Test'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => switchBackend('deployed')}
              className={`rounded-full border px-4 py-2 ${backendUrl === DEFAULT_API_URL ? 'bg-ink border-ink' : 'bg-white border-glass-border'}`}
            >
              <Text
                className={`text-xs font-bold ${backendUrl === DEFAULT_API_URL ? 'text-white' : 'text-ink'}`}
              >
                Deployed
              </Text>
            </Pressable>
            <Pressable
              onPress={() => switchBackend('local')}
              className={`rounded-full border px-4 py-2 ${backendUrl === LOCAL_API_URL ? 'bg-ink border-ink' : 'bg-white border-glass-border'}`}
            >
              <Text
                className={`text-xs font-bold ${backendUrl === LOCAL_API_URL ? 'text-white' : 'text-ink'}`}
              >
                Local
              </Text>
            </Pressable>
          </View>
          <Text className="mt-2 text-[10px] text-ink-faint">
            Switch takes effect immediately — will re-login if token differs per backend.
          </Text>
        </GlassCard>

        <GlassCard className="p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-sm font-semibold text-ink">Offline queue</Text>
              <Text className="mt-0.5 text-xs text-ink-soft">
                {queued} mutation{queued === 1 ? '' : 's'} waiting to sync
              </Text>
            </View>
            <Pressable
              onPress={retryQueue}
              className="flex-row items-center gap-1.5 rounded-full bg-accent-soft px-3.5 py-2"
            >
              <RefreshCw size={14} color="#6366F1" />
              <Text className="text-xs font-semibold text-accent">Retry</Text>
            </Pressable>
          </View>
        </GlassCard>

        <GlassCard className="p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-sm font-semibold text-ink">Place context</Text>
              <Text className="mt-0.5 text-xs text-ink-soft">
                {geofences === null
                  ? 'Sync saved places as geofences'
                  : `${geofences} geofence${geofences === 1 ? '' : 's'} active`}
              </Text>
            </View>
            <Pressable
              onPress={enablePlaces}
              className="flex-row items-center gap-1.5 rounded-full bg-accent-soft px-3.5 py-2"
            >
              <MapPin size={14} color="#6366F1" />
              <Text className="text-xs font-semibold text-accent">Enable</Text>
            </Pressable>
          </View>
        </GlassCard>

        <Pressable
          onPress={() => void logout()}
          className="mt-4 flex-row items-center justify-center gap-2 rounded-2xl border border-accent-rose/20 bg-accent-roseSoft py-3.5"
          style={
            {
              shadowColor: '#F43F5E',
              shadowOpacity: 0.08,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
            } as any
          }
        >
          <LogOut size={16} color="#F43F5E" />
          <Text className="font-bold text-accent-rose">Sign out</Text>
        </Pressable>
        <Text className="mt-2 text-center text-[11px] font-medium text-ink-faint">
          You can sign back in with the same account on any device.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
