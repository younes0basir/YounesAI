import React from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { hapticTap } from '@/lib/haptics';

const SPRING = { damping: 15, stiffness: 120 };

interface PressableScaleProps {
  onPress?: () => void;
  className?: string;
  haptic?: boolean;
  children: React.ReactNode;
}

/** UI-thread spring compression (0.96) with an optional haptic tick. */
export function PressableScale({
  onPress,
  className,
  haptic = true,
  children,
}: PressableScaleProps) {
  const pressed = useSharedValue(0);

  const fire = () => {
    if (haptic) hapticTap();
    onPress?.();
  };

  const tap = Gesture.Tap()
    .onBegin(() => {
      pressed.value = 1;
    })
    .onFinalize(() => {
      pressed.value = 0;
    })
    .onEnd(() => {
      if (onPress) runOnJS(fire)();
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(pressed.value ? 0.96 : 1, SPRING) }],
  }));

  return (
    <GestureDetector gesture={tap}>
      <Animated.View style={style} className={className}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
