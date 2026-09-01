import React from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { hapticTap } from '@/lib/haptics';

/** Premium physics — stiffness 260 damping 20 per directive (no linear) */
const SPRING = { damping: 20, stiffness: 260, mass: 0.6 } as const;
const SPRING_SOFT = { damping: 20, stiffness: 260, mass: 0.7 } as const;

interface PressableScaleProps {
  onPress?: () => void;
  className?: string;
  haptic?: boolean;
  intensity?: 'subtle' | 'tactile';
  children: React.ReactNode;
}

/**
 * PressableScale — tactile spring compression, UI-thread only.
 * Uses Gesture.Tap so it cooperates with parent Pan gestures (swipe cards).
 * Spring: stiffness 260 damping 20 for premium weight.
 */
export function PressableScale({
  onPress,
  className,
  haptic = true,
  intensity = 'tactile',
  children,
}: PressableScaleProps) {
  const pressed = useSharedValue(0);
  const scale = intensity === 'subtle' ? 0.985 : 0.96;

  const fire = () => {
    if (haptic) hapticTap();
    onPress?.();
  };

  const tap = Gesture.Tap()
    .maxDuration(400)
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
    transform: [
      { scale: withSpring(pressed.value ? scale : 1, pressed.value ? SPRING : SPRING_SOFT) },
    ],
    opacity: withSpring(pressed.value ? 0.97 : 1, SPRING),
  }));

  return (
    <GestureDetector gesture={tap}>
      <Animated.View style={style} className={className}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
