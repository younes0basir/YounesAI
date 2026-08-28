import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fingerprint, LogOut, MapPin, RefreshCw, ScanFace } from 'lucide-react-native';
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

export default function SettingsScreen() {
  const { user, logout } = useAuthStore();
  const [queued, setQueued] = useState(getQueue().length);
  const [geofences, setGeofences] = useState<number | null>(null);
  const [bioKind, setBioKind] = useState<BiometricKind>(null);
  const [bioOn, setBioOn] = useState(biometricsEnabled());

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

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerClassName="gap-3 px-4 pb-12 pt-1">
        <GlassCard className="p-4">
          <Text className="text-xs font-bold uppercase tracking-widest text-ink-faint">
            Account
          </Text>
          <Text className="mt-2 text-lg font-semibold text-ink">{user?.display_name}</Text>
          <Text className="text-sm text-ink-soft">{user?.email}</Text>
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
          <Text className="text-xs font-bold uppercase tracking-widest text-ink-faint">
            Backend
          </Text>
          <Text className="mt-2 text-sm text-ink" numberOfLines={1}>
            {process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001'}
          </Text>
          <Text className="mt-1 text-xs text-ink-soft">
            Set EXPO_PUBLIC_API_URL in mobile/.env to point at your server.
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
          className="mt-3 flex-row items-center justify-center gap-2 rounded-2xl border border-accent-rose/30 bg-accent-rose/5 py-3.5"
        >
          <LogOut size={16} color="#F43F5E" />
          <Text className="font-semibold text-accent-rose">Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
