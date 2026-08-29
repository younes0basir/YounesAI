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
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader
        title="Notifications"
        subtitle={
          unread > 0
            ? `${unread} unread · voice alerts on for reminders & tasks`
            : 'Voice alerts for reminders and tasks'
        }
        right={
          unread > 0 ? (
            <Pressable
              onPress={() => markAllRead.mutate()}
              className="rounded-full bg-accent-soft px-3 py-1.5"
            >
              <Text className="text-xs font-semibold text-accent">Mark all read</Text>
            </Pressable>
          ) : undefined
        }
      />

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-3 px-4 pb-12 pt-1"
        refreshing={notifications.isRefetching}
        onRefresh={() => void notifications.refetch()}
        ListEmptyComponent={
          <View className="items-center pt-16">
            <Text className="text-center text-ink-soft">
              {notifications.isLoading
                ? 'Loading…'
                : 'No notifications yet.\nReminders and tasks will speak aloud when due.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isUnread = !item.read_at;
          return (
            <GlassCard className={`p-4 ${isUnread ? '' : 'opacity-70'}`}>
              <View className="flex-row items-start gap-3">
                <Pressable
                  onPress={() => openNotification(item)}
                  className="flex-1 flex-row items-start gap-3"
                >
                  <View
                    className={`mt-0.5 h-9 w-9 items-center justify-center rounded-xl ${
                      isUnread ? 'bg-accent-soft' : 'bg-slate-100'
                    }`}
                  >
                    <Bell size={16} color={isUnread ? '#6366F1' : '#94A3B8'} />
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`text-[10px] font-bold uppercase tracking-widest ${typeTone(item.type)}`}
                    >
                      {typeLabel(item.type)}
                    </Text>
                    <Text className="mt-1 text-[15px] font-semibold text-ink" numberOfLines={2}>
                      {item.title || 'Notification'}
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
                </Pressable>

                <Pressable
                  onPress={() => void previewVoiceAlert(item)}
                  className="mt-0.5 h-9 w-9 items-center justify-center rounded-full bg-slate-100"
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
