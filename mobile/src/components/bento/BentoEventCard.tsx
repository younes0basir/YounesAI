import React from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { CalendarClock, MapPin } from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import type { CalendarEvent } from '@/lib/types';

const SPRING = { damping: 15, stiffness: 120 };

export function BentoEventCard({ event }: { event: CalendarEvent }) {
  const pressed = useSharedValue(0);

  const tap = Gesture.Tap()
    .onBegin(() => {
      pressed.value = 1;
    })
    .onFinalize(() => {
      pressed.value = 0;
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(pressed.value ? 0.96 : 1, SPRING) }],
  }));

  const start = event.starts_at ? new Date(event.starts_at) : null;

  return (
    <GestureDetector gesture={tap}>
      <Animated.View style={cardStyle}>
        <GlassCard className="p-4">
          <View className="flex-row items-center gap-2">
            <CalendarClock size={16} color="#6366F1" />
            <Text className="text-xs font-semibold uppercase tracking-wide text-accent">
              {start
                ? start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Anytime'}
            </Text>
          </View>
          <Text className="mt-2 text-[15px] font-semibold text-ink" numberOfLines={2}>
            {event.title}
          </Text>
          {event.location_text ? (
            <View className="mt-1.5 flex-row items-center gap-1">
              <MapPin size={12} color="#94A3B8" />
              <Text className="text-xs text-ink-soft" numberOfLines={1}>
                {event.location_text}
              </Text>
            </View>
          ) : null}
        </GlassCard>
      </Animated.View>
    </GestureDetector>
  );
}
