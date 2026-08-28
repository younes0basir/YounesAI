import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { CheckSquare, LayoutGrid, Mail, MessageCircle, Shapes } from 'lucide-react-native';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { hapticSelect, hapticTap } from '@/lib/haptics';

cssInterop(BlurView, { className: 'style' });
cssInterop(LinearGradient, { className: 'style' });

const SPRING = { damping: 15, stiffness: 120 };

const ICONS: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  index: LayoutGrid,
  tasks: CheckSquare,
  chat: MessageCircle,
  inbox: Mail,
  more: Shapes,
};

const LABELS: Record<string, string> = {
  index: 'Home',
  tasks: 'Tasks',
  chat: 'Chat',
  inbox: 'Inbox',
  more: 'More',
};

/**
 * Floating glass pill tab bar with an animated active pill behind the
 * focused icon and a gradient-filled conversational hub in the center.
 */
export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();

  // The bar floats, so without this it would hover above the open keyboard.
  if (keyboardVisible) return null;

  return (
    <View
      className="absolute inset-x-4"
      style={{ bottom: Math.max(insets.bottom, 12) }}
      pointerEvents="box-none"
    >
      <View className="flex-row items-center overflow-hidden rounded-full border border-glass-border">
        <BlurView intensity={60} tint="light" className="absolute inset-0" />
        <View className="absolute inset-0 bg-glass-strong" />

        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const Icon = ICONS[route.name] ?? Shapes;
          const isCenter = route.name === 'chat';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              if (isCenter) hapticTap();
              else hapticSelect();
              navigation.navigate(route.name);
            }
          };

          if (isCenter) {
            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                className="flex-1 items-center py-2"
                accessibilityLabel="Chat"
              >
                <View className="h-12 w-12 overflow-hidden rounded-full">
                  <LinearGradient
                    colors={focused ? ['#6366F1', '#8B5CF6'] : ['#0F172A', '#334155']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="absolute inset-0"
                  />
                  <View className="flex-1 items-center justify-center">
                    <Icon size={22} color="#FFFFFF" />
                  </View>
                </View>
              </Pressable>
            );
          }

          return (
            <TabItem
              key={route.key}
              focused={focused}
              label={LABELS[route.name] ?? route.name}
              Icon={Icon}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabItem({
  focused,
  label,
  Icon,
  onPress,
}: {
  focused: boolean;
  label: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  onPress: () => void;
}) {
  const active = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    active.value = withTiming(focused ? 1 : 0, { duration: 180 });
  }, [focused, active]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: active.value,
    transform: [{ scale: withSpring(active.value ? 1 : 0.6, SPRING) }],
  }));

  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center gap-0.5 py-2.5"
      accessibilityLabel={label}
    >
      <View className="items-center justify-center">
        <Animated.View
          style={pillStyle}
          className="absolute h-9 w-14 rounded-full bg-accent-soft"
        />
        <Icon size={20} color={focused ? '#6366F1' : '#94A3B8'} />
      </View>
      <Text className={`text-[10px] font-semibold ${focused ? 'text-accent' : 'text-ink-faint'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
