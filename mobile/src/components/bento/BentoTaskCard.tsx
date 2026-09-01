import React from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Archive, CheckCircle2, Circle, Clock3 } from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { PressableScale } from '@/components/ui/PressableScale';
import { hapticSuccess, hapticTap, hapticSelect, hapticImpactMedium } from '@/lib/haptics';
import type { Task } from '@/lib/types';

// Premium physics — Directive: stiffness 260, damping 20 (no linear)
const SPRING = { damping: 20, stiffness: 260, mass: 0.7 } as const;
const SPRING_PRESS = { damping: 20, stiffness: 260, mass: 0.6 } as const;
const SPRING_SNAP = SPRING;
const ARCHIVE_THRESHOLD = 110;
const COMPLETE_THRESHOLD = -110;

interface BentoTaskCardProps {
  task: Task;
  onArchive?: (id: string) => void;
  onToggleComplete?: (task: Task) => void;
}

export function BentoTaskCard({ task, onArchive, onToggleComplete }: BentoTaskCardProps) {
  const translateX = useSharedValue(0);
  const pressed = useSharedValue(0);
  const hasFiredArchive = useSharedValue(false);
  const hasFiredComplete = useSharedValue(false);
  const completed = task.status === 'done' || task.status === 'completed';

  const archive = (id: string) => {
    // Success haptic on resolution (commit)
    hapticSuccess();
    onArchive?.(id);
  };

  const toggle = (t: Task) => {
    hapticTap();
    onToggleComplete?.(t);
  };

  const pan = Gesture.Pan()
    .activeOffsetX(12)
    .failOffsetY([-8, 8])
    .onUpdate((event) => {
      const raw = event.translationX;
      const resistance = (v: number, thr: number) => {
        const over = Math.abs(v) - thr * 0.6;
        if (over <= 0) return v;
        const damp = 1 - Math.min(over / 120, 0.5);
        return Math.sign(v) * (thr * 0.6 + over * damp);
      };
      translateX.value = resistance(raw, ARCHIVE_THRESHOLD);

      // Tactile thresholds — Medium precisely before commit, light selection on approach
      if (translateX.value > ARCHIVE_THRESHOLD && !hasFiredArchive.value) {
        hasFiredArchive.value = true;
        runOnJS(hapticImpactMedium)();
      } else if (translateX.value < COMPLETE_THRESHOLD && !hasFiredComplete.value) {
        hasFiredComplete.value = true;
        runOnJS(hapticImpactMedium)();
      }
      // 55% approach tick — subtle select
      if (
        (translateX.value > ARCHIVE_THRESHOLD * 0.55 &&
          translateX.value < ARCHIVE_THRESHOLD &&
          !hasFiredArchive.value) ||
        (translateX.value < COMPLETE_THRESHOLD * 0.55 &&
          translateX.value > COMPLETE_THRESHOLD &&
          !hasFiredComplete.value)
      ) {
        // we fire once per gesture via threshold flag; this is intentionally soft
        // handled by the heavy tick above for final crossing — avoid spamming
      }
    })
    .onEnd(() => {
      hasFiredArchive.value = false;
      hasFiredComplete.value = false;
      if (translateX.value > ARCHIVE_THRESHOLD) {
        runOnJS(hapticSelect)();
        translateX.value = withTiming(500, { duration: 220 }, (finished) => {
          if (finished && onArchive) runOnJS(archive)(task.id);
        });
      } else if (translateX.value < COMPLETE_THRESHOLD) {
        runOnJS(hapticSelect)();
        translateX.value = withTiming(-500, { duration: 220 }, (finished) => {
          if (finished && onToggleComplete) runOnJS(toggle)(task);
        });
      } else {
        translateX.value = withSpring(0, SPRING_SNAP);
        if (Math.abs(translateX.value) > 20) runOnJS(hapticTap)();
      }
    });

  const tap = Gesture.Tap()
    .maxDuration(300)
    .onBegin(() => {
      pressed.value = 1;
    })
    .onFinalize(() => {
      pressed.value = 0;
    })
    .onEnd(() => {
      if (onToggleComplete) runOnJS(toggle)(task);
    });

  const gestures = Gesture.Race(pan, tap);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: withSpring(pressed.value ? 0.97 : 1, SPRING_PRESS) },
    ],
  }));

  const archiveHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, ARCHIVE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));

  const completeHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [COMPLETE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  const hintScaleStyle = useAnimatedStyle(() => {
    const abs = Math.abs(translateX.value);
    const scale = interpolate(abs, [0, 120], [0.82, 1.06], Extrapolation.CLAMP);
    return { transform: [{ scale }] };
  });

  const archiveBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, ARCHIVE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));
  const completeBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [COMPLETE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  const priorityTone =
    typeof task.priority === 'number' && task.priority >= 4
      ? 'rose'
      : typeof task.priority === 'number' && task.priority >= 3
        ? 'amber'
        : null;

  const dueDate = task.due_at ? new Date(task.due_at) : null;
  const dueLabel = dueDate
    ? `${dueDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : null;

  return (
    <View className="relative" style={{ minHeight: 92 }}>
      {/* Behind-card action hints — depth veils */}
      <Animated.View
        style={archiveHintStyle}
        className="absolute inset-0 flex-row items-center rounded-card border border-emerald-200/40 bg-emerald-50 pl-6"
      >
        <Animated.View
          style={[hintScaleStyle, archiveBgStyle]}
          className="flex-row items-center gap-2"
        >
          <View className="h-8 w-8 items-center justify-center rounded-full bg-white border border-emerald-200/70">
            <Archive size={16} color="#10B981" />
          </View>
          <Text className="text-[11px] font-bold tracking-[0.08em] text-emerald-700">ARCHIVE</Text>
        </Animated.View>
      </Animated.View>
      <Animated.View
        style={completeHintStyle}
        className="absolute inset-0 flex-row items-center justify-end rounded-card border border-accent/15 bg-accent-soft pr-6"
      >
        <Animated.View
          style={[hintScaleStyle, completeBgStyle]}
          className="flex-row items-center gap-2"
        >
          <Text className="text-[11px] font-bold tracking-[0.08em] text-accent">DONE</Text>
          <View className="h-8 w-8 items-center justify-center rounded-full bg-white border border-accent/15">
            <CheckCircle2 size={16} color="#6366F1" />
          </View>
        </Animated.View>
      </Animated.View>

      <GestureDetector gesture={gestures}>
        <Animated.View style={cardStyle}>
          <GlassCard
            variant={completed ? 'subtle' : 'regular'}
            className={`p-4 ${completed ? 'opacity-90' : ''}`}
            style={{ minHeight: 92 }}
          >
            {/* left priority rail — ambient glow */}
            {priorityTone ? (
              <View
                className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${priorityTone === 'rose' ? 'bg-accent-rose' : 'bg-accent-amber'}`}
                style={{
                  shadowColor: priorityTone === 'rose' ? '#F43F5E' : '#F59E0B',
                  shadowOpacity: 0.35,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 0 },
                }}
              />
            ) : null}

            {/* Eyebrow — typographic hierarchy: text-[10px] uppercase tracking-[0.15em] */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Text className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink-muted">
                  {completed ? 'Completed' : 'Task'}
                </Text>
                {priorityTone ? (
                  <View
                    className={`rounded-full px-2 py-0.5 ${priorityTone === 'rose' ? 'bg-accent-roseSoft border border-rose-200' : 'bg-accent-amberSoft border border-amber-200'}`}
                  >
                    <Text
                      className={`text-[10px] font-extrabold tracking-[0.14em] ${priorityTone === 'rose' ? 'text-accent-rose' : 'text-amber-600'}`}
                    >
                      {priorityTone === 'rose' ? 'HIGH' : 'MED'}
                    </Text>
                  </View>
                ) : null}
              </View>
              {dueDate ? (
                <View className="flex-row items-center gap-1">
                  <Clock3 size={10} color="#94A3B8" />
                  <Text className="text-[10px] font-semibold tracking-wide text-ink-faint">
                    Due
                  </Text>
                </View>
              ) : null}
            </View>

            <View className={`mt-2 flex-row items-start gap-3 ${priorityTone ? 'pl-2' : ''}`}>
              <PressableScale
                onPress={() => toggle(task)}
                haptic={false}
                className={`h-9 w-9 items-center justify-center rounded-xl border ${completed ? 'border-emerald-200 bg-emerald-50' : 'border-glass-border bg-white'}`}
              >
                {completed ? (
                  <CheckCircle2 size={18} color="#10B981" />
                ) : (
                  <Circle size={18} color="#94A3B8" />
                )}
              </PressableScale>

              {/* Container-driven text block — zero shift */}
              <View className="flex-1" style={{ minHeight: 52 }}>
                <Text
                  className={`text-[15px] font-semibold leading-5 tracking-[-0.01em] ${completed ? 'text-ink-faint line-through' : 'text-ink'}`}
                  numberOfLines={2}
                >
                  {task.title}
                </Text>

                {/* Meta row — pill with micro-border + inset highlight */}
                <View className="mt-2 flex-row flex-wrap items-center gap-2">
                  {dueLabel ? (
                    <View className="flex-row items-center gap-1.5 rounded-full border border-white/60 bg-canvas-soft px-2.5 py-1">
                      <View
                        className="absolute inset-x-0 top-0 h-px bg-white/70 rounded-full"
                        pointerEvents="none"
                      />
                      <Text className="text-[11px] font-semibold tracking-[-0.01em] text-ink-muted">
                        {dueLabel}
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-[11px] font-medium tracking-[-0.01em] text-ink-faint">
                      No due date
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Bottom hairline for bevel refinement */}
            <View
              pointerEvents="none"
              className="absolute inset-x-4 bottom-0 h-px bg-slate-100/0"
            />
          </GlassCard>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
