import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useProject, useUpdateProject, useDeleteProject } from '@/hooks/useProjects';

const STATUSES = ['planning', 'active', 'paused', 'completed'] as const;

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const project = useProject(id ?? null);
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [notes, setNotes] = useState<string | null>(null);

  const confirmDelete = () => {
    Alert.alert('Delete project', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteProject.mutate(id!, { onSuccess: () => router.back() });
        },
      },
    ]);
  };

  if (project.isLoading || !project.data) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        <ScreenHeader title="Project" />
        <Text className="px-4 pt-8 text-center text-ink-soft">Loading…</Text>
      </SafeAreaView>
    );
  }

  const data = project.data;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader
        title={data.name}
        right={
          <Pressable
            onPress={confirmDelete}
            className="h-10 w-10 items-center justify-center rounded-full bg-accent-rose/10"
            accessibilityLabel="Delete project"
          >
            <Trash2 size={17} color="#F43F5E" />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerClassName="gap-3 px-4 pb-12 pt-1"
        keyboardShouldPersistTaps="handled"
      >
        <GlassCard className="p-4">
          <Text className="text-xs font-bold uppercase tracking-widest text-ink-faint">Status</Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {STATUSES.map((status) => (
              <Pressable
                key={status}
                onPress={() => updateProject.mutate({ id: data.id, status })}
                className={`rounded-full px-4 py-1.5 ${
                  data.status === status ? 'bg-accent' : 'border border-glass-border bg-white'
                }`}
              >
                <Text
                  className={`text-xs font-semibold capitalize ${
                    data.status === status ? 'text-white' : 'text-ink-soft'
                  }`}
                >
                  {status}
                </Text>
              </Pressable>
            ))}
          </View>
        </GlassCard>

        <GlassCard className="p-4">
          <Text className="text-xs font-bold uppercase tracking-widest text-ink-faint">
            Description
          </Text>
          <TextInput
            value={notes ?? data.description ?? ''}
            onChangeText={setNotes}
            onBlur={() => {
              if (notes !== null && notes !== data.description) {
                updateProject.mutate({ id: data.id, description: notes });
              }
            }}
            placeholder="Add a description…"
            placeholderTextColor="#94A3B8"
            multiline
            className="mt-2 min-h-24 text-[15px] leading-5 text-ink"
          />
        </GlassCard>

        <GlassCard className="p-4">
          <Text className="text-xs font-bold uppercase tracking-widest text-ink-faint">Meta</Text>
          <Text className="mt-2 text-xs text-ink-soft">
            Created {data.created_at ? new Date(data.created_at).toLocaleDateString() : '—'}
          </Text>
          <Text className="mt-1 text-xs text-ink-soft">
            Updated {data.updated_at ? new Date(data.updated_at).toLocaleDateString() : '—'}
          </Text>
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}
