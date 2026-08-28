import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { CheckSquare, MessageCircle, Mic, Search } from 'lucide-react-native';
import { hapticTap } from '@/lib/haptics';

interface OrbQuickRingProps {
  visible: boolean;
  onClose: () => void;
  onAction: (id: 'voice' | 'task' | 'search' | 'chat') => void;
}

const ACTIONS = [
  { id: 'voice' as const, label: 'Voice', Icon: Mic, color: '#6366F1' },
  { id: 'task' as const, label: 'Task', Icon: CheckSquare, color: '#10B981' },
  { id: 'search' as const, label: 'Find', Icon: Search, color: '#F59E0B' },
  { id: 'chat' as const, label: 'Chat', Icon: MessageCircle, color: '#EC4899' },
];

export function OrbQuickRing({ visible, onClose, onAction }: OrbQuickRingProps) {
  if (!visible) return null;

  return (
    <View className="absolute inset-0 items-center justify-center" pointerEvents="box-none">
      {/* Scrim to dismiss */}
      <Pressable
        onPress={() => {
          hapticTap();
          onClose();
        }}
        style={{ position: 'absolute', inset: -400 }}
      />
      <Animated.View
        entering={FadeIn.duration(160)}
        exiting={FadeOut.duration(120)}
        className="absolute inset-0 bg-ink/10"
        pointerEvents="none"
      />
      <View className="h-[180px] w-[180px] items-center justify-center">
        {ACTIONS.map((action, idx) => {
          // place in a circle: start at -90deg (top), spread evenly
          const angle = -90 + idx * 90;
          const rad = (angle * Math.PI) / 180;
          const radius = 68;
          const x = Math.cos(rad) * radius;
          const y = Math.sin(rad) * radius;
          const Icon = action.Icon;
          return (
            <Animated.View
              key={action.id}
              entering={ZoomIn.delay(idx * 40).duration(220)}
              exiting={ZoomOut.duration(120)}
              style={{
                position: 'absolute',
                left: 90 + x - 28,
                top: 90 + y - 28,
              }}
            >
              <Pressable
                onPress={() => {
                  hapticTap();
                  onAction(action.id);
                  onClose();
                }}
                className="h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg"
                style={{
                  borderWidth: 1,
                  borderColor: 'rgba(148,163,184,0.2)',
                }}
              >
                <Icon size={20} color={action.color} />
              </Pressable>
              <Text className="mt-1 text-center text-[10px] font-bold text-ink">
                {action.label}
              </Text>
            </Animated.View>
          );
        })}
        {/* center dismiss pill */}
        <Animated.View
          entering={FadeIn.delay(180).duration(160)}
          exiting={FadeOut.duration(100)}
          className="h-10 rounded-full bg-ink px-4 items-center justify-center"
        >
          <Text className="text-xs font-bold text-white">Release</Text>
        </Animated.View>
      </View>
    </View>
  );
}
