import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Crown,
  Shield,
  Search,
  RefreshCw,
  Eye,
  EyeOff,
  KeyRound,
  Users,
  BarChart3,
  TriangleAlert,
} from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  getAdminKey,
  setAdminKey,
  useAdminStats,
  useAdminUsers,
  usePlans,
  useUpdateUserPlan,
} from '@/hooks/useAdmin';
import type { PlanTier } from '@/lib/types';

const PAGE_SIZE = 25;

const TIER_BADGE: Record<string, string> = {
  starter: 'bg-slate-100 border-slate-200',
  pro: 'bg-violet-100 border-violet-200',
  platinum: 'bg-sky-100 border-sky-200',
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <GlassCard className="flex-1 p-3 min-w-[47%]">
      <Text className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </Text>
      <Text className="mt-1 text-xl font-extrabold text-ink">{String(value)}</Text>
      {sub ? <Text className="mt-0.5 text-[11px] text-ink-muted">{sub}</Text> : null}
    </GlassCard>
  );
}

function UsageDot({ used, limit }: { used: number; limit: number }) {
  if (limit <= 0) return <Text className="text-xs text-ink-faint">blocked</Text>;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const color = pct >= 100 ? '#F43F5E' : pct >= 80 ? '#F59E0B' : '#6366F1';
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <View
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </View>
      <Text className="text-[11px] font-bold text-ink">
        {used}/{limit}
      </Text>
    </View>
  );
}

