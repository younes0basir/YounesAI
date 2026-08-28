import React from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BentoGrid, BentoSlot } from '@/components/bento/BentoGrid';
import { BentoTaskCard } from '@/components/bento/BentoTaskCard';
import { BentoEventCard } from '@/components/bento/BentoEventCard';
import { GlassCard } from '@/components/ui/GlassCard';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useTasks, useArchiveTask, useUpdateTask } from '@/hooks/useTasks';
import { useEvents } from '@/hooks/useEvents';
import { useAuthStore } from '@/stores/useAuthStore';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const tasks = useTasks();
  const events = useEvents();
  const archiveTask = useArchiveTask();
  const updateTask = useUpdateTask();

  const openTasks = (tasks.data ?? []).filter(
    (t) => t.status !== 'done' && t.status !== 'completed'
  );
  const upcomingEvents = (events.data ?? [])
    .filter((e) => e.start_at && new Date(e.start_at) >= new Date())
    .slice(0, 2);

  const refreshing = tasks.isRefetching || events.isRefetching;
  const refetch = () => {
    void tasks.refetch();
    void events.refetch();
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-40"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} />}
      >
        <View className="px-4 pb-5 pt-4">
          <Text className="text-sm text-ink-soft">
            {new Date().toLocaleDateString([], {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          <Text className="mt-1 text-[28px] font-bold text-ink">
            {greeting()}, {user?.display_name ?? 'there'}
          </Text>
        </View>

        <BentoGrid>
          <BentoSlot span="half">
            <Animated.View entering={FadeInDown.delay(50).duration(350)}>
              <GlassCard className="p-4">
                <Text className="text-3xl font-bold text-ink">{openTasks.length}</Text>
                <Text className="mt-1 text-xs font-medium text-ink-soft">Open tasks</Text>
              </GlassCard>
            </Animated.View>
          </BentoSlot>
          <BentoSlot span="half">
            <Animated.View entering={FadeInDown.delay(120).duration(350)}>
              <GlassCard className="p-4">
                <Text className="text-3xl font-bold text-ink">{upcomingEvents.length}</Text>
                <Text className="mt-1 text-xs font-medium text-ink-soft">Upcoming events</Text>
              </GlassCard>
            </Animated.View>
          </BentoSlot>

          {upcomingEvents.length > 0 ? (
            <View className="w-full gap-3">
              <Text className="mt-2 text-xs font-bold uppercase tracking-widest text-ink-faint">
                Next up
              </Text>
              {upcomingEvents.map((event, i) => (
                <Animated.View
                  key={event.id}
                  entering={FadeInDown.delay(190 + i * 70).duration(350)}
                >
                  <BentoEventCard event={event} />
                </Animated.View>
              ))}
            </View>
          ) : null}

          <View className="w-full gap-3">
            <Text className="mt-2 text-xs font-bold uppercase tracking-widest text-ink-faint">
              Priority tasks
            </Text>
            {tasks.isLoading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              <>
                {openTasks.slice(0, 5).map((task, i) => (
                  <Animated.View
                    key={task.id}
                    entering={FadeInDown.delay(260 + i * 70).duration(350)}
                  >
                    <BentoTaskCard
                      task={task}
                      onArchive={(id) => archiveTask.mutate(id)}
                      onToggleComplete={(t) =>
                        updateTask.mutate({
                          id: t.id,
                          status: t.status === 'done' ? 'pending' : 'done',
                        })
                      }
                    />
                  </Animated.View>
                ))}
                {openTasks.length === 0 ? (
                  <GlassCard className="items-center p-6">
                    <Text className="text-sm text-ink-soft">
                      All clear. Ask the AI hub to plan your day.
                    </Text>
                  </GlassCard>
                ) : null}
              </>
            )}
          </View>
        </BentoGrid>
      </ScrollView>
    </SafeAreaView>
  );
}
