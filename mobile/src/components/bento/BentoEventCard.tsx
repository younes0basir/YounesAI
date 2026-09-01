import React from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { CalendarClock, MapPin } from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { hapticTap } from '@/lib/haptics';
import type { CalendarEvent } from '@/lib/types';

// Premium spring — 260 / 20 per directive
const SPRING = { damping: 20, stiffness: 260, mass: 0.6 } as const;
const SPRING_SOFT = { damping: 20, stiffness: 260, mass: 0.7 } as const;

export function BentoEventCard({ event }: { event: CalendarEvent }) {
  const pressed = useSharedValue(0);

  const tap = Gesture.Tap()
    .maxDuration(400)
    .onBegin(() => {
      pressed.value = 1;
    })
    .onFinalize(() => {
      pressed.value = 0;
    })
    .onEnd(() => {
      hapticTap();
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(pressed.value ? 0.97 : 1, pressed.value ? SPRING : SPRING_SOFT) },
    ],
    opacity: withSpring(pressed.value ? 0.98 : 1, SPRING),
  }));

  const start = event.starts_at ? new Date(event.starts_at) : null;
  const isToday = start ? start.toDateString() === new Date().toDateString() : false;
  const dateLabel = start
    ? start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    : null;
  const timeLabel = start
    ? start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Anytime';

  return (
    <GestureDetector gesture={tap}>
      <Animated.View style={cardStyle}>
        <GlassCard variant="regular" className="p-4" style={{ minHeight: 118 }}>
          {/* Eyebrow row — tracking 0.15em, 10px uppercase */}
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-row items-center gap-2">
              <View className="flex-row items-center gap-1.5 rounded-full border border-white/60 bg-accent-soft px-2.5 py-1">
                {/* inset highlight */}
                <View
                  pointerEvents="none"
                  className="absolute inset-x-0 top-0 h-px bg-white/70 rounded-full"
                />
                <CalendarClock size={11} color="#6366F1" />
                <Text className="text-[11px] font-bold tracking-[-0.01em] text-accent">
                  {timeLabel}
                </Text>
              </View>
              <Text className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink-muted">
                Event
              </Text>
            </View>
            {isToday ? (
              <View
                className="rounded-full bg-amber-400 px-2 py-0.5 border border-amber-500/20"
                style={{
                  shadowColor: '#F59E0B',
                  shadowOpacity: 0.2,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 2 },
                }}
              >
                <Text className="text-[10px] font-extrabold tracking-[0.14em] text-white">
                  TODAY
                </Text>
              </View>
            ) : null}
          </View>

          {/* Title — container-driven, zero shift */}
          <View style={{ minHeight: 40 }} className="mt-3 justify-center">
            <Text
              className="text-[16px] font-bold leading-5 tracking-[-0.02em] text-ink"
              numberOfLines={2}
            >
              {event.title}
            </Text>
          </View>

          {/* Location pill — micro-border + bevel */}
          {event.location_text ? (
            <View
              className="mt-2.5 flex-row items-center gap-1.5 self-start rounded-full border border-white/60 bg-canvas-soft px-2.5 py-1"
              style={{
                borderBottomColor: 'rgba(241,245,249,1)',
              }}
            >
              <View
                pointerEvents="none"
                className="absolute inset-x-0 top-0 h-px bg-white/60 rounded-full"
              />
              <MapPin size={11} color="#64748B" />
              <Text
                className="max-w-[180px] text-[12px] font-medium tracking-[-0.01em] text-ink-muted"
                numberOfLines={1}
              >
                {event.location_text}
              </Text>
            </View>
          ) : null}

          {/* Date footer — tight tracking for data */}
          {start ? (
            <Text className="mt-2 text-[11px] font-semibold tracking-[-0.03em] text-ink-faint">
              {dateLabel}
            </Text>
          ) : null}
        </GlassCard>
      </Animated.View>
    </GestureDetector>
  );
}
