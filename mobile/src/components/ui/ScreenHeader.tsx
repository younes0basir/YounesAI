import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';
import { ChevronLeft } from 'lucide-react-native';
import { hapticTap } from '@/lib/haptics';

cssInterop(BlurView, { className: 'style' });
cssInterop(LinearGradient, { className: 'style' });

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  translucent?: boolean;
}

/** Premium sticky header — glass field + dual shadow + tight hierarchy. */
export function ScreenHeader({ title, subtitle, right, translucent = true }: ScreenHeaderProps) {
  const router = useRouter();
  const useHighOpacity = Platform.OS === 'android';

  return (
    <View className="relative z-10 px-4 pb-3.5 pt-3">
      {translucent ? (
        <>
          {!useHighOpacity ? (
            <BlurView intensity={32} tint="light" className="absolute inset-0" />
          ) : (
            <View className="absolute inset-0 bg-white/80" />
          )}
          <View
            className="absolute inset-0 bg-white/55 border-b"
            style={{ borderBottomColor: 'rgba(148,163,184,0.12)' }}
          />
          {/* mesh wash */}
          <LinearGradient
            colors={['rgba(238,242,255,0.55)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.6 }}
            className="absolute inset-0"
            style={{ opacity: 0.6 }}
          />
          {/* top bevel */}
          <View pointerEvents="none" className="absolute inset-x-0 top-0 h-px bg-white/70" />
          <View pointerEvents="none" className="absolute inset-x-0 bottom-0 h-px bg-slate-100/60" />
          {/* ambient shadow veil under header */}
          <View
            pointerEvents="none"
            className="absolute inset-x-0 bottom-0"
            style={{
              height: 18,
              marginBottom: -18,
              backgroundColor: 'transparent',
              shadowColor: '#0F172A',
              shadowOpacity: 0.04,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
            }}
          />
        </>
      ) : null}
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={() => {
            hapticTap();
            router.back();
          }}
          hitSlop={10}
          className="h-10 w-10 items-center justify-center rounded-full border bg-white"
          style={{
            borderTopColor: 'rgba(255,255,255,0.9)',
            borderBottomColor: 'rgba(241,245,249,1)',
            borderLeftColor: 'rgba(148,163,184,0.18)',
            borderRightColor: 'rgba(148,163,184,0.18)',
            shadowColor: '#0F172A',
            shadowOpacity: 0.06,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 2,
          }}
          accessibilityLabel="Go back"
        >
          <View
            pointerEvents="none"
            className="absolute inset-x-2 top-0 h-px bg-white/80 rounded-full"
          />
          <ChevronLeft size={20} color="#0F172A" />
        </Pressable>
        <View className="flex-1">
          <Text
            className="text-[22px] font-extrabold tracking-[-0.03em] text-ink"
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              className="mt-0.5 text-[11px] font-medium tracking-[-0.01em] leading-4 text-ink-muted"
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View className="ml-2 shrink-0">{right}</View> : null}
      </View>
    </View>
  );
}
