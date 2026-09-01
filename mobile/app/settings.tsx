import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fingerprint, LogOut, MapPin, RefreshCw, ScanFace, Volume2 } from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAuthStore } from '@/stores/useAuthStore';
import { flushQueue, getQueue } from '@/services/offlineQueue';
import { syncGeofences } from '@/services/geofence';
import {
  authenticate,
  biometricsEnabled,
  getBiometricKind,
  setBiometricsEnabled,
  type BiometricKind,
} from '@/services/biometrics';
import { API_BASE_URL } from '@/lib/apiUrl';
import { api } from '@/services/api';
import {
  ensureNotificationPermissions,
  setVoiceAlertsEnabled,
  voiceAlertsEnabled,
} from '@/services/notificationVoice';

export default function SettingsScreen() {
  const { user, logout } = useAuthStore();
  const [queued, setQueued] = useState(getQueue().length);
  const [geofences, setGeofences] = useState<number | null>(null);
  const [bioKind, setBioKind] = useState<BiometricKind>(null);
  const [bioOn, setBioOn] = useState(biometricsEnabled());
  const [voiceAlertsOn, setVoiceAlertsOn] = useState(voiceAlertsEnabled());
  const [backendStatus, setBackendStatus] = useState<string | null>(null);

  useEffect(() => {
    setQueued(getQueue().length);
    void getBiometricKind().then(setBioKind);
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
      setBackendStatus(data?.status === 'ok' ? 'Connected' : 'Unexpected response');
    } catch {
      setBackendStatus('Unreachable');
    }
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
            <Text className="text-[11px] font-extrabold uppercase tracking-widest text-ink-faint">
              Backend
            </Text>
            {backendStatus ? (
              <View
                className={`rounded-full px-2.5 py-1 ${backendStatus === 'Connected' ? 'bg-emerald-50 border border-emerald-200' : backendStatus === 'Checking…' ? 'bg-amber-50 border border-amber-200' : 'bg-accent-roseSoft border border-rose-200'}`}
              >
                <Text
                  className={`text-[10px] font-bold ${backendStatus === 'Connected' ? 'text-emerald-700' : backendStatus === 'Checking…' ? 'text-amber-700' : 'text-accent-rose'}`}
                >
                  {backendStatus}
                </Text>
              </View>
            ) : null}
          </View>
          <Text className="mt-2 text-sm font-medium text-ink" numberOfLines={1}>
            {API_BASE_URL}
          </Text>
          <Pressable
            onPress={testBackend}
            className="mt-3 self-start rounded-full bg-ink px-4 py-2"
          >
            <Text className="text-xs font-bold text-white">
              {backendStatus ? 'Retest' : 'Test connection'}
            </Text>
          </Pressable>
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
