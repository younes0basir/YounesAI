import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface SkeletonProps {
  className?: string;
}

/** Pulsing placeholder block for loading states. */
export function Skeleton({ className }: SkeletonProps) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={style} className={`rounded-xl bg-slate-200 ${className ?? ''}`} />;
}

/** Card-shaped skeleton matching GlassCard proportions. */
export function SkeletonCard() {
  return (
    <Animated.View className="rounded-card border border-glass-border bg-white/70 p-4">
      <View className="flex-row items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <View className="flex-1 gap-2">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </View>
      </View>
    </Animated.View>
  );
}
