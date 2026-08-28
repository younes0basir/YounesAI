import React from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell } from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useNotifications, useMarkNotificationRead } from '@/hooks/useNotifications';

export default function NotificationsScreen() {
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();

  const unread = (notifications.data ?? []).filter((n) => !n.read_at).length;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : 'All caught up'}
      />

      <FlatList
        data={notifications.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-3 px-4 pb-12 pt-1"
        refreshing={notifications.isRefetching}
        onRefresh={() => void notifications.refetch()}
        ListEmptyComponent={
          <View className="items-center pt-16">
            <Text className="text-ink-soft">
              {notifications.isLoading ? 'Loading…' : 'No notifications yet.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isUnread = !item.read_at;
          return (
            <Pressable onPress={() => isUnread && markRead.mutate(item.id)}>
              <GlassCard className={`p-4 ${isUnread ? '' : 'opacity-60'}`}>
                <View className="flex-row items-start gap-3">
                  <View
                    className={`mt-0.5 h-9 w-9 items-center justify-center rounded-xl ${
                      isUnread ? 'bg-accent-soft' : 'bg-slate-100'
                    }`}
                  >
                    <Bell size={16} color={isUnread ? '#6366F1' : '#94A3B8'} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[15px] font-semibold text-ink" numberOfLines={2}>
                      {item.title || item.type || 'Notification'}
                    </Text>
                    {item.body || item.message ? (
                      <Text className="mt-0.5 text-[13px] text-ink-soft" numberOfLines={3}>
                        {item.body || item.message}
                      </Text>
                    ) : null}
                    {item.created_at ? (
                      <Text className="mt-1 text-[11px] text-ink-faint">
                        {new Date(item.created_at).toLocaleString()}
                      </Text>
                    ) : null}
                  </View>
                  {isUnread ? <View className="mt-1.5 h-2 w-2 rounded-full bg-accent" /> : null}
                </View>
              </GlassCard>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}
