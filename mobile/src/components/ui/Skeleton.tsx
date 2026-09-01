import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';

cssInterop(LinearGradient, { className: 'style' });

interface SkeletonProps {
  className?: string;
}

/**
 * Premium skeleton — layered shimmer + depth matching GlassCard.
 * Zero-shift guarantee: outer minHeight/padding/gaps identical to real cards.
 * Shimmer is a sliding gradient veil, not linear opacity flicker.
 */
export function Skeleton({ className }: SkeletonProps) {
  const shimmer = useSharedValue(-1);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, [shimmer]);

  const veilStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmer.value * 240 }],
    opacity: 0.55,
  }));

  return (
    <View className={`overflow-hidden bg-slate-200/80 ${className ?? ''}`}>
      <Animated.View style={veilStyle} className="absolute inset-y-0 -left-12 w-24">
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.9)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1, opacity: 0.9 }}
        />
      </Animated.View>
    </View>
  );
}

/** Card-shaped skeleton matching BentoTaskCard + GlassCard proportions exactly. */
export function SkeletonCard() {
  return (
    <View
      className="rounded-card border bg-white/80 p-4"
      style={{
        minHeight: 92,
        borderTopColor: 'rgba(255,255,255,0.55)',
        borderBottomColor: 'rgba(241,245,249,1)',
        borderLeftColor: 'rgba(148,163,184,0.14)',
        borderRightColor: 'rgba(148,163,184,0.14)',
        shadowColor: '#0F172A',
        shadowOpacity: 0.05,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
      }}
    >
      {/* dual shadow wrapper hint */}
      <View
        pointerEvents="none"
        className="absolute inset-0 rounded-card"
        style={{
          shadowColor: '#6366F1',
          shadowOpacity: 0.06,
          shadowRadius: 28,
          shadowOffset: { width: 0, height: 12 },
        }}
      />
      <View
        pointerEvents="none"
        className="absolute inset-x-0 top-0 h-px bg-white/70 rounded-t-card"
      />
      <View
        pointerEvents="none"
        className="absolute inset-x-0 bottom-0 h-px bg-slate-100/60 rounded-b-card"
      />
      {/* eyebrow */}
      <View className="flex-row items-center justify-between">
        <Skeleton className="h-2.5 w-16 rounded-full" />
        <Skeleton className="h-4 w-12 rounded-full" />
      </View>
      <View className="mt-3 flex-row items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-xl" />
        <View className="flex-1 gap-2.5">
          <Skeleton className="h-3.5 w-[74%] rounded-full" />
          <View className="flex-row items-center gap-2">
            <Skeleton className="h-5 w-[42%] rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </View>
        </View>
      </View>
    </View>
  );
}

export function SkeletonRow() {
  return (
    <View
      className="flex-row items-center gap-3 rounded-card border bg-white/70 px-4 py-3"
      style={{
        minHeight: 68,
        borderTopColor: 'rgba(255,255,255,0.55)',
        borderBottomColor: 'rgba(241,245,249,1)',
        borderLeftColor: 'rgba(148,163,184,0.14)',
        borderRightColor: 'rgba(148,163,184,0.14)',
        shadowColor: '#0F172A',
        shadowOpacity: 0.04,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
      }}
    >
      <View
        pointerEvents="none"
        className="absolute inset-x-0 top-0 h-px bg-white/60 rounded-t-card"
      />
      <Skeleton className="h-9 w-9 rounded-xl" />
      <View className="flex-1 gap-1.5">
        <Skeleton className="h-3.5 w-2/3 rounded-full" />
        <Skeleton className="h-3 w-1/2 rounded-full" />
      </View>
      <Skeleton className="h-6 w-6 rounded-full" />
    </View>
  );
}

/** Bento KPI stat skeleton — matches the 48.8% half-slot cards on Dashboard. */
export function SkeletonStat() {
  return (
    <View
      className="rounded-card border bg-white p-4"
      style={{
        minHeight: 116,
        borderTopColor: 'rgba(255,255,255,0.55)',
        borderBottomColor: 'rgba(241,245,249,1)',
        borderLeftColor: 'rgba(148,163,184,0.14)',
        borderRightColor: 'rgba(148,163,184,0.14)',
        shadowColor: '#0F172A',
        shadowOpacity: 0.04,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 1,
      }}
    >
      <View
        pointerEvents="none"
        className="absolute inset-x-0 top-0 h-px bg-white/70 rounded-t-card"
      />
      <Skeleton className="h-9 w-9 rounded-xl" />
      <Skeleton className="mt-3 h-7 w-12 rounded-lg" />
      <Skeleton className="mt-2 h-2.5 w-20 rounded-full" />
      <Skeleton className="mt-2.5 h-1 w-12 rounded-full opacity-60" />
    </View>
  );
}

/** Chat message skeleton — mirrors assistant bubble dimensions. */
export function SkeletonMessage({ align = 'left' }: { align?: 'left' | 'right' }) {
  const isUser = align === 'right';
  return (
    <View className={`max-w-[85%] ${isUser ? 'self-end' : 'self-start'}`}>
      <View
        className={`overflow-hidden rounded-3xl px-4 py-3 ${isUser ? 'rounded-br-md bg-accent/10 border border-accent/10' : 'rounded-bl-md border bg-white'}`}
        style={{
          minHeight: 52,
          minWidth: 180,
          borderTopColor: isUser ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.7)',
          borderBottomColor: 'rgba(241,245,249,1)',
          shadowColor: isUser ? '#6366F1' : '#0F172A',
          shadowOpacity: isUser ? 0.06 : 0.04,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <View pointerEvents="none" className="absolute inset-x-0 top-0 h-px bg-white/60" />
        <Skeleton className={`h-3.5 rounded-full ${isUser ? 'w-[88%]' : 'w-[92%]'}`} />
        <Skeleton className="mt-2 h-3 w-[62%] rounded-full" />
      </View>
    </View>
  );
}
