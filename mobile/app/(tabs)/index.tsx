import React from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn, LinearTransition } from 'react-native-reanimated';
import {
  CheckCircle2,
  CalendarClock,
  Sparkles,
  Sun,
  Moon,
  Sunrise,
  ArrowRight,
} from 'lucide-react-native';
import { BentoGrid, BentoSlot } from '@/components/bento/BentoGrid';
import { BentoTaskCard } from '@/components/bento/BentoTaskCard';
import { BentoEventCard } from '@/components/bento/BentoEventCard';
import { GlassCard } from '@/components/ui/GlassCard';
import { SkeletonCard, SkeletonStat } from '@/components/ui/Skeleton';
import { PressableScale } from '@/components/ui/PressableScale';
import { hapticTap } from '@/lib/haptics';
import { useTasks, useArchiveTask, useUpdateTask } from '@/hooks/useTasks';
import { useEvents } from '@/hooks/useEvents';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRouter } from 'expo-router';

function greeting(): { text: string; Icon: React.ComponentType<{ size: number; color: string }> } {
  const hour = new Date().getHours();
  if (hour < 5) return { text: 'Good evening', Icon: Moon };
  if (hour < 12) return { text: 'Good morning', Icon: Sunrise };
  if (hour < 18) return { text: 'Good afternoon', Icon: Sun };
  return { text: 'Good evening', Icon: Moon };
}

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const tasks = useTasks();
  const events = useEvents();
  const archiveTask = useArchiveTask();
  const updateTask = useUpdateTask();

  const openTasks = (tasks.data ?? []).filter(
    (t) => t.status !== 'done' && t.status !== 'completed'
  );
  const upcomingEvents = (events.data ?? [])
    .filter((e) => e.starts_at && new Date(e.starts_at) >= new Date())
    .slice(0, 2);

  const refreshing = tasks.isRefetching || events.isRefetching;
  const refetch = () => {
    void tasks.refetch();
    void events.refetch();
  };
  const { text: greetText, Icon: GreetIcon } = greeting();

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* subtle canvas gradient blobs */}
      <View
        pointerEvents="none"
        className="absolute -top-28 -right-16 h-64 w-64 rounded-full bg-accent-soft opacity-60"
      />
      <View
        pointerEvents="none"
        className="absolute -top-10 -left-20 h-72 w-72 rounded-full bg-indigo-50 opacity-40"
      />
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-40"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor="#6366F1" />
        }
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(400)} className="px-4 pb-4 pt-2">
          <View className="flex-row flex-wrap items-center gap-2">
            <View className="rounded-full bg-white border border-glass-border px-3 py-1.5 flex-row items-center gap-2">
              <View className="h-6 w-6 items-center justify-center rounded-full bg-accent-soft">
                <GreetIcon size={12} color="#6366F1" />
              </View>
              <Text className="text-[11px] font-bold uppercase tracking-widest text-ink-faint">
                {new Date().toLocaleDateString([], {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
            <View className="h-6 w-6 items-center justify-center rounded-full bg-ink">
              <Text className="text-[11px] font-extrabold text-white">
                {(user?.display_name ?? 'Y').charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>
          <Text className="mt-3 text-hero text-ink">
            {greetText},{'\n'}
            <Text className="text-accent">{user?.display_name ?? 'there'}</Text>
          </Text>
          <Text className="mt-2 text-[13px] leading-5 text-ink-soft">
            {openTasks.length === 0 && upcomingEvents.length === 0
              ? 'All caught up. Let your AI assistant plan the day.'
              : `${openTasks.length} open tasks · ${upcomingEvents.length} upcoming events`}
          </Text>
        </Animated.View>

        <BentoGrid>
          {/* Stat skeletons mirror final layout — zero shift when tasks load */}
          {tasks.isLoading ? (
            <>
              <BentoSlot span="half">
                <SkeletonStat />
              </BentoSlot>
              <BentoSlot span="half">
                <SkeletonStat />
              </BentoSlot>
            </>
          ) : (
            <>
              <BentoSlot span="half">
                <Animated.View
                  entering={FadeInDown.delay(60).duration(420).springify().damping(18)}
                  layout={LinearTransition.springify().damping(18).stiffness(220)}
                >
                  <GlassCard
                    variant="elevated"
                    className="p-4 overflow-hidden"
                    style={{ minHeight: 116 }}
                  >
                    <View className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-accent-soft opacity-60" />
                    <View
                      pointerEvents="none"
                      className="absolute inset-x-3 top-0 h-px bg-white/70 rounded-full"
                    />
                    <View className="h-9 w-9 items-center justify-center rounded-xl bg-accent border border-accent/10">
                      <CheckCircle2 size={18} color="#FFFFFF" />
                    </View>
                    <Text className="mt-3 text-3xl font-extrabold tracking-tight text-ink">
                      {openTasks.length}
                    </Text>
                    <Text className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">
                      Open tasks
                    </Text>
                    <View className="mt-2 h-1 w-10 rounded-full bg-accent/20" />
                  </GlassCard>
                </Animated.View>
              </BentoSlot>
              <BentoSlot span="half">
                <Animated.View
                  entering={FadeInDown.delay(120).duration(420).springify().damping(18)}
                  layout={LinearTransition.springify().damping(18).stiffness(220)}
                >
                  <GlassCard
                    variant="elevated"
                    className="p-4 overflow-hidden"
                    style={{ minHeight: 116 }}
                  >
                    <View className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-amber-50 opacity-70" />
                    <View
                      pointerEvents="none"
                      className="absolute inset-x-3 top-0 h-px bg-white/70 rounded-full"
                    />
                    <View className="h-9 w-9 items-center justify-center rounded-xl bg-ink border border-ink/10">
                      <CalendarClock size={18} color="#FFFFFF" />
                    </View>
                    <Text className="mt-3 text-3xl font-extrabold tracking-tight text-ink">
                      {upcomingEvents.length}
                    </Text>
                    <Text className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">
                      Upcoming
                    </Text>
                    <View className="mt-2 h-1 w-10 rounded-full bg-ink/10" />
                  </GlassCard>
                </Animated.View>
              </BentoSlot>
            </>
          )}

          {/* Quick actions — fluid spring entrance */}
          <View className="w-full">
            <Animated.View
              entering={FadeInDown.delay(160).duration(420).springify().damping(18)}
              layout={LinearTransition.springify().damping(18).stiffness(220)}
              className="flex-row gap-2"
            >
              <PressableScale
                onPress={() => {
                  hapticTap();
                  router.push('/(tabs)/chat');
                }}
                className="flex-1"
              >
                <View
                  className="flex-row items-center justify-center gap-2 rounded-full bg-accent py-3 border border-accent"
                  style={{
                    shadowColor: '#6366F1',
                    shadowOpacity: 0.28,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 4,
                  }}
                >
                  <Sparkles size={14} color="#FFFFFF" />
                  <Text className="text-sm font-bold text-white">Ask AI</Text>
                  <ArrowRight size={14} color="#FFFFFF" />
                </View>
              </PressableScale>
              <PressableScale
                onPress={() => {
                  hapticTap();
                  router.push('/(tabs)/tasks');
                }}
              >
                <View className="px-5 items-center justify-center rounded-full bg-white border border-glass-border py-3">
                  <Text className="text-sm font-semibold text-ink">Tasks</Text>
                </View>
              </PressableScale>
            </Animated.View>
          </View>

          {upcomingEvents.length > 0 ? (
            <View className="w-full gap-3">
              <View className="mt-1 flex-row items-center justify-between">
                <Text className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">
                  Next up
                </Text>
                <PressableScale
                  onPress={() => {
                    hapticTap();
                    router.push('/events');
                  }}
                >
                  <Text className="text-xs font-bold text-accent">View all →</Text>
                </PressableScale>
              </View>
              {upcomingEvents.map((event, i) => (
                <Animated.View
                  key={event.id}
                  entering={FadeInDown.delay(190 + i * 50)
                    .duration(420)
                    .springify()
                    .damping(18)}
                  layout={LinearTransition.springify().damping(18).stiffness(220)}
                >
                  <BentoEventCard event={event} />
                </Animated.View>
              ))}
            </View>
          ) : null}

          <View className="w-full gap-3">
            <View className="mt-1 flex-row flex-wrap items-center justify-between gap-2">
              <Text className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">
                Priority tasks
              </Text>
              <Text className="text-[11px] font-semibold text-ink-faint">
                {openTasks.length} total
              </Text>
            </View>
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
                    entering={FadeInDown.delay(260 + i * 45)
                      .duration(420)
                      .springify()
                      .damping(18)}
                    layout={LinearTransition.springify().damping(18).stiffness(220)}
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
                  <Animated.View
                    entering={FadeInDown.delay(280).duration(420).springify().damping(18)}
                  >
                    <GlassCard
                      variant="subtle"
                      className="items-center p-6"
                      style={{ minHeight: 132 }}
                    >
                      <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent-soft border border-accent/10">
                        <CheckCircle2 size={18} color="#6366F1" />
                      </View>
                      <Text className="mt-3 text-sm font-bold tracking-tight text-ink">
                        All clear
                      </Text>
                      <Text className="mt-1 text-center text-xs leading-4 text-ink-muted">
                        Ask the AI hub to plan your day or create a task.
                      </Text>
                    </GlassCard>
                  </Animated.View>
                ) : openTasks.length > 5 ? (
                  <PressableScale
                    onPress={() => router.push('/(tabs)/tasks')}
                    className="items-center py-2"
                  >
                    <Text className="text-xs font-bold text-accent">
                      View {openTasks.length - 5} more →
                    </Text>
                  </PressableScale>
                ) : null}
              </>
            )}
          </View>
        </BentoGrid>
      </ScrollView>
    </SafeAreaView>
  );
}
