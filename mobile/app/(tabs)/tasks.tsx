import React, { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Plus } from 'lucide-react-native';
import { BentoTaskCard } from '@/components/bento/BentoTaskCard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useTasks, useArchiveTask, useCreateTask, useUpdateTask } from '@/hooks/useTasks';
import type { Task } from '@/lib/types';

type Filter = 'all' | 'today' | 'done';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'done', label: 'Done' },
];

export default function TasksScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const [draft, setDraft] = useState('');
  const sheetRef = useRef<BottomSheetModal>(null);

  const tasks = useTasks();
  const archiveTask = useArchiveTask();
  const updateTask = useUpdateTask();
  const createTask = useCreateTask();

  const visible = useMemo(() => {
    const all = tasks.data ?? [];
    if (filter === 'done')
      return all.filter((t) => t.status === 'done' || t.status === 'completed');
    const open = all.filter((t) => t.status !== 'done' && t.status !== 'completed');
    if (filter === 'today') {
      const today = new Date().toDateString();
      return open.filter((t) => t.due_at && new Date(t.due_at).toDateString() === today);
    }
    return open;
  }, [tasks.data, filter]);

  const submitTask = () => {
    const title = draft.trim();
    if (!title) return;
    createTask.mutate({ title, status: 'pending' });
    setDraft('');
    sheetRef.current?.dismiss();
  };

  const renderTask = ({ item }: { item: Task }) => (
    <BentoTaskCard
      task={item}
      onArchive={(id) => archiveTask.mutate(id)}
      onToggleComplete={(t) =>
        updateTask.mutate({ id: t.id, status: t.status === 'done' ? 'pending' : 'done' })
      }
    />
  );

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 pb-3 pt-4">
        <Text className="text-[28px] font-bold text-ink">Tasks</Text>
        <Pressable
          onPress={() => sheetRef.current?.present()}
          className="h-10 w-10 items-center justify-center rounded-full bg-accent"
        >
          <Plus size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <View className="flex-row gap-2 px-4 pb-3">
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            className={`rounded-full px-4 py-1.5 ${
              filter === f.key ? 'bg-accent' : 'border border-glass-border bg-white'
            }`}
          >
            <Text
              className={`text-[13px] font-semibold ${
                filter === f.key ? 'text-white' : 'text-ink-soft'
              }`}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={renderTask}
        contentContainerClassName="gap-3 px-4 pb-40"
        refreshing={tasks.isRefetching}
        onRefresh={() => void tasks.refetch()}
        ListEmptyComponent={
          tasks.isLoading ? (
            <View className="gap-3 pt-1">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : (
            <View className="items-center pt-16">
              <Text className="text-ink-soft">
                Nothing here. Swipe right on a task to archive it.
              </Text>
            </View>
          )
        }
      />

      <BottomSheet ref={sheetRef} snapPoints={['32%']}>
        <Text className="text-lg font-bold text-ink">New task</Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="What needs doing?"
          placeholderTextColor="#94A3B8"
          autoFocus
          onSubmitEditing={submitTask}
          returnKeyType="done"
          className="mt-4 rounded-2xl border border-glass-border bg-canvas px-4 py-3.5 text-ink"
        />
        <Pressable
          onPress={submitTask}
          disabled={!draft.trim()}
          className={`mt-4 items-center rounded-2xl py-3.5 ${
            draft.trim() ? 'bg-accent' : 'bg-accent/40'
          }`}
        >
          <Text className="font-semibold text-white">Add task</Text>
        </Pressable>
      </BottomSheet>
    </SafeAreaView>
  );
}
