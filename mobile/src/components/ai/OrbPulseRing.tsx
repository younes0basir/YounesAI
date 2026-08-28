import React, { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { View } from 'react-native';

interface OrbPulseRingProps {
  active: boolean;
  size: number;
  color?: string;
}

/**
 * Breathing halo behind the collapsed orb when idle.
 * Two rings pulse out-of-phase. Hook-safe: no hook factory indirection.
 */
export function OrbPulseRing({ active, size, color = '#6366F1' }: OrbPulseRingProps) {
  const r1 = useSharedValue(0);
  const o1 = useSharedValue(0);
  const r2 = useSharedValue(0);
  const o2 = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      r1.value = 0;
      o1.value = 0;
      r2.value = 0;
      o2.value = 0;
      return;
    }
    const dur = 2600;
    r1.value = withRepeat(
      withTiming(1, { duration: dur, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    o1.value = withRepeat(
      withTiming(1, { duration: dur, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    r2.value = withDelay(
      900,
      withRepeat(withTiming(1, { duration: dur, easing: Easing.out(Easing.ease) }), -1, false)
    );
    o2.value = withDelay(
      900,
      withRepeat(withTiming(1, { duration: dur, easing: Easing.out(Easing.ease) }), -1, false)
    );
  }, [active, r1, o1, r2, o2]);

  const s1 = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + r1.value * 0.85 }],
    opacity: active ? (1 - o1.value) * 0.22 : 0,
  }));
  const s2 = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + r2.value * 0.85 }],
    opacity: active ? (1 - o2.value) * 0.22 : 0,
  }));

  if (!active) return null;

  return (
    <View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
          s1,
        ]}
      />
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
          s2,
        ]}
      />
    </View>
  );
}
