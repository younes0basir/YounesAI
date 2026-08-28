import React, { useState } from 'react';
import { FlatList, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText, Search } from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useSearch } from '@/hooks/useSearch';

export default function FilesScreen() {
  const [query, setQuery] = useState('');
  const search = useSearch(query);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title="Documents" subtitle="Semantic search across indexed files" />

      <View className="mx-4 flex-row items-center gap-2 rounded-2xl border border-glass-border bg-white px-4 py-3">
        <Search size={18} color="#94A3B8" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search documents, notes, memories…"
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          className="flex-1 text-ink"
        />
      </View>

      <FlatList
        data={search.data ?? []}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        contentContainerClassName="gap-3 px-4 pb-12 pt-4"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View className="items-center pt-16">
            <Text className="text-center text-ink-soft">
              {query.trim().length < 2
                ? 'Type at least 2 characters to search your knowledge base.'
                : search.isLoading
                  ? 'Searching…'
                  : 'No matches found.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <GlassCard className="p-4">
            <View className="flex-row items-start gap-3">
              <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-xl bg-accent-soft">
                <FileText size={17} color="#6366F1" />
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-semibold text-ink" numberOfLines={1}>
                  {item.title}
                </Text>
                {item.snippet ? (
                  <Text className="mt-1 text-[13px] leading-[18px] text-ink-soft" numberOfLines={3}>
                    {item.snippet}
                  </Text>
                ) : null}
                <Text className="mt-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-faint">
                  {item.type}
                </Text>
              </View>
            </View>
          </GlassCard>
        )}
      />
    </SafeAreaView>
  );
}
