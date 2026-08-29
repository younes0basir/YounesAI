import React, { useRef, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Plus, Trash2 } from 'lucide-react-native';
import { BentoEventCard } from '@/components/bento/BentoEventCard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useEvents, useCreateEvent, useDeleteEvent } from '@/hooks/useEvents';

export default function EventsScreen() {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [startAt, setStartAt] = useState('');

  const events = useEvents();
  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();

  const sorted = [...(events.data ?? [])].sort((a, b) => {
    const da = a.starts_at ? new Date(a.starts_at).getTime() : Infinity;
    const db = b.starts_at ? new Date(b.starts_at).getTime() : Infinity;
    return da - db;
  });

  const submit = () => {
    if (!title.trim()) return;
    const startsAt = startAt.trim()
      ? new Date(startAt.trim()).toISOString()
      : new Date().toISOString();
    createEvent.mutate({
      title: title.trim(),
      location_text: location.trim() || null,
      starts_at: startsAt,
      ends_at: new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString(),
    });
    setTitle('');
    setLocation('');
    setStartAt('');
    sheetRef.current?.dismiss();
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader
        title="Events"
        subtitle="Your calendar, synced"
        right={
          <Pressable
            onPress={() => sheetRef.current?.present()}
            className="h-10 w-10 items-center justify-center rounded-full bg-accent"
            accessibilityLabel="New event"
          >
            <Plus size={20} color="#FFFFFF" />
          </Pressable>
        }
      />

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-3 px-4 pb-12 pt-1"
        refreshing={events.isRefetching}
        onRefresh={() => void events.refetch()}
        ListEmptyComponent={
          <View className="items-center pt-16">
            <Text className="text-ink-soft">
              {events.isLoading ? 'Loading events…' : 'No events yet.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <BentoEventCard event={item} />
            </View>
            <Pressable
              onPress={() => deleteEvent.mutate(item.id)}
              className="h-9 w-9 items-center justify-center rounded-full bg-accent-rose/10"
              accessibilityLabel="Delete event"
            >
              <Trash2 size={15} color="#F43F5E" />
            </Pressable>
          </View>
        )}
      />

      <BottomSheet ref={sheetRef} snapPoints={['48%']}>
        <Text className="text-lg font-bold text-ink">New event</Text>
        <View className="mt-4 gap-3">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor="#94A3B8"
            className="rounded-2xl border border-glass-border bg-canvas px-4 py-3 text-ink"
          />
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Location (optional)"
            placeholderTextColor="#94A3B8"
            className="rounded-2xl border border-glass-border bg-canvas px-4 py-3 text-ink"
          />
          <TextInput
            value={startAt}
            onChangeText={setStartAt}
            placeholder="Start (YYYY-MM-DD HH:mm)"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            className="rounded-2xl border border-glass-border bg-canvas px-4 py-3 text-ink"
          />
        </View>
        <Pressable
          onPress={submit}
          disabled={!title.trim() || createEvent.isPending}
          className={`mt-4 items-center rounded-2xl py-3.5 ${
            title.trim() ? 'bg-accent' : 'bg-accent/40'
          }`}
        >
          <Text className="font-semibold text-white">Create event</Text>
        </Pressable>
      </BottomSheet>
    </SafeAreaView>
  );
}
