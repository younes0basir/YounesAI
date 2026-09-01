import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { CheckSquare, MessageCircle, Mic, Search } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { cssInterop } from 'nativewind';
import { hapticTap } from '@/lib/haptics';

cssInterop(LinearGradient, { className: 'style' });
cssInterop(BlurView, { className: 'style' });

interface OrbQuickRingProps {
  visible: boolean;
  onClose: () => void;
  onAction: (id: 'voice' | 'task' | 'search' | 'chat') => void;
}

const ACTIONS = [
  { id: 'voice' as const, label: 'Voice', Icon: Mic, color: '#6366F1', bg: 'bg-accent-soft' },
  { id: 'task' as const, label: 'Task', Icon: CheckSquare, color: '#10B981', bg: 'bg-emerald-50' },
  { id: 'search' as const, label: 'Find', Icon: Search, color: '#F59E0B', bg: 'bg-amber-50' },
  { id: 'chat' as const, label: 'Chat', Icon: MessageCircle, color: '#EC4899', bg: 'bg-rose-50' },
];

export function OrbQuickRing({ visible, onClose, onAction }: OrbQuickRingProps) {
  if (!visible) return null;

  return (
    <View className="absolute inset-0 items-center justify-center" pointerEvents="box-none">
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
        className="absolute inset-0"
        pointerEvents="none"
      >
        <BlurView intensity={14} tint="light" className="absolute inset-0" />
        <View className="absolute inset-0 bg-ink/8" />
      </Animated.View>
      <View className="h-[190px] w-[190px] items-center justify-center">
        {ACTIONS.map((action, idx) => {
          const angle = -90 + idx * 90;
          const rad = (angle * Math.PI) / 180;
          const radius = 70;
          const x = Math.cos(rad) * radius;
          const y = Math.sin(rad) * radius;
          const Icon = action.Icon;
          return (
            <Animated.View
              key={action.id}
              entering={ZoomIn.delay(idx * 40)
                .springify()
                .damping(20)
                .stiffness(260)}
              exiting={ZoomOut.duration(120)}
              style={{
                position: 'absolute',
                left: 95 + x - 28,
                top: 95 + y - 28,
              }}
            >
              <Pressable
                onPress={() => {
                  hapticTap();
                  onAction(action.id);
                  onClose();
                }}
                className="h-14 w-14 items-center justify-center overflow-hidden rounded-full border bg-white"
                style={{
                  borderTopColor: 'rgba(255,255,255,0.9)',
                  borderBottomColor: 'rgba(241,245,249,1)',
                  borderLeftColor: 'rgba(148,163,184,0.18)',
                  borderRightColor: 'rgba(148,163,184,0.18)',
                  shadowColor: action.color,
                  shadowOpacity: 0.14,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 4,
                }}
              >
                <View
                  pointerEvents="none"
                  className="absolute inset-x-2 top-0 h-px bg-white/80 rounded-full"
                />
                <View className={`absolute inset-0 opacity-60 ${action.bg}`} />
                <Icon size={20} color={action.color} />
              </Pressable>
              <Text className="mt-1.5 text-center text-[10px] font-bold tracking-[0.08em] text-ink">
                {action.label.toUpperCase()}
              </Text>
            </Animated.View>
          );
        })}
        <Animated.View
          entering={FadeIn.delay(180).duration(160)}
          exiting={FadeOut.duration(100)}
          className="overflow-hidden rounded-full border border-white/20 bg-ink px-4 py-2"
          style={{
            shadowColor: '#0F172A',
            shadowOpacity: 0.18,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
          }}
        >
          <Text className="text-xs font-bold tracking-wide text-white">Release</Text>
        </Animated.View>
      </View>
    </View>
  );
}
