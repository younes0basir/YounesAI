import '../global.css';
import '@/services/geofence';
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { StatusBar } from 'expo-status-bar';
import { mmkvQueryStorage } from '@/services/mmkv';
import { startOfflineSync } from '@/services/offlineQueue';
import { useAuthStore } from '@/stores/useAuthStore';
import { FloatingAIHub } from '@/components/ai/FloatingAIHub';
import { queryClient } from '@/lib/queryClient';

const persister = createSyncStoragePersister({
  storage: mmkvQueryStorage,
  key: 'younesai-query-cache',
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, hydrated, hydrate } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) router.replace('/(auth)/login');
    else if (user && inAuthGroup) router.replace('/(tabs)');
  }, [user, hydrated, segments, router]);

  if (!hydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator size="large" color="#6366F1" />
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
            {user ? <FloatingAIHub /> : null}
          </AuthGate>
        </BottomSheetModalProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
