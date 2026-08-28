import React from 'react';
import { Text, View, Pressable } from 'react-native';
import { Link } from 'expo-router';

export default function NotFound() {
  return (
    <View className="flex-1 items-center justify-center bg-canvas px-8">
      <Text className="text-2xl font-bold text-ink">Lost in space</Text>
      <Text className="mt-2 text-center text-ink-soft">
        This screen doesn't exist in your workspace.
      </Text>
      <Link href="/(tabs)" asChild>
        <Pressable className="mt-6 rounded-full bg-accent px-6 py-3">
          <Text className="font-semibold text-white">Back to dashboard</Text>
        </Pressable>
      </Link>
    </View>
  );
}
