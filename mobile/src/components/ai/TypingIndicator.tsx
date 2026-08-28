import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

/** Three pulsing dots shown while the orchestrator is working. */
export function TypingIndicator() {
  return (
    <View className="flex-row items-center gap-1.5 self-start rounded-3xl rounded-bl-md border border-glass-border bg-white px-4 py-3.5">
      {[0, 1, 2].map((i) => (
        <Dot key={i} index={i} />
      ))}
    </View>
  );
}

function Dot({ index }: { index: number }) {
  const progress = useSharedValue(0.3);

  useEffect(() => {
    progress.value = withDelay(
      index * 160,
      withRepeat(withTiming(1, { duration: 480, easing: Easing.inOut(Easing.ease) }), -1, true)
    );
  }, [index, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.7 + progress.value * 0.3 }],
  }));

  return <Animated.View style={style} className="h-2 w-2 rounded-full bg-accent" />;
}
