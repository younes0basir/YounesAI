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
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';

cssInterop(LinearGradient, { className: 'style' });

/** Premium typing indicator — glass pill + spring dots + subtle mesh wash. */
export function TypingIndicator() {
  return (
    <View
      className="self-start flex-row items-center gap-1.5 overflow-hidden rounded-3xl rounded-bl-md border bg-white px-4 py-3.5"
      style={{
        borderTopColor: 'rgba(255,255,255,0.7)',
        borderBottomColor: 'rgba(241,245,249,1)',
        borderLeftColor: 'rgba(148,163,184,0.16)',
        borderRightColor: 'rgba(148,163,184,0.16)',
        shadowColor: '#0F172A',
        shadowOpacity: 0.05,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
      }}
    >
      <View pointerEvents="none" className="absolute inset-0">
        <LinearGradient
          colors={['rgba(238,242,255,0.5)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, opacity: 0.7 }}
        />
      </View>
      <View pointerEvents="none" className="absolute inset-x-0 top-0 h-px bg-white/70" />
      {[0, 1, 2].map((i) => (
        <Dot key={i} index={i} />
      ))}
    </View>
  );
}

function Dot({ index }: { index: number }) {
  const progress = useSharedValue(0.35);

  useEffect(() => {
    progress.value = withDelay(
      index * 140,
      withRepeat(withTiming(1, { duration: 520, easing: Easing.inOut(Easing.ease) }), -1, true)
    );
  }, [index, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.45 + progress.value * 0.55,
    transform: [
      { scale: 0.72 + progress.value * 0.38 },
      { translateY: (1 - progress.value) * -1.5 },
    ],
  }));

  return (
    <Animated.View
      style={style}
      className="h-2 w-2 rounded-full"
      // premium gradient dot — not flat opacity pulse
    >
      <LinearGradient
        colors={['#6366F1', '#8B5CF6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, borderRadius: 4 }}
      />
    </Animated.View>
  );
}
