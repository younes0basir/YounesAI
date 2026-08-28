import React, { useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Archive, Check, Sparkles, Star, Trash2, X } from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import {
  EMAIL_CATEGORIES,
  useEmails,
  useEmailDetail,
  useEmailAction,
  usePendingApprovals,
  useResolveApproval,
} from '@/hooks/useEmail';
import type { Email } from '@/lib/types';

const CATEGORY_COLORS: Record<string, string> = {
  IMPORTANT: '#F43F5E',
  ACTION_REQUIRED: '#F59E0B',
  PERSONAL: '#3B82F6',
  NEWSLETTER: '#8B5CF6',
  PROMOTION: '#F97316',
  SPAM: '#64748B',
};

export default function InboxScreen() {
  const [category, setCategory] = useState<string>('AI_INBOX');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sheetRef = useRef<BottomSheetModal>(null);

  const emails = useEmails(category);
  const detail = useEmailDetail(selectedId);
  const emailAction = useEmailAction();
  const approvals = usePendingApprovals();
  const resolveApproval = useResolveApproval();

  const openEmail = (id: string) => {
    setSelectedId(id);
    sheetRef.current?.present();
  };

  const runAction = (
    emailId: string,
    action: 'archive' | 'delete' | 'mark_important' | 'summarize' | 'create_task'
  ) => {
    emailAction.mutate({ emailId, action });
    if (action !== 'summarize') sheetRef.current?.dismiss();
  };

  const renderEmail = ({ item }: { item: Email }) => (
    <Pressable onPress={() => openEmail(item.id)}>
      <GlassCard className="p-4">
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 text-[13px] font-medium text-ink-soft" numberOfLines={1}>
            {item.from_name || item.from_address || 'Unknown sender'}
          </Text>
          {item.category ? (
            <View
              className="ml-2 rounded-full px-2 py-0.5"
              style={{ backgroundColor: `${CATEGORY_COLORS[item.category] ?? '#94A3B8'}1A` }}
            >
              <Text
                className="text-[9px] font-bold uppercase tracking-wide"
                style={{ color: CATEGORY_COLORS[item.category] ?? '#94A3B8' }}
              >
                {item.category.replace('_', ' ')}
              </Text>
            </View>
          ) : null}
        </View>
        <Text className="mt-1 text-[15px] font-semibold text-ink" numberOfLines={1}>
          {item.subject || '(no subject)'}
        </Text>
        {item.snippet ? (
          <Text className="mt-0.5 text-[13px] text-ink-soft" numberOfLines={2}>
            {item.snippet}
          </Text>
        ) : null}
      </GlassCard>
    </Pressable>
  );

  const pendingApprovals = approvals.data ?? [];

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="px-4 pb-2 pt-4">
        <Text className="text-[28px] font-bold text-ink">Inbox</Text>
        <Text className="text-sm text-ink-soft">AI-triaged email</Text>
      </View>

      <View className="pb-2">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-4"
        >
          {EMAIL_CATEGORIES.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setCategory(c.id)}
              className={`rounded-full px-3.5 py-1.5 ${
                category === c.id ? 'bg-accent' : 'border border-glass-border bg-white'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  category === c.id ? 'text-white' : 'text-ink-soft'
                }`}
              >
                {c.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={emails.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderEmail}
        contentContainerClassName="gap-3 px-4 pb-40 pt-1"
        refreshing={emails.isRefetching}
        onRefresh={() => void emails.refetch()}
        ListHeaderComponent={
          pendingApprovals.length > 0 ? (
            <View className="mb-1 gap-2">
              <Text className="text-xs font-bold uppercase tracking-widest text-ink-faint">
                Needs approval
              </Text>
              {pendingApprovals.map((approval) => (
                <GlassCard key={approval.id} className="p-4">
                  <View className="flex-row items-center gap-2">
                    <Sparkles size={14} color="#F59E0B" />
                    <Text className="flex-1 text-sm font-semibold text-ink" numberOfLines={2}>
                      AI wants to run “{approval.action}” on {approval.email_ids?.length ?? 0} email
                      {(approval.email_ids?.length ?? 0) === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <View className="mt-3 flex-row gap-2">
                    <Pressable
                      onPress={() => resolveApproval.mutate({ id: approval.id, approve: true })}
                      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-accent-mint py-2"
                    >
                      <Check size={14} color="#FFFFFF" />
                      <Text className="text-xs font-bold text-white">Approve</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => resolveApproval.mutate({ id: approval.id, approve: false })}
                      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-slate-200 py-2"
                    >
                      <X size={14} color="#475569" />
                      <Text className="text-xs font-bold text-ink-soft">Reject</Text>
                    </Pressable>
                  </View>
                </GlassCard>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View className="items-center pt-16">
            <Text className="text-ink-soft">
              {emails.isLoading ? 'Loading inbox…' : 'No emails in this view.'}
            </Text>
          </View>
        }
      />

      <BottomSheet ref={sheetRef} snapPoints={['55%']} onDismiss={() => setSelectedId(null)}>
        {detail.data ? (
          <>
            <Text className="text-lg font-bold text-ink" numberOfLines={2}>
              {detail.data.subject || '(no subject)'}
            </Text>
            <Text className="mt-1 text-xs text-ink-soft">
              {detail.data.from_name || detail.data.from_address}
              {detail.data.received_at
                ? ` • ${new Date(detail.data.received_at).toLocaleString()}`
                : ''}
            </Text>
            <Text className="mt-3 text-sm leading-5 text-ink-soft" numberOfLines={8}>
              {detail.data.snippet || detail.data.body || 'No preview available.'}
            </Text>
            <View className="mt-5 flex-row gap-2">
              <Pressable
                onPress={() => runAction(detail.data!.id, 'summarize')}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5"
              >
                <Sparkles size={14} color="#FFFFFF" />
                <Text className="text-xs font-bold text-white">Summarize</Text>
              </Pressable>
              <Pressable
                onPress={() => runAction(detail.data!.id, 'mark_important')}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-accent-amber py-2.5"
              >
                <Star size={14} color="#FFFFFF" />
                <Text className="text-xs font-bold text-white">Important</Text>
              </Pressable>
            </View>
            <View className="mt-2 flex-row gap-2">
              <Pressable
                onPress={() => runAction(detail.data!.id, 'archive')}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-slate-200 py-2.5"
              >
                <Archive size={14} color="#475569" />
                <Text className="text-xs font-bold text-ink-soft">Archive</Text>
              </Pressable>
              <Pressable
                onPress={() => runAction(detail.data!.id, 'delete')}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-accent-rose/10 py-2.5"
              >
                <Trash2 size={14} color="#F43F5E" />
                <Text className="text-xs font-bold text-accent-rose">Delete</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text className="text-ink-soft">Loading…</Text>
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}
