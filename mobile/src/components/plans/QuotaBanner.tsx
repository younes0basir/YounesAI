import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { useEntitlement } from '@/hooks/useEntitlement';
import { FEATURE_LABELS, formatUsage } from '@/lib/plans';
import type { EntitlementFeature } from '@/lib/types';

interface QuotaBannerProps {
  feature: EntitlementFeature;
  compact?: boolean;
}

export function QuotaBanner({ feature, compact = false }: QuotaBannerProps) {
  const router = useRouter();
  const { tier, used, limit, allowed, showUpgrade, requiresPro } = useEntitlement(feature);

  if (allowed && !compact) {
    return (
      <View className="mb-2 rounded-2xl border border-glass-border bg-white/90 px-3 py-2">
        <Text className="text-[11px] font-semibold text-ink-muted">
          {FEATURE_LABELS[feature]}: {formatUsage(used, limit)}
        </Text>
      </View>
    );
  }

  if (allowed) return null;

  return (
    <View className="mb-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
      <View className="flex-row items-center gap-2">
        <Sparkles size={14} color="#B45309" />
        <Text className="flex-1 text-xs font-bold text-amber-800">
          {requiresPro && limit <= 0
            ? `${FEATURE_LABELS[feature]} requires Pro or Platinum`
            : `${FEATURE_LABELS[feature]} limit reached (${formatUsage(used, limit)})`}
        </Text>
      </View>
      <Text className="mt-1 text-[11px] leading-4 text-amber-800/80">
        Current plan: {tier.charAt(0).toUpperCase() + tier.slice(1)}. Upgrade for more access.
      </Text>
      <Pressable
        onPress={() => router.push('/plans')}
        className="mt-2 self-start rounded-full bg-ink px-3 py-1.5"
      >
        <Text className="text-[11px] font-bold text-white">View plans</Text>
      </Pressable>
    </View>
  );
}

interface UpgradeLockProps {
  feature: EntitlementFeature;
  title: string;
  description: string;
}

export function UpgradeLock({ feature, title, description }: UpgradeLockProps) {
  const router = useRouter();
  const { allowed, tier } = useEntitlement(feature);

  if (allowed) return null;

  return (
    <View className="rounded-2xl border border-glass-border bg-white p-4">
      <Text className="text-base font-bold text-ink">{title}</Text>
      <Text className="mt-1 text-sm leading-5 text-ink-muted">{description}</Text>
      <Text className="mt-2 text-xs font-semibold text-ink-faint">
        Current plan: {tier.charAt(0).toUpperCase() + tier.slice(1)}
      </Text>
      <Pressable
        onPress={() => router.push('/plans')}
        className="mt-3 self-start rounded-full bg-accent px-4 py-2"
      >
        <Text className="text-xs font-bold text-white">Upgrade plan</Text>
      </Pressable>
    </View>
  );
}
