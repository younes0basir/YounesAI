import React, { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Mic, Move, Sparkles, Square } from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SkiaWaveform } from '@/components/ai/SkiaWaveform';
import { AgentStepTracker } from '@/components/ai/AgentStepTracker';
import { useAgentStore } from '@/stores/useAgentStore';
import {
  useAudioRecorder,
  RecordingPresets,
  ensureMicPermission,
  releaseAudioMode,
} from '@/services/voice';
import { hapticSuccess, hapticTap } from '@/lib/haptics';

export default function VoiceScreen() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const level = useSharedValue(0.1);
  const pulse = useSharedValue(1);
  const { isRecording, isProcessing, lastResponse, steps, sendVoice, setRecording } =
    useAgentStore();

  useEffect(() => {
    if (isRecording) {
      pulse.value = withRepeat(
        withSequence(withTiming(1.08, { duration: 420 }), withTiming(1, { duration: 420 })),
        -1,
        true
      );
    } else {
      pulse.value = withSpring(1, { damping: 15, stiffness: 120 });
    }
  }, [isRecording, pulse]);

  const micStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const start = async () => {
    if (!(await ensureMicPermission())) return;
    hapticTap();
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
    level.value = withSpring(0.9, { damping: 15, stiffness: 120 });
  };

  const stop = async () => {
    hapticSuccess();
    setRecording(false);
    level.value = withSpring(0.1, { damping: 15, stiffness: 120 });
    await recorder.stop();
    await releaseAudioMode();
    if (recorder.uri) await sendVoice(recorder.uri);
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title="Voice" subtitle="Hands-free orchestrator commands" />

      <ScrollView contentContainerClassName="gap-4 px-4 pb-12 pt-1">
        <GlassCard className="items-center p-6">
          <SkiaWaveform level={level} width={300} />
          <Animated.View style={micStyle} className="mt-6">
            <Pressable
              onPress={isRecording ? stop : start}
              disabled={isProcessing}
              className={`h-20 w-20 items-center justify-center rounded-full ${
                isRecording ? 'bg-accent-rose' : 'bg-accent'
              } ${isProcessing ? 'opacity-40' : ''}`}
              accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {isRecording ? (
                <Square size={26} color="#FFFFFF" fill="#FFFFFF" />
              ) : (
                <Mic size={30} color="#FFFFFF" />
              )}
            </Pressable>
          </Animated.View>
          <Text className="mt-4 text-sm text-ink-soft">
            {isRecording
              ? 'Listening… tap to stop'
              : isProcessing
                ? 'Processing your command…'
                : 'Tap the mic and speak a command'}
          </Text>
          <View className="mt-3 flex-row items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5">
            <Move size={12} color="#6366F1" />
            <Text className="text-[11px] font-semibold text-accent">
              Tip: drag the floating orb anywhere · hold for quick actions
            </Text>
          </View>
        </GlassCard>

        {steps.length > 0 ? (
          <GlassCard className="p-4">
            <Text className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-faint">
              Agent activity
            </Text>
            <AgentStepTracker steps={steps} />
          </GlassCard>
        ) : null}

        {lastResponse ? (
          <GlassCard className="p-4">
            <Text className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-faint">
              Response
            </Text>
            <Text className="text-[15px] leading-6 text-ink">{lastResponse}</Text>
          </GlassCard>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
