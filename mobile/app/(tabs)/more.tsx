import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import {
  Bell,
  Calendar,
  FileText,
  FolderKanban,
  Image as ImageIcon,
  MapPin,
  Mic,
  Settings,
  Timer,
} from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { PressableScale } from '@/components/ui/PressableScale';
import { useAuthStore } from '@/stores/useAuthStore';

interface Module {
  label: string;
  description: string;
  href: Href;
  icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
  bg: string;
}

const MODULES: Module[] = [
  {
    label: 'Events',
    description: 'Calendar & scheduling',
    href: '/events',
    icon: Calendar,
    color: '#6366F1',
    bg: '#E0E7FF',
  },
  {
    label: 'Reminders',
    description: 'Snooze & dismiss',
    href: '/reminders',
    icon: Timer,
    color: '#F59E0B',
    bg: '#FEF3C7',
  },
  {
    label: 'Notifications',
    description: 'Alerts feed',
    href: '/notifications',
    icon: Bell,
    color: '#F43F5E',
    bg: '#FFE4E6',
  },
  {
    label: 'Places',
    description: 'Geofenced context',
    href: '/places',
    icon: MapPin,
    color: '#10B981',
    bg: '#D1FAE5',
  },
  {
    label: 'Projects',
    description: 'Workspaces & goals',
    href: '/projects',
    icon: FolderKanban,
    color: '#8B5CF6',
    bg: '#EDE9FE',
  },
  {
    label: 'Files',
    description: 'Document intelligence',
    href: '/files',
    icon: FileText,
    color: '#3B82F6',
    bg: '#DBEAFE',
  },
  {
    label: 'Image Studio',
    description: 'FLUX generation',
    href: '/image-studio',
    icon: ImageIcon,
    color: '#EC4899',
    bg: '#FCE7F3',
  },
  {
    label: 'Voice',
    description: 'Hands-free commands',
    href: '/voice',
    icon: Mic,
    color: '#0EA5E9',
    bg: '#E0F2FE',
  },
  {
    label: 'Settings',
    description: 'Account & sync',
    href: '/settings',
    icon: Settings,
    color: '#475569',
    bg: '#F1F5F9',
  },
];

export default function MoreScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-4 pb-40 pt-4">
        <Pressable onPress={() => router.push('/settings')}>
          <GlassCard className="flex-row items-center gap-3 p-4">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-accent">
              <Text className="text-lg font-bold text-white">
                {(user?.display_name ?? 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-ink">{user?.display_name}</Text>
              <Text className="text-xs text-ink-soft">{user?.email}</Text>
            </View>
          </GlassCard>
        </Pressable>

        <Text className="mb-3 mt-6 text-xs font-bold uppercase tracking-widest text-ink-faint">
          All modules
        </Text>

        <View className="flex-row flex-wrap justify-between gap-y-3">
          {MODULES.map((mod, i) => (
            <Animated.View
              key={mod.label}
              entering={FadeInDown.delay(i * 50).duration(300)}
              className="w-[48%]"
            >
              <PressableScale onPress={() => router.push(mod.href)}>
                <GlassCard className="p-4">
                  <View
                    className="h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: mod.bg }}
                  >
                    <mod.icon size={19} color={mod.color} />
                  </View>
                  <Text className="mt-3 text-[15px] font-bold text-ink">{mod.label}</Text>
                  <Text className="mt-0.5 text-xs text-ink-soft">{mod.description}</Text>
                </GlassCard>
              </PressableScale>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
