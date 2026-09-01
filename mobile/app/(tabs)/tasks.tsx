import React, { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import Animated, {
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Plus } from 'lucide-react-native';
import { BentoTaskCard } from '@/components/bento/BentoTaskCard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { PressableScale } from '@/components/ui/PressableScale';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import { useTasks, useArchiveTask, useCreateTask, useUpdateTask } from '@/hooks/useTasks';
import type { Task } from '@/lib/types';

const SPRING_FILTER = { damping: 22, stiffness: 320, mass: 0.7 } as const;

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
  const fabScale = useSharedValue(1);
  const { width } = useWindowDimensions();

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
    hapticSuccess();
    createTask.mutate({ title, status: 'pending' });
    setDraft('');
    sheetRef.current?.dismiss();
  };

  const handleFilter = (key: Filter) => {
    if (key === filter) return;
    hapticSelect();
    setFilter(key);
  };

  const renderTask = ({ item, index }: { item: Task; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 45, 260))
        .duration(380)
        .springify()
        .damping(18)}
      layout={LinearTransition.springify().damping(18).stiffness(220)}
    >
      <BentoTaskCard
        task={item}
        onArchive={(id) => archiveTask.mutate(id)}
        onToggleComplete={(t) =>
          updateTask.mutate({ id: t.id, status: t.status === 'done' ? 'pending' : 'done' })
        }
      />
    </Animated.View>
  );

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(fabScale.value, SPRING_FILTER) }],
  }));

  return (
    <SafeAreaView className="flex-1 bg-canvas-soft" edges={['top']}>
      {/* Adaptive header — flexWrap ensures no truncation on narrow screens */}
      <View className="px-4 pb-2 pt-3">
        <View className="flex-row flex-wrap items-end justify-between gap-3">
          <View className="min-w-[160px] flex-1">
            <Text className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-faint">
              Tasks
            </Text>
            <Text className="text-hero text-ink -mt-1">Your focus</Text>
            <Animated.Text
              layout={LinearTransition.springify().damping(18)}
              className="text-xs font-medium text-ink-muted"
            >
              {visible.length}{' '}
              {filter === 'done' ? 'completed' : filter === 'today' ? 'due today' : 'active'}
            </Animated.Text>
          </View>
          <PressableScale
            onPress={() => {
              fabScale.value = 0.92;
              setTimeout(() => (fabScale.value = 1), 120);
              sheetRef.current?.present();
            }}
          >
            <Animated.View
              style={fabStyle}
              className="h-11 w-11 items-center justify-center rounded-full bg-accent"
            >
              <View
                className="absolute inset-0 rounded-full bg-accent"
                style={{
                  shadowColor: '#6366F1',
                  shadowOpacity: 0.32,
                  shadowRadius: 14,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 6,
                }}
              />
              {/* specular highlight */}
              <View
                pointerEvents="none"
                className="absolute inset-x-3 top-1 h-px bg-white/30 rounded-full"
              />
              <Plus size={20} color="#FFFFFF" />
            </Animated.View>
          </PressableScale>
        </View>
      </View>

      {/* Filter pill — animated indicator with spring layout */}
      <View
        className="mx-4 mb-3 rounded-full bg-white border border-glass-border p-1 flex-row"
        style={{ minHeight: 44 }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => handleFilter(f.key)}
              className="flex-1 items-center justify-center rounded-full px-3 py-2"
              style={{ minHeight: 36 }}
            >
              {active ? (
                <Animated.View
                  layout={LinearTransition.springify().damping(20).stiffness(320)}
                  className="absolute inset-0 rounded-full bg-ink border border-ink"
                />
              ) : null}
              <Text
                className={`text-xs font-bold tracking-wide ${active ? 'text-white' : 'text-ink-muted'}`}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={renderTask}
        contentContainerClassName="gap-3 px-4 pb-40 pt-2"
        showsVerticalScrollIndicator={false}
        refreshing={tasks.isRefetching}
        onRefresh={() => void tasks.refetch()}
        // Responsive: 2-col on tablet widths while keeping zero layout shift
        numColumns={width >= 700 ? 2 : 1}
        columnWrapperStyle={width >= 700 ? { gap: 12 } : undefined}
        key={width >= 700 ? 'grid' : 'list'}
        ListEmptyComponent={
          tasks.isLoading ? (
            <View className="gap-3 pt-2">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : (
            <Animated.View entering={FadeInDown.duration(360)} className="items-center pt-10 px-8">
              <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white border border-glass-border">
                <Text className="text-xl">✨</Text>
              </View>
              <Text className="mt-4 text-sm font-semibold text-ink">
                {filter === 'today'
                  ? 'Nothing due today'
                  : filter === 'done'
                    ? 'No completed yet'
                    : 'No tasks yet'}
              </Text>
              <Text className="mt-1 text-center text-xs leading-4 text-ink-muted">
                {filter === 'all'
                  ? 'Tap + to create one or swipe right on a card to archive.'
                  : 'Switch filter or create a task.'}
              </Text>
            </Animated.View>
          )
        }
      />

      <BottomSheet ref={sheetRef} snapPoints={['36%']}>
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-bold tracking-tight text-ink">New task</Text>
          <View className="rounded-full bg-accent-soft px-2.5 py-1">
            <Text className="text-[11px] font-bold tracking-wide text-accent">Quick add</Text>
          </View>
        </View>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="What needs doing?"
          placeholderTextColor="#94A3B8"
          autoFocus
          onSubmitEditing={submitTask}
          returnKeyType="done"
          className="mt-4 rounded-2xl border border-glass-borderStrong bg-canvas px-4 py-3.5 text-[15px] text-ink"
          style={{ minHeight: 52 }}
        />
        <PressableScale onPress={submitTask} className="mt-4">
          <View
            className={`items-center rounded-2xl py-3.5 border ${draft.trim() ? 'bg-accent border-accent' : 'bg-accent/35 border-accent/20'}`}
            style={
              draft.trim()
                ? {
                    shadowColor: '#6366F1',
                    shadowOpacity: 0.28,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 4,
                  }
                : undefined
            }
          >
            <Text className={`font-bold ${draft.trim() ? 'text-white' : 'text-white/70'}`}>
              Add task
            </Text>
          </View>
        </PressableScale>
      </BottomSheet>
    </SafeAreaView>
  );
}