export default function AdminScreen() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const isJwtAdmin = Boolean(currentUser?.is_admin);
  const [adminKeyInput, setAdminKeyInput] = useState(getAdminKey());
  const [showKey, setShowKey] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const hasKey = Boolean(getAdminKey());
  const hasAccess = hasKey || isJwtAdmin;

  const stats = useAdminStats(hasAccess);
  const usersQ = useAdminUsers({ search, limit: PAGE_SIZE, offset }, hasAccess);
  const plansQ = usePlans();
  const mutate = useUpdateUserPlan();

  const total = usersQ.data?.total ?? 0;
  const users = usersQ.data?.users ?? [];
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const tierCounts = stats.data?.byTier as Record<string, number> | undefined;
  const todayUsage = stats.data?.todayUsage;

  const handleSaveKey = () => {
    const v = adminKeyInput.trim();
    if (!v) {
      Alert.alert('Enter admin key');
      return;
    }
    setAdminKey(v);
    // force re-query via offset reset — hook key includes getAdminKey()
    setOffset(0);
    void stats.refetch();
    void usersQ.refetch();
  };

  const handleClearKey = () => {
    setAdminKey('');
    setAdminKeyInput('');
  };

  const doSearch = () => {
    setSearch(searchInput.trim());
    setOffset(0);
  };

  const doPlanChange = async (userId: string, plan_tier: PlanTier) => {
    setEditingId(userId);
    try {
      await mutate.mutateAsync({ userId, plan_tier });
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Failed';
      Alert.alert('Error', msg);
    } finally {
      setEditingId(null);
    }
  };

  const plans = useMemo(() => plansQ.data?.plans ?? [], [plansQ.data]);

  return (
    <SafeAreaView className="flex-1 bg-canvas-soft" edges={['top']}>
      <ScreenHeader title="Admin" subtitle="Plan management (JWT or X-Admin-Key)" />
      <ScrollView
        contentContainerClassName="gap-4 px-4 pb-12 pt-2"
        showsVerticalScrollIndicator={false}
      >
        {/* Access gate */}
        <GlassCard variant="elevated" className="p-4">
          <View className="flex-row items-center gap-2">
            <View className="h-8 w-8 items-center justify-center rounded-xl bg-accent-soft border border-accent/10">
              <KeyRound size={16} color="#6366F1" />
            </View>
            <Text className="text-sm font-bold text-ink">Admin access</Text>
          </View>
          {isJwtAdmin ? (
            <View className="mt-3 flex-row gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <Shield size={14} color="#059669" />
              <Text className="flex-1 text-xs leading-4 text-emerald-800">
                Signed in as <Text className="font-bold">{currentUser?.email}</Text> — JWT admin
                enabled. No key needed, but you can still use one for curl.
              </Text>
            </View>
          ) : null}
          <View className="mt-3 flex-row items-center gap-2 rounded-xl border border-glass-border bg-white px-3 py-2">
            <TextInput
              value={adminKeyInput}
              onChangeText={setAdminKeyInput}
              placeholder="Paste ADMIN_API_KEY…"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showKey}
              className="flex-1 text-sm text-ink"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              onPress={() => setShowKey(!showKey)}
              className="h-8 w-8 items-center justify-center rounded-full bg-slate-50"
            >
              {showKey ? <EyeOff size={16} color="#64748B" /> : <Eye size={16} color="#64748B" />}
            </Pressable>
          </View>
          <View className="mt-3 flex-row gap-2">
            <Pressable
              onPress={handleSaveKey}
              className="flex-1 items-center justify-center rounded-full bg-ink py-3"
            >
              <Text className="text-sm font-bold text-white">Save key</Text>
            </Pressable>
            <Pressable
              onPress={handleClearKey}
              className="rounded-full border border-glass-border bg-white px-5 py-3"
            >
              <Text className="text-sm font-bold text-ink">Clear</Text>
            </Pressable>
          </View>
          {!hasAccess ? (
            <View className="mt-3 flex-row gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <TriangleAlert size={14} color="#B45309" />
              <Text className="flex-1 text-xs leading-4 text-amber-800">
                Sign in as vodbo2001@gmail.com (is_admin) or save ADMIN_API_KEY.
              </Text>
            </View>
          ) : stats.isError ? (
            <View className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
              <Text className="text-xs text-rose-700">
                {String(
                  (stats.error as any)?.response?.data?.error ||
                    (stats.error as any)?.message ||
                    'Failed to load admin data'
                )}
              </Text>
            </View>
          ) : null}
        </GlassCard>

        {/* Stats */}
        <View className="flex-row flex-wrap gap-3">
          <StatCard
            label="Total users"
            value={stats.isLoading ? '…' : (stats.data?.totalUsers ?? '—')}
            sub={hasAccess ? stats.data?.date : 'no access'}
          />
          <StatCard
            label="Starter"
            value={tierCounts?.starter ?? '—'}
            sub={`${tierCounts?.pro ?? 0} Pro · ${tierCounts?.platinum ?? 0} Plat`}
          />
          <StatCard
            label="AI today"
            value={todayUsage ? String(todayUsage.ai_chat_total) : '—'}
            sub={
              todayUsage
                ? `V ${todayUsage.voice_total} · I ${todayUsage.image_total}`
                : 'UTC counters'
            }
          />
          <StatCard label="Plans" value={plans.length || 3} sub="Starter · Pro · Platinum" />
        </View>

        {/* Catalog */}
        {plans.length > 0 ? (
          <View className="gap-3">
            {plans.map((p) => (
              <GlassCard key={p.tier} className="p-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-extrabold text-ink">{p.label}</Text>
                  <View className={`rounded-full border px-2.5 py-1 ${TIER_BADGE[p.tier] ?? ''}`}>
                    <Text className="text-[10px] font-bold text-ink">{p.tier}</Text>
                  </View>
                </View>
                <View className="mt-2 gap-1">
                  <Text className="text-xs text-ink-muted">
                    AI {p.limits.ai_chat_daily}/day · Voice {p.limits.voice_daily || '—'} · Image{' '}
                    {p.limits.image_daily || '—'}
                  </Text>
                  <Text className="text-xs text-ink-muted">
                    Gmail {p.limits.gmail_accounts} · {p.limits.agent_rate_limit_per_min}/min ·{' '}
                    {p.limits.premium_agents ? 'premium yes' : 'premium no'}
                  </Text>
                </View>
              </GlassCard>
            ))}
          </View>
        ) : null}

        {/* Users */}
        <GlassCard className="overflow-hidden">
          <View className="flex-row items-center justify-between border-b border-glass-border p-4">
            <View className="flex-row items-center gap-2">
              <Users size={16} color="#0F172A" />
              <Text className="text-sm font-bold text-ink">Users</Text>
            </View>
            <Pressable
              onPress={() => void usersQ.refetch()}
              className="h-8 w-8 items-center justify-center rounded-full bg-slate-50"
            >
              <RefreshCw size={14} color="#0F172A" />
            </Pressable>
          </View>

          <View className="flex-row gap-2 p-3">
            <View className="flex-1 flex-row items-center gap-2 rounded-full border border-glass-border bg-white px-3 py-2">
              <Search size={14} color="#94A3B8" />
              <TextInput
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder="Search email/name…"
                placeholderTextColor="#94A3B8"
                className="flex-1 text-sm text-ink"
                autoCapitalize="none"
              />
            </View>
            <Pressable onPress={doSearch} className="rounded-full bg-ink px-4 py-2.5">
              <Text className="text-xs font-bold text-white">Go</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setSearch('');
                setSearchInput('');
                setOffset(0);
              }}
              className="rounded-full border border-glass-border bg-white px-4 py-2.5"
            >
              <Text className="text-xs font-bold text-ink">Clr</Text>
            </Pressable>
          </View>

          {!hasAccess ? (
            <View className="p-8">
              <Text className="text-center text-sm text-ink-muted">
                Save key or sign in as admin to list users.
              </Text>
            </View>
          ) : usersQ.isLoading ? (
            <View className="p-8 items-center">
              <ActivityIndicator color="#6366F1" />
              <Text className="mt-2 text-sm text-ink-muted">Loading users…</Text>
            </View>
          ) : usersQ.isError ? (
            <View className="p-4">
              <Text className="text-sm text-accent-rose">
                {String(
                  (usersQ.error as any)?.response?.data?.error || (usersQ.error as any)?.message
                )}
              </Text>
            </View>
          ) : users.length === 0 ? (
            <View className="p-8">
              <Text className="text-center text-sm text-ink-muted">
                No users{search ? ` for "${search}"` : ''}.
              </Text>
            </View>
          ) : (
            <>
              {users.map((u) => (
                <View key={u.id} className="border-t border-glass-border p-4">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-2">
                      <View className="flex-row items-center gap-1.5">
                        <Text className="flex-1 text-sm font-bold text-ink" numberOfLines={1}>
                          {u.email}
                        </Text>
                        {u.is_admin ? (
                          <View className="rounded-full bg-ink px-2 py-0.5">
                            <Text className="text-[9px] font-bold text-white">ADMIN</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text className="text-xs text-ink-muted" numberOfLines={1}>
                        {u.display_name ?? '—'} · {u.id.slice(0, 8)}…
                      </Text>
                      <View
                        className={`mt-1 self-start rounded-full border px-2 py-0.5 ${TIER_BADGE[u.plan_tier] ?? ''}`}
                      >
                        <Text className="text-[10px] font-bold text-ink">{u.plan_tier}</Text>
                      </View>
                    </View>
                  </View>
                  <View className="mt-3 gap-2 rounded-xl border border-glass-border bg-slate-50 p-3">
                    <View className="flex-row items-center gap-2">
                      <Text className="w-10 text-[11px] font-bold text-ink-muted">AI</Text>
                      <View className="flex-1">
                        <UsageDot used={u.usage.ai_chat.used} limit={u.usage.ai_chat.limit} />
                      </View>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Text className="w-10 text-[11px] font-bold text-ink-muted">Voice</Text>
                      <View className="flex-1">
                        <UsageDot used={u.usage.voice.used} limit={u.usage.voice.limit} />
                      </View>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Text className="w-10 text-[11px] font-bold text-ink-muted">Image</Text>
                      <View className="flex-1">
                        <UsageDot used={u.usage.image.used} limit={u.usage.image.limit} />
                      </View>
                    </View>
                  </View>
                  <View className="mt-3 flex-row gap-1.5">
                    {(['starter', 'pro', 'platinum'] as PlanTier[]).map((tier) => {
                      const active = u.plan_tier === tier;
                      const busy = editingId === u.id;
                      return (
                        <Pressable
                          key={tier}
                          disabled={busy || active}
                          onPress={() => void doPlanChange(u.id, tier)}
                          className={`flex-1 items-center justify-center rounded-full border py-2.5 ${active ? 'bg-ink border-ink' : 'bg-white border-glass-border'}`}
                        >
                          <Text
                            className={`text-xs font-bold ${active ? 'text-white' : 'text-ink'}`}
                          >
                            {busy ? '…' : tier}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
              <View className="flex-row items-center justify-between border-t border-glass-border p-3">
                <Text className="text-xs text-ink-muted">
                  {total} users · p{page}/{pageCount}
                </Text>
                <View className="flex-row gap-2">
                  <Pressable
                    disabled={offset === 0}
                    onPress={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                    className={`rounded-full border px-4 py-2 ${offset === 0 ? 'border-slate-100' : 'border-glass-border bg-white'}`}
                  >
                    <Text className="text-xs font-bold text-ink">Prev</Text>
                  </Pressable>
                  <Pressable
                    disabled={offset + PAGE_SIZE >= total}
                    onPress={() => setOffset(offset + PAGE_SIZE)}
                    className={`rounded-full border px-4 py-2 ${offset + PAGE_SIZE >= total ? 'border-slate-100' : 'border-glass-border bg-white'}`}
                  >
                    <Text className="text-xs font-bold text-ink">Next</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </GlassCard>

        <GlassCard className="p-4">
          <View className="flex-row gap-2">
            <BarChart3 size={14} color="#64748B" />
            <Text className="flex-1 text-xs leading-4 text-ink-muted">
              Use curl with <Text className="font-bold">X-Admin-Key</Text> or just sign in as admin
              — same JWT auth. Backend is source of truth, mobile only gates UX.
            </Text>
          </View>
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}
