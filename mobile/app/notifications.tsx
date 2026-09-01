import React from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Volume2 } from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/useNotifications';
import { previewVoiceAlert } from '@/services/notificationVoice';
import type { AppNotification } from '@/lib/types';

const TYPE_LABELS: Record<string, string> = {
  reminder_warning: 'Reminder soon',
  reminder_due: 'Reminder due',
  task_due: 'Task due',
  task_overdue: 'Overdue',
  system: 'System',
};

function typeLabel(type?: string | null): string {
  if (!type) return 'Alert';
  return TYPE_LABELS[type] ?? type.replace(/_/g, ' ');
}

function typeTone(type?: string | null): string {
  switch (type) {
    case 'reminder_due':
    case 'task_overdue':
      return 'text-accent-rose';
    case 'reminder_warning':
    case 'task_due':
      return 'text-amber-600';
    default:
      return 'text-ink-faint';
  }
}

export default function NotificationsScreen() {
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = notifications.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  const openNotification = (item: AppNotification) => {
    if (!item.read_at) markRead.mutate(item.id);
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas-soft" edges={['top']}>
      <ScreenHeader
        title="Notifications"
        subtitle={
          unread > 0 ? `${unread} unread · tap to dismiss · speaker to preview` : 'All caught up'
        }
        right={
          unread > 0 ? (
            <Pressable
              onPress={() => markAllRead.mutate()}
              className="rounded-full bg-ink px-3.5 py-2"
              style={
                {
                  shadowColor: '#0F172A',
                  shadowOpacity: 0.12,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                } as any
              }
            >
              <Text className="text-xs font-bold text-white">Mark all read</Text>
            </Pressable>
          ) : undefined
        }
      />

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-3 px-4 pb-12 pt-2"
        showsVerticalScrollIndicator={false}
        refreshing={notifications.isRefetching}
        onRefresh={() => void notifications.refetch()}
        ListEmptyComponent={
          <View className="items-center pt-14 px-8">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white border border-glass-border">
              <Bell size={22} color="#94A3B8" />
            </View>
            <Text className="mt-4 text-sm font-semibold text-ink">
              {notifications.isLoading ? 'Loading…' : 'No notifications yet'}
            </Text>
            <Text className="mt-1 text-center text-xs leading-4 text-ink-muted">
              Reminders and tasks will speak aloud when due. Pull to refresh.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isUnread = !item.read_at;
          return (
            <GlassCard
              variant={isUnread ? 'elevated' : 'subtle'}
              className={`p-4 ${isUnread ? '' : 'opacity-90'}`}
            >
              <View className="flex-row items-start gap-3">
                <Pressable
                  onPress={() => openNotification(item)}
                  className="flex-1 flex-row items-start gap-3"
                  style={{ opacity: isUnread ? 1 : 0.96 }}
                >
                  <View
                    className={`mt-0.5 h-10 w-10 items-center justify-center rounded-xl border ${isUnread ? 'bg-accent border-accent' : 'bg-white border-glass-border'}`}
                  >
                    <Bell size={16} color={isUnread ? '#FFFFFF' : '#94A3B8'} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text
                        className={`text-[10px] font-extrabold uppercase tracking-widest ${typeTone(item.type)}`}
                      >
                        {typeLabel(item.type)}
                      </Text>
                      {isUnread ? <View className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
                      <Text className="ml-auto text-[11px] font-medium text-ink-faint">
                        {item.created_at
                          ? new Date(item.created_at).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                            })
                          : ''}
                      </Text>
                    </View>
                    <Text
                      className={`mt-1 text-[15px] leading-5 ${isUnread ? 'font-semibold text-ink' : 'font-medium text-ink-soft'}`}
                      numberOfLines={2}
                    >
                      {item.title || 'Notification'}
                    </Text>
                    {item.body || item.message ? (
                      <Text className="mt-1 text-[13px] leading-4 text-ink-muted" numberOfLines={2}>
                        {item.body || item.message}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => void previewVoiceAlert(item)}
                  className="mt-0.5 h-10 w-10 items-center justify-center rounded-full bg-white border border-glass-border"
                  style={
                    {
                      shadowColor: '#0F172A',
                      shadowOpacity: 0.06,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 4 },
                    } as any
                  }
                  accessibilityLabel="Read aloud"
                >
                  <Volume2 size={16} color="#6366F1" />
                </Pressable>
              </View>
            </GlassCard>
          );
        }}
      />
    </SafeAreaView>
  );
}
