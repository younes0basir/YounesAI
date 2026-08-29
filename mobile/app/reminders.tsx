import React, { useRef, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BellOff, Plus, Timer } from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import {
  useReminders,
  useCreateReminder,
  useSnoozeReminder,
  useDismissReminder,
} from '@/hooks/useReminders';

const SNOOZE_OPTIONS = [15, 60, 180];

export default function RemindersScreen() {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [title, setTitle] = useState('');
  const [remindAt, setRemindAt] = useState('');

  const reminders = useReminders();
  const createReminder = useCreateReminder();
  const snoozeReminder = useSnoozeReminder();
  const dismissReminder = useDismissReminder();

  const submit = () => {
    if (!title.trim()) return;
    createReminder.mutate({
      title: title.trim(),
      trigger_at: remindAt.trim() ? new Date(remindAt.trim()).toISOString() : null,
    });
    setTitle('');
    setRemindAt('');
    sheetRef.current?.dismiss();
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader
        title="Reminders"
        subtitle="Never drop the ball"
        right={
          <Pressable
            onPress={() => sheetRef.current?.present()}
            className="h-10 w-10 items-center justify-center rounded-full bg-accent"
            accessibilityLabel="New reminder"
          >
            <Plus size={20} color="#FFFFFF" />
          </Pressable>
        }
      />

      <FlatList
        data={reminders.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-3 px-4 pb-12 pt-1"
        refreshing={reminders.isRefetching}
        onRefresh={() => void reminders.refetch()}
        ListEmptyComponent={
          <View className="items-center pt-16">
            <Text className="text-ink-soft">
              {reminders.isLoading ? 'Loading reminders…' : 'No reminders set.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <GlassCard className="p-4">
            <Text className="text-[15px] font-semibold text-ink">{item.title}</Text>
            {item.trigger_at ? (
              <Text className="mt-0.5 text-xs text-ink-soft">
                {new Date(item.trigger_at).toLocaleString()}
              </Text>
            ) : null}
            <View className="mt-3 flex-row items-center gap-2">
              {SNOOZE_OPTIONS.map((minutes) => (
                <Pressable
                  key={minutes}
                  onPress={() => snoozeReminder.mutate({ id: item.id, minutes })}
                  className="flex-row items-center gap-1 rounded-full bg-accent-soft px-3 py-1.5"
                >
                  <Timer size={12} color="#6366F1" />
                  <Text className="text-[11px] font-semibold text-accent">
                    {minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`}
                  </Text>
                </Pressable>
              ))}
              <View className="flex-1" />
              <Pressable
                onPress={() => dismissReminder.mutate(item.id)}
                className="flex-row items-center gap-1 rounded-full bg-slate-200 px-3 py-1.5"
              >
                <BellOff size={12} color="#475569" />
                <Text className="text-[11px] font-semibold text-ink-soft">Dismiss</Text>
              </Pressable>
            </View>
          </GlassCard>
        )}
      />

      <BottomSheet ref={sheetRef} snapPoints={['40%']}>
        <Text className="text-lg font-bold text-ink">New reminder</Text>
        <View className="mt-4 gap-3">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Remind me to…"
            placeholderTextColor="#94A3B8"
            className="rounded-2xl border border-glass-border bg-canvas px-4 py-3 text-ink"
          />
          <TextInput
            value={remindAt}
            onChangeText={setRemindAt}
            placeholder="When (YYYY-MM-DD HH:mm)"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            className="rounded-2xl border border-glass-border bg-canvas px-4 py-3 text-ink"
          />
        </View>
        <Pressable
          onPress={submit}
          disabled={!title.trim() || createReminder.isPending}
          className={`mt-4 items-center rounded-2xl py-3.5 ${
            title.trim() ? 'bg-accent' : 'bg-accent/40'
          }`}
        >
          <Text className="font-semibold text-white">Create reminder</Text>
        </Pressable>
      </BottomSheet>
    </SafeAreaView>
  );
}
