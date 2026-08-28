import React, { useRef, useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import * as Location from 'expo-location';
import { Crosshair, MapPin, Plus, Radar, Trash2 } from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { usePlaces, useCreatePlace, useDeletePlace } from '@/hooks/usePlaces';
import { syncGeofences } from '@/services/geofence';

export default function PlacesScreen() {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [name, setName] = useState('');
  const [radius, setRadius] = useState('150');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [geofenceCount, setGeofenceCount] = useState<number | null>(null);

  const places = usePlaces();
  const createPlace = useCreatePlace();
  const deletePlace = useDeletePlace();

  const captureLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Location permission is required to pin a place.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } finally {
      setLocating(false);
    }
  };

  const submit = () => {
    if (!name.trim() || !coords) return;
    createPlace.mutate({
      name: name.trim(),
      latitude: coords.latitude,
      longitude: coords.longitude,
      radius_m: parseInt(radius, 10) || 150,
    });
    setName('');
    setRadius('150');
    setCoords(null);
    sheetRef.current?.dismiss();
  };

  const enableGeofences = async () => {
    setGeofenceCount(await syncGeofences());
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader
        title="Places"
        subtitle="Location-aware context"
        right={
          <Pressable
            onPress={() => sheetRef.current?.present()}
            className="h-10 w-10 items-center justify-center rounded-full bg-accent"
            accessibilityLabel="New place"
          >
            <Plus size={20} color="#FFFFFF" />
          </Pressable>
        }
      />

      <View className="px-4 pb-3">
        <Pressable onPress={enableGeofences}>
          <GlassCard className="flex-row items-center gap-3 p-4">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent-mint/15">
              <Radar size={18} color="#10B981" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-ink">Geofence sync</Text>
              <Text className="text-xs text-ink-soft">
                {geofenceCount === null
                  ? 'Tap to arm geofences for saved places'
                  : `${geofenceCount} geofence${geofenceCount === 1 ? '' : 's'} armed`}
              </Text>
            </View>
          </GlassCard>
        </Pressable>
      </View>

      <FlatList
        data={places.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-3 px-4 pb-12"
        refreshing={places.isRefetching}
        onRefresh={() => void places.refetch()}
        ListEmptyComponent={
          <View className="items-center pt-16">
            <Text className="text-ink-soft">
              {places.isLoading ? 'Loading places…' : 'No saved places yet.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <GlassCard className="flex-row items-center gap-3 p-4">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent-mint/15">
              <MapPin size={18} color="#10B981" />
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-semibold text-ink">{item.name}</Text>
              <Text className="text-xs text-ink-soft">
                {Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}
                {item.radius_m ? ` • ${item.radius_m}m` : ''}
              </Text>
            </View>
            <Pressable
              onPress={() => deletePlace.mutate(item.id)}
              className="h-9 w-9 items-center justify-center rounded-full bg-accent-rose/10"
              accessibilityLabel="Delete place"
            >
              <Trash2 size={15} color="#F43F5E" />
            </Pressable>
          </GlassCard>
        )}
      />

      <BottomSheet ref={sheetRef} snapPoints={['48%']}>
        <Text className="text-lg font-bold text-ink">New place</Text>
        <View className="mt-4 gap-3">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Name (e.g. Office, Gym)"
            placeholderTextColor="#94A3B8"
            className="rounded-2xl border border-glass-border bg-canvas px-4 py-3 text-ink"
          />
          <TextInput
            value={radius}
            onChangeText={setRadius}
            placeholder="Radius in meters"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            className="rounded-2xl border border-glass-border bg-canvas px-4 py-3 text-ink"
          />
          <Pressable
            onPress={captureLocation}
            className="flex-row items-center justify-center gap-2 rounded-2xl border border-accent/30 bg-accent-soft py-3"
          >
            <Crosshair size={16} color="#6366F1" />
            <Text className="text-sm font-semibold text-accent">
              {locating
                ? 'Locating…'
                : coords
                  ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
                  : 'Use current location'}
            </Text>
          </Pressable>
        </View>
        <Pressable
          onPress={submit}
          disabled={!name.trim() || !coords || createPlace.isPending}
          className={`mt-4 items-center rounded-2xl py-3.5 ${
            name.trim() && coords ? 'bg-accent' : 'bg-accent/40'
          }`}
        >
          <Text className="font-semibold text-white">Save place</Text>
        </Pressable>
      </BottomSheet>
    </SafeAreaView>
  );
}
