import React, { useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ImagePlus, Loader } from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useGenerateImage } from '@/hooks/useImage';
import { useEntitlement } from '@/hooks/useEntitlement';
import { UpgradeLock } from '@/components/plans/QuotaBanner';

const SIZE_PRESETS = [
  { label: 'Square', width: 1024, height: 1024, aspect: 1 },
  { label: 'Portrait', width: 768, height: 1344, aspect: 768 / 1344 },
  { label: 'Landscape', width: 1344, height: 768, aspect: 1344 / 768 },
];

export default function ImageStudioScreen() {
  const [prompt, setPrompt] = useState('');
  const [presetIndex, setPresetIndex] = useState(0);
  const generate = useGenerateImage();
  const image = useEntitlement('image');

  const preset = SIZE_PRESETS[presetIndex];

  const submit = () => {
    if (!prompt.trim() || generate.isPending || !image.allowed) return;
    generate.mutate({
      prompt: prompt.trim(),
      width: preset.width,
      height: preset.height,
      steps: 4,
      seed: Math.floor(Math.random() * 100000),
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title="Image Studio" subtitle="NVIDIA FLUX concept generation" />

      <ScrollView
        contentContainerClassName="gap-4 px-4 pb-12 pt-1"
        keyboardShouldPersistTaps="handled"
      >
        <UpgradeLock
          feature="image"
          title="Image Studio is a Pro feature"
          description="Upgrade to Pro or Platinum to generate images with FLUX."
        />

        <GlassCard className={`p-4 ${!image.allowed ? 'opacity-50' : ''}`}>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="A wolf in evernight, cinematic lighting…"
            placeholderTextColor="#94A3B8"
            multiline
            className="min-h-24 text-[15px] leading-5 text-ink"
          />
        </GlassCard>

        <View className="flex-row gap-2">
          {SIZE_PRESETS.map((p, i) => (
            <Pressable
              key={p.label}
              onPress={() => setPresetIndex(i)}
              className={`flex-1 items-center rounded-2xl py-2.5 ${
                presetIndex === i ? 'bg-accent' : 'border border-glass-border bg-white'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  presetIndex === i ? 'text-white' : 'text-ink-soft'
                }`}
              >
                {p.label}
              </Text>
              <Text
                className={`text-[10px] ${presetIndex === i ? 'text-white/70' : 'text-ink-faint'}`}
              >
                {p.width}×{p.height}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={submit}
          disabled={!prompt.trim() || generate.isPending}
          className={`flex-row items-center justify-center gap-2 rounded-2xl py-4 ${
            prompt.trim() && !generate.isPending ? 'bg-accent' : 'bg-accent/40'
          }`}
        >
          {generate.isPending ? (
            <Loader size={17} color="#FFFFFF" />
          ) : (
            <ImagePlus size={17} color="#FFFFFF" />
          )}
          <Text className="font-semibold text-white">
            {generate.isPending ? 'Generating…' : 'Generate'}
          </Text>
        </Pressable>

        {generate.isError ? (
          <GlassCard className="border-accent-rose/30 p-4">
            <Text className="text-sm text-accent-rose">
              {generate.error instanceof Error ? generate.error.message : 'Generation failed.'}
            </Text>
          </GlassCard>
        ) : null}

        {generate.data?.image ? (
          <Animated.View entering={FadeIn.duration(400)}>
            <GlassCard className="overflow-hidden">
              <Image
                source={{ uri: generate.data.image }}
                style={{ width: '100%', aspectRatio: preset.aspect }}
                resizeMode="cover"
              />
            </GlassCard>
          </Animated.View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
