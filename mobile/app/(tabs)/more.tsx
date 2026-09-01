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
    <SafeAreaView className="flex-1 bg-canvas-soft" edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.push('/settings')} className="mb-1">
          <GlassCard variant="elevated" className="flex-row items-center gap-3 p-4">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-ink border border-white/10">
              <Text className="text-lg font-extrabold text-white">
                {(user?.display_name ?? 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-bold text-ink" numberOfLines={1}>
                {user?.display_name}
              </Text>
              <Text className="text-xs font-medium text-ink-muted" numberOfLines={1}>
                {user?.email}
              </Text>
            </View>
            <View className="h-8 w-8 items-center justify-center rounded-full bg-accent-soft border border-accent/10">
              <Settings size={14} color="#6366F1" />
            </View>
          </GlassCard>
        </Pressable>

        <View className="mt-5 mb-3 flex-row items-center justify-between">
          <Text className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">
            All modules
          </Text>
          <Text className="text-[11px] font-semibold text-ink-faint">{MODULES.length} tools</Text>
        </View>

        <View className="flex-row flex-wrap justify-between gap-y-3">
          {MODULES.map((mod, i) => (
            <Animated.View
              key={mod.label}
              entering={FadeInDown.delay(i * 40).duration(340)}
              className="w-[48.8%]"
            >
              <PressableScale onPress={() => router.push(mod.href)}>
                <GlassCard className="p-3.5" style={{ minHeight: 122 }}>
                  <View
                    className="h-9 w-9 items-center justify-center rounded-xl border"
                    style={{ backgroundColor: mod.bg, borderColor: `${mod.color}18` }}
                  >
                    <mod.icon size={17} color={mod.color} />
                  </View>
                  <View className="mt-2.5 flex-1">
                    <Text
                      className="text-[14px] font-bold leading-4 text-ink"
                      numberOfLines={2}
                      style={{ flexWrap: 'wrap' }}
                    >
                      {mod.label}
                    </Text>
                    <Text
                      className="mt-1 text-[11px] leading-[13px] font-medium text-ink-muted"
                      numberOfLines={2}
                      style={{ flexWrap: 'wrap' }}
                    >
                      {mod.description}
                    </Text>
                  </View>
                </GlassCard>
              </PressableScale>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
