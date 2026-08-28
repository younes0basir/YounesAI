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
import { Archive, CheckCircle2, Circle } from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { hapticSuccess, hapticTap } from '@/lib/haptics';
import type { Task } from '@/lib/types';

const SPRING = { damping: 15, stiffness: 120 };
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
  const completed = task.status === 'done' || task.status === 'completed';

  const archive = (id: string) => {
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
      // bi-directional: right = archive, left = complete — unique dual swipe
      translateX.value = event.translationX;
    })
    .onEnd(() => {
      if (translateX.value > ARCHIVE_THRESHOLD) {
        translateX.value = withTiming(500, { duration: 220 }, (finished) => {
          if (finished && onArchive) runOnJS(archive)(task.id);
        });
      } else if (translateX.value < COMPLETE_THRESHOLD) {
        translateX.value = withTiming(-500, { duration: 220 }, (finished) => {
          if (finished && onToggleComplete) runOnJS(toggle)(task);
        });
      } else {
        translateX.value = withSpring(0, SPRING);
      }
    });

  const tap = Gesture.Tap()
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
      { scale: withSpring(pressed.value ? 0.96 : 1, SPRING) },
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
    const scale = interpolate(abs, [0, 120], [0.8, 1.1], Extrapolation.CLAMP);
    return { transform: [{ scale }] };
  });

  return (
    <View className="relative">
      <Animated.View
        style={archiveHintStyle}
        className="absolute inset-0 items-start justify-center rounded-card bg-accent-mint/20 pl-6"
      >
        <Animated.View style={hintScaleStyle}>
          <Archive size={22} color="#10B981" />
        </Animated.View>
      </Animated.View>
      <Animated.View
        style={completeHintStyle}
        className="absolute inset-0 items-end justify-center rounded-card bg-accent/15 pr-6"
      >
        <Animated.View style={hintScaleStyle}>
          <CheckCircle2 size={22} color="#6366F1" />
        </Animated.View>
      </Animated.View>

      <GestureDetector gesture={gestures}>
        <Animated.View style={cardStyle}>
          <GlassCard className="p-4">
            <View className="flex-row items-center gap-3">
              {completed ? (
                <CheckCircle2 size={20} color="#10B981" />
              ) : (
                <Circle size={20} color="#94A3B8" />
              )}
              <View className="flex-1">
                <Text
                  className={`text-[15px] font-semibold ${
                    completed ? 'text-ink-faint line-through' : 'text-ink'
                  }`}
                  numberOfLines={2}
                >
                  {task.title}
                </Text>
                {task.due_at ? (
                  <Text className="mt-0.5 text-xs text-ink-soft">
                    Due {new Date(task.due_at).toLocaleDateString()}
                  </Text>
                ) : null}
              </View>
              {typeof task.priority === 'number' && task.priority >= 4 ? (
                <View className="rounded-full bg-accent-rose/10 px-2 py-0.5">
                  <Text className="text-[10px] font-bold text-accent-rose">HIGH</Text>
                </View>
              ) : null}
            </View>
          </GlassCard>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
