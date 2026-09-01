import React, { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';

cssInterop(LinearGradient, { className: 'style' });

interface OrbPulseRingProps {
  active: boolean;
  size: number;
  color?: string;
}

/**
 * Premium breathing halo — dual rings with conical gradient wash.
 * Replaces flat opacity pulse with layered diffuse glow.
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
    transform: [{ scale: 1 + r1.value * 0.9 }],
    opacity: active ? (1 - interpolate(o1.value, [0, 1], [0, 1])) * 0.24 : 0,
  }));
  const s2 = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + r2.value * 0.9 }],
    opacity: active ? (1 - o2.value) * 0.16 : 0,
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
            overflow: 'hidden',
          },
          s1,
        ]}
      >
        <LinearGradient
          colors={[color, '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, borderRadius: size / 2, opacity: 0.9 }}
        />
      </Animated.View>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            overflow: 'hidden',
          },
          s2,
        ]}
      >
        <LinearGradient
          colors={[color, '#EC4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, borderRadius: size / 2, opacity: 0.75 }}
        />
      </Animated.View>
    </View>
  );
}
