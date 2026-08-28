import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

/** Header for stack (non-tab) screens with a glass back button. */
export function ScreenHeader({ title, subtitle, right }: ScreenHeaderProps) {
  const router = useRouter();

  return (
    <View className="flex-row items-center gap-3 px-4 pb-3 pt-4">
      <Pressable
        onPress={() => router.back()}
        className="h-10 w-10 items-center justify-center rounded-full border border-glass-border bg-white"
        accessibilityLabel="Go back"
      >
        <ChevronLeft size={20} color="#0F172A" />
      </Pressable>
      <View className="flex-1">
        <Text className="text-2xl font-bold text-ink">{title}</Text>
        {subtitle ? <Text className="text-xs text-ink-soft">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}
