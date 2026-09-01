import React, { useEffect } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { CheckSquare, LayoutGrid, Mail, MessageCircle, Shapes } from 'lucide-react-native';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { hapticSelect, hapticTap } from '@/lib/haptics';

cssInterop(BlurView, { className: 'style' });
cssInterop(LinearGradient, { className: 'style' });

// Premium physics — stiffness 260 damping 20
const SPRING = { damping: 20, stiffness: 260, mass: 0.6 } as const;
const SPRING_PILL = { damping: 20, stiffness: 260, mass: 0.7 } as const;

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
 * Floating glass pill tab bar — premium spatial rebuild.
 * Depth: dual ambient shadows (slate 0.05 + indigo 0.06), inner top-edge bevel
 * Light: white 1px inset + bottom hairline, high-opacity fallback on Android
 * Motion: all springs 260/20, center FAB conical glow when focused
 */
export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();

  if (keyboardVisible) return null;

  const useHighOpacity = Platform.OS === 'android';

  return (
    <View
      className="absolute inset-x-3"
      style={{ bottom: Math.max(insets.bottom, 12) }}
      pointerEvents="box-none"
    >
      {/* Outer dual shadow wrapper */}
      <View
        style={{
          borderRadius: 999,
          shadowColor: '#0F172A',
          shadowOpacity: 0.05,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        }}
      >
        <View
          style={{
            borderRadius: 999,
            shadowColor: '#6366F1',
            shadowOpacity: 0.07,
            shadowRadius: 32,
            shadowOffset: { width: 0, height: 14 },
            elevation: 14,
          }}
        >
          <View
            className="flex-row items-center overflow-hidden rounded-full border"
            style={{
              borderTopColor: 'rgba(255,255,255,0.55)',
              borderBottomColor: 'rgba(241,245,249,1)',
              borderLeftColor: 'rgba(148,163,184,0.18)',
              borderRightColor: 'rgba(148,163,184,0.18)',
              backgroundColor: useHighOpacity ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.78)',
            }}
          >
            {!useHighOpacity ? (
              <BlurView intensity={72} tint="light" className="absolute inset-0" />
            ) : null}
            <View className="absolute inset-0 bg-white/60" style={{ borderRadius: 999 }} />
            {/* Mesh wash */}
            <LinearGradient
              colors={['rgba(238,242,255,0.55)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: 'absolute', inset: 0, opacity: 0.5, borderRadius: 999 }}
            />
            {/* Top-edge specular bevel */}
            <View
              pointerEvents="none"
              className="absolute inset-x-6 top-0 h-px bg-white/80"
              style={{ borderRadius: 999 }}
            />
            <View
              pointerEvents="none"
              className="absolute inset-x-0 bottom-0 h-px bg-slate-100/70"
              style={{ borderRadius: 999 }}
            />

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
                  <CenterFab key={route.key} focused={focused} Icon={Icon} onPress={onPress} />
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
      </View>
    </View>
  );
}

function CenterFab({
  focused,
  Icon,
  onPress,
}: {
  focused: boolean;
  Icon: React.ComponentType<{ size: number; color: string }>;
  onPress: () => void;
}) {
  const pressed = useSharedValue(0);
  const active = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    active.value = withSpring(focused ? 1 : 0, SPRING);
  }, [focused, active]);

  const fabStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(pressed.value ? 0.94 : 1, SPRING) },
      { scale: withSpring(focused ? 1.03 : 1, SPRING_PILL) },
    ],
  }));
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(pressed.value ? 0.92 : 1, SPRING) }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (pressed.value = 1)}
      onPressOut={() => (pressed.value = 0)}
      className="flex-1 items-center py-1.5"
      accessibilityLabel="Chat"
      hitSlop={8}
    >
      <Animated.View
        style={[
          fabStyle,
          {
            shadowColor: focused ? '#6366F1' : '#0F172A',
            shadowOpacity: focused ? 0.32 : 0.12,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
          } as any,
        ]}
        className="h-[54px] w-[54px] items-center justify-center overflow-hidden rounded-full border border-white/30"
      >
        <LinearGradient
          colors={focused ? ['#6366F1', '#8B5CF6', '#7C3AED'] : ['#0F172A', '#1E293B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="absolute inset-0"
        />
        {/* conical glow when focused */}
        {focused ? (
          <LinearGradient
            colors={['rgba(255,255,255,0.18)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="absolute inset-0"
            style={{ opacity: 0.9 }}
          />
        ) : null}
        <View
          pointerEvents="none"
          className="absolute inset-x-3 top-1.5 h-px bg-white/30 rounded-full"
        />
        <View
          pointerEvents="none"
          className="absolute inset-0 rounded-full border border-white/12"
        />
        <Animated.View
          style={innerStyle}
          className="h-8 w-8 items-center justify-center rounded-full bg-white/14 border border-white/20"
        >
          <Icon size={20} color="#FFFFFF" />
        </Animated.View>
      </Animated.View>
    </Pressable>
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
  const press = useSharedValue(0);

  useEffect(() => {
    active.value = withTiming(focused ? 1 : 0, { duration: 240, easing: undefined } as any);
  }, [focused, active]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(active.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: withSpring(active.value ? 1 : 0.74, SPRING_PILL) }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(focused ? 1.08 : 1, SPRING) },
      { scale: withSpring(press.value ? 0.9 : 1, SPRING) },
    ],
  }));

  const liftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: withSpring(focused ? -1 : 0, SPRING) }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (press.value = 1)}
      onPressOut={() => (press.value = 0)}
      className="flex-1 items-center gap-1 py-2.5"
      accessibilityLabel={label}
      hitSlop={6}
    >
      <Animated.View style={liftStyle} className="h-9 w-[58px] items-center justify-center">
        <Animated.View
          style={pillStyle}
          className="absolute h-9 w-[58px] rounded-full bg-accent-soft border border-accent/10"
        />
        {focused ? (
          <Animated.View
            style={pillStyle}
            pointerEvents="none"
            className="absolute h-9 w-[58px] rounded-full border border-white/50"
          />
        ) : null}
        {/* pill top bevel */}
        {focused ? (
          <Animated.View
            style={pillStyle}
            pointerEvents="none"
            className="absolute top-0 h-px w-[46px] bg-white/70 rounded-full"
          />
        ) : null}
        <Animated.View style={iconStyle}>
          <Icon size={20} color={focused ? '#6366F1' : '#64748B'} />
        </Animated.View>
        <Animated.View
          style={
            {
              opacity: active.value,
              transform: [{ scale: active.value }],
            } as any
          }
          className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-accent"
        />
      </Animated.View>
      <Text
        className={`text-[10px] font-bold tracking-[0.08em] ${focused ? 'text-accent' : 'text-ink-muted'}`}
      >
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}
