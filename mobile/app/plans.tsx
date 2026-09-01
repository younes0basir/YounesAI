import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Check, Sparkles } from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAuthStore } from '@/stores/useAuthStore';
import { FEATURE_LABELS, PLAN_COMPARISON, PLAN_LABELS, PLAN_ORDER, formatUsage } from '@/lib/plans';
import type { EntitlementFeature, PlanTier } from '@/lib/types';

const TIER_ACCENTS: Record<PlanTier, string> = {
  starter: '#64748B',
  pro: '#6366F1',
  platinum: '#0EA5E9',
};

function UsageMeter({ feature }: { feature: EntitlementFeature }) {
  const user = useAuthStore((s) => s.user);
  const usage = user?.usage?.[feature];
  if (!usage || usage.limit <= 0) return null;

  const pct = Math.min(100, Math.round((usage.used / usage.limit) * 100));

  return (
    <View className="mt-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-medium text-ink-muted">{FEATURE_LABELS[feature]}</Text>
        <Text className="text-xs font-bold text-ink">{formatUsage(usage.used, usage.limit)}</Text>
      </View>
      <View className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
        <View className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </View>
    </View>
  );
}

export default function PlansScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const currentTier = user?.plan_tier ?? 'starter';

  return (
    <SafeAreaView className="flex-1 bg-canvas-soft" edges={['top']}>
      <ScreenHeader title="Plans" subtitle="Starter · Pro · Platinum" />
      <ScrollView contentContainerClassName="gap-4 px-4 pb-12 pt-2">
        <GlassCard variant="elevated" className="p-4">
          <View className="flex-row items-center gap-2">
            <Sparkles size={18} color="#6366F1" />
            <Text className="text-sm font-bold text-ink">Your plan</Text>
          </View>
          <Text className="mt-2 text-2xl font-extrabold text-ink">{PLAN_LABELS[currentTier]}</Text>
          <Text className="mt-1 text-xs text-ink-muted">Daily usage resets at midnight UTC.</Text>
          <UsageMeter feature="ai_chat" />
          <UsageMeter feature="voice" />
          <UsageMeter feature="image" />
        </GlassCard>

        {PLAN_ORDER.map((tier) => {
          const isCurrent = tier === currentTier;
          return (
            <GlassCard
              key={tier}
              className="p-4"
              style={isCurrent ? { borderColor: TIER_ACCENTS[tier], borderWidth: 2 } : undefined}
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-extrabold text-ink">{PLAN_LABELS[tier]}</Text>
                {isCurrent ? (
                  <View className="rounded-full bg-emerald-50 px-2.5 py-1 border border-emerald-200">
                    <Text className="text-[10px] font-bold text-emerald-700">Current</Text>
                  </View>
                ) : null}
              </View>
              <Text className="mt-1 text-xs text-ink-muted">
                {tier === 'starter'
                  ? 'Free — core productivity with limited AI'
                  : tier === 'pro'
                    ? 'More AI, voice, and image generation'
                    : 'Highest limits and premium access'}
              </Text>
              {tier !== 'starter' && !isCurrent ? (
                <Pressable
                  onPress={() => router.back()}
                  className="mt-3 self-start rounded-full px-4 py-2"
                  style={{ backgroundColor: TIER_ACCENTS[tier] }}
                >
                  <Text className="text-xs font-bold text-white">Upgrade coming soon</Text>
                </Pressable>
              ) : null}
            </GlassCard>
          );
        })}

        <GlassCard className="p-4">
          <Text className="text-sm font-bold text-ink">Compare features</Text>
          {PLAN_COMPARISON.map((row) => (
            <View
              key={row.label}
              className="mt-3 border-b border-glass-border pb-3 last:border-b-0 last:pb-0"
            >
              <Text className="text-xs font-semibold text-ink-muted">{row.label}</Text>
              <View className="mt-1 flex-row justify-between">
                {PLAN_ORDER.map((tier) => (
                  <View key={tier} className="items-center flex-1">
                    <Text className="text-[10px] font-bold uppercase text-ink-faint">
                      {PLAN_LABELS[tier]}
                    </Text>
                    <Text className="mt-0.5 text-xs font-semibold text-ink">
                      {row[tier as keyof typeof row]}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </GlassCard>

        <GlassCard className="p-4">
          <View className="flex-row items-start gap-2">
            <Check size={16} color="#10B981" />
            <Text className="flex-1 text-xs leading-5 text-ink-muted">
              In-app purchases are not enabled yet. Contact your administrator to change your plan,
              or check back soon for self-serve upgrades.
            </Text>
          </View>
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}
