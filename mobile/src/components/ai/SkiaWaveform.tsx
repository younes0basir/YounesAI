import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Canvas, RoundedRect, LinearGradient, vec } from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const BAR_COUNT = 24;
const BAR_WIDTH = 6;
const BAR_GAP = 5;
const HEIGHT = 96;

interface SkiaWaveformProps {
  /** 0–1 audio level; pass a shared value so updates stay on the UI thread. */
  level: SharedValue<number>;
  width?: number;
}

export function SkiaWaveform({ level, width = 280 }: SkiaWaveformProps) {
  const phase = useSharedValue(0);

  useEffect(() => {
    phase.value = withRepeat(withTiming(Math.PI * 2, { duration: 1600 }), -1, false);
  }, [phase]);

  const totalWidth = BAR_COUNT * (BAR_WIDTH + BAR_GAP) - BAR_GAP;
  const originX = Math.max(0, (width - totalWidth) / 2);

  return (
    <View style={{ width, height: HEIGHT }}>
      <Canvas style={{ flex: 1 }}>
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <Bar
            key={i}
            index={i}
            x={originX + i * (BAR_WIDTH + BAR_GAP)}
            level={level}
            phase={phase}
          />
        ))}
      </Canvas>
    </View>
  );
}

function Bar({
  index,
  x,
  level,
  phase,
}: {
  index: number;
  x: number;
  level: SharedValue<number>;
  phase: SharedValue<number>;
}) {
  const barHeight = useDerivedValue(() => {
    const wave = Math.sin(phase.value + index * 0.55) * 0.5 + 0.5;
    const energy = 0.15 + level.value * 0.85;
    return 8 + wave * energy * (HEIGHT - 16);
  });
  const barY = useDerivedValue(() => (HEIGHT - barHeight.value) / 2);

  return (
    <RoundedRect x={x} y={barY} width={BAR_WIDTH} height={barHeight} r={BAR_WIDTH / 2}>
      <LinearGradient
        start={vec(x, 0)}
        end={vec(x, HEIGHT)}
        colors={['#6366F1', '#8B5CF6', '#EC4899', '#10B981']}
      />
    </RoundedRect>
  );
}
