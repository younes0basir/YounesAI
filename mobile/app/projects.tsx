import React, { useRef, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { FolderKanban, Plus } from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useProjects, useCreateProject } from '@/hooks/useProjects';

const STATUS_COLORS: Record<string, string> = {
  active: '#10B981',
  planning: '#F59E0B',
  paused: '#94A3B8',
  completed: '#6366F1',
};

export default function ProjectsScreen() {
  const router = useRouter();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const projects = useProjects();
  const createProject = useCreateProject();

  const submit = () => {
    if (!name.trim()) return;
    createProject.mutate({
      name: name.trim(),
      description: description.trim() || null,
      status: 'active',
    });
    setName('');
    setDescription('');
    sheetRef.current?.dismiss();
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader
        title="Projects"
        subtitle="Workspaces & goals"
        right={
          <Pressable
            onPress={() => sheetRef.current?.present()}
            className="h-10 w-10 items-center justify-center rounded-full bg-accent"
            accessibilityLabel="New project"
          >
            <Plus size={20} color="#FFFFFF" />
          </Pressable>
        }
      />

      <FlatList
        data={projects.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-3 px-4 pb-12 pt-1"
        refreshing={projects.isRefetching}
        onRefresh={() => void projects.refetch()}
        ListEmptyComponent={
          <View className="items-center pt-16">
            <Text className="text-ink-soft">
              {projects.isLoading ? 'Loading projects…' : 'No projects yet.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/project/${item.id}` as Href)}>
            <GlassCard className="flex-row items-center gap-3 p-4">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#EDE9FE]">
                <FolderKanban size={18} color="#8B5CF6" />
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-semibold text-ink" numberOfLines={1}>
                  {item.name}
                </Text>
                {item.description ? (
                  <Text className="mt-0.5 text-xs text-ink-soft" numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
              {item.status ? (
                <View
                  className="rounded-full px-2.5 py-1"
                  style={{
                    backgroundColor: `${STATUS_COLORS[item.status] ?? '#94A3B8'}1A`,
                  }}
                >
                  <Text
                    className="text-[10px] font-bold uppercase tracking-wide"
                    style={{ color: STATUS_COLORS[item.status] ?? '#94A3B8' }}
                  >
                    {item.status}
                  </Text>
                </View>
              ) : null}
            </GlassCard>
          </Pressable>
        )}
      />

      <BottomSheet ref={sheetRef} snapPoints={['42%']}>
        <Text className="text-lg font-bold text-ink">New project</Text>
        <View className="mt-4 gap-3">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Project name"
            placeholderTextColor="#94A3B8"
            className="rounded-2xl border border-glass-border bg-canvas px-4 py-3 text-ink"
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Description (optional)"
            placeholderTextColor="#94A3B8"
            multiline
            className="min-h-20 rounded-2xl border border-glass-border bg-canvas px-4 py-3 text-ink"
          />
        </View>
        <Pressable
          onPress={submit}
          disabled={!name.trim() || createProject.isPending}
          className={`mt-4 items-center rounded-2xl py-3.5 ${
            name.trim() ? 'bg-accent' : 'bg-accent/40'
          }`}
        >
          <Text className="font-semibold text-white">Create project</Text>
        </Pressable>
      </BottomSheet>
    </SafeAreaView>
  );
}
