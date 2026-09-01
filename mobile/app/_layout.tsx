import '../global.css';
import '@/services/geofence';
import React, { useEffect, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { mmkvQueryStorage, hydrateMmkv, PERSISTED_QUERY_KEY } from '@/services/mmkv';
import { startOfflineSync } from '@/services/offlineQueue';
import { useAuthStore } from '@/stores/useAuthStore';
import { FloatingAIHub } from '@/components/ai/FloatingAIHub';
import { VoiceAlertsWatcher } from '@/components/notifications/VoiceAlertsWatcher';
import { AppLogo } from '@/components/ui/AppLogo';
import { queryClient } from '@/lib/queryClient';

SplashScreen.preventAutoHideAsync().catch(() => {});

const persister = createSyncStoragePersister({
  storage: mmkvQueryStorage,
  key: PERSISTED_QUERY_KEY,
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, hydrated, hydrate } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [storageReady, setStorageReady] = React.useState(false);

  useEffect(() => {
    void (async () => {
      await hydrateMmkv();
      setStorageReady(true);
      await hydrate();
    })();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || !storageReady) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) router.replace('/(auth)/login');
    else if (user && inAuthGroup) router.replace('/(tabs)');
  }, [user, hydrated, storageReady, segments, router]);

  const onLayoutReady = useCallback(async () => {
    if (hydrated && storageReady) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [hydrated, storageReady]);

  useEffect(() => {
    void onLayoutReady();
  }, [onLayoutReady]);

  if (!hydrated || !storageReady) {
    return (
      <View className="flex-1 items-center justify-center bg-black" onLayout={onLayoutReady}>
        <AppLogo size={96} rounded={28} />
        <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 24 }} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const user = useAuthStore((s) => s.user);

  useEffect(() => startOfflineSync(), []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
        <BottomSheetModalProvider>
          <StatusBar style="dark" />
          <AuthGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="+not-found" />
            </Stack>
            {user ? (
              <>
                <VoiceAlertsWatcher />
                <FloatingAIHub />
              </>
            ) : null}
          </AuthGate>
        </BottomSheetModalProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
