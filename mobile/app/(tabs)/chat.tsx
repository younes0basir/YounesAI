import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  AlertTriangle,
  Expand,
  Image as ImageIcon,
  Loader,
  Mic,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react-native';
import { useConversations, useSendMessage, useSendVoice } from '@/hooks/useChat';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { TypingIndicator } from '@/components/ai/TypingIndicator';
import { AgentStepTracker } from '@/components/ai/AgentStepTracker';
import { SkiaWaveform } from '@/components/ai/SkiaWaveform';
import { PressableScale } from '@/components/ui/PressableScale';
import { hapticSuccess, hapticTap, hapticSelect, hapticWarning } from '@/lib/haptics';
import { api } from '@/services/api';

const SPRING = { damping: 18, stiffness: 220, mass: 0.6 } as const;
const SPRING_SOFT = { damping: 20, stiffness: 160, mass: 0.7 } as const;
import {
  useAudioRecorder,
  RecordingPresets,
  ensureMicPermission,
  releaseAudioMode,
} from '@/services/voice';
import { useAgentStore } from '@/stores/useAgentStore';
import type { ConversationMessage } from '@/lib/types';

function parseEntities(raw: unknown): {
  attachments?: { type: string; url: string; agent?: string; prompt?: string }[];
  steps?: { summary: string; agent: string; success: boolean }[];
} | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw as any;
  try {
    return JSON.parse(raw as string);
  } catch {
    return null;
  }
}

function MobileChatImage({
  url,
  prompt,
  truncated,
}: {
  url: string;
  prompt?: string | null;
  truncated?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(!!truncated);
  const [fullscreen, setFullscreen] = useState(false);
  const [aspect, setAspect] = useState(1);
  const [retryKey, setRetryKey] = useState(0);

  React.useEffect(() => {
    if (truncated) setError(true);
  }, [truncated]);

  React.useEffect(() => {
    if (loaded || error || truncated) return;
    const t = setTimeout(() => setError(true), 15000);
    return () => clearTimeout(t);
  }, [loaded, error, truncated, retryKey, url]);

  if (error) {
    return (
      <View className="mt-2 flex-row items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
        <AlertTriangle size={16} color="#D97706" />
        <Text className="flex-1 text-xs text-amber-800">
          {truncated ? 'Image truncated (old limit) — regenerate' : 'Image failed — tap to retry'}
        </Text>
        <Pressable
          onPress={() => {
            if (truncated) return;
            setError(false);
            setLoaded(false);
            setRetryKey((k) => k + 1);
          }}
          disabled={!!truncated}
          className={`rounded-full bg-white px-3 py-1.5 border border-amber-200 ${truncated ? 'opacity-50' : ''}`}
        >
          <Text className="text-xs font-semibold text-amber-800">Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => loaded && setFullscreen(true)}
        className="mt-2 overflow-hidden rounded-2xl border border-glass-border bg-slate-50"
        style={{ width: 260 }}
      >
        {!loaded && (
          <View className="h-56 w-full items-center justify-center bg-slate-100">
            <Loader size={18} color="#6366F1" />
            <Text className="mt-2 text-xs text-ink-faint">Loading image…</Text>
          </View>
        )}
        <Image
          key={retryKey}
          source={{ uri: url }}
          onLoad={(e) => {
            const { width, height } = e.nativeEvent.source;
            if (width && height) setAspect(width / height);
            setLoaded(true);
          }}
          onError={() => setError(true)}
          style={
            {
              width: 260,
              height: loaded ? 260 / aspect : 180,
              backgroundColor: '#FFFFFF',
              display: loaded ? 'flex' : 'none',
            } as any
          }
          resizeMode="contain"
        />
        {loaded && (
          <View className="absolute bottom-1 right-1 flex-row gap-1">
            <View className="rounded-full bg-black/60 px-2 py-1 flex-row items-center gap-1">
              <Expand size={10} color="#FFFFFF" />
              <Text className="text-[10px] font-semibold text-white">Tap to expand</Text>
            </View>
          </View>
        )}
        {prompt && loaded ? (
          <View className="px-2 py-1.5 bg-white">
            <Text className="text-[11px] leading-3 text-ink-soft" numberOfLines={2}>
              {prompt}
            </Text>
          </View>
        ) : null}
      </Pressable>

      <Modal
        visible={fullscreen}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreen(false)}
      >
        <View className="flex-1 bg-black/95">
          <SafeAreaView className="flex-1">
            <View className="flex-row justify-between items-center px-4 pt-2">
              <Text className="text-sm font-semibold text-white" numberOfLines={1}>
                {prompt || 'Generated image'}
              </Text>
              <Pressable
                onPress={() => setFullscreen(false)}
                hitSlop={10}
                className="h-9 w-9 items-center justify-center rounded-full bg-white/20"
              >
                <X size={18} color="#FFFFFF" />
              </Pressable>
            </View>
            <ScrollView
              contentContainerClassName="flex-1 items-center justify-center p-4"
              maximumZoomScale={3}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image
                source={{ uri: url }}
                style={{ width: 360, height: 360 / aspect, maxWidth: '100%' }}
                resizeMode="contain"
              />
            </ScrollView>
            <View className="flex-row justify-center gap-3 pb-6 px-4">
              <Pressable
                onPress={() => setFullscreen(false)}
                className="flex-1 max-w-[160px] items-center rounded-full bg-white py-3 flex-row justify-center gap-2"
              >
                <X size={16} color="#0F172A" />
                <Text className="font-semibold text-ink">Close</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

function MessageAttachments({ entities, content }: { entities: unknown; content?: string }) {
  const parsed = parseEntities(entities);
  const attachments = parsed?.attachments || [];
  if (!attachments.length) return null;
  const promptMatch = content ? content.match(/Image generated:\s*"([^"]+)"/i) : null;
  const prompt = promptMatch ? promptMatch[1] : null;
  return (
    <View className="gap-2">
      {attachments.map((att, i) =>
        att.type === 'image' && att.url ? (
          <MobileChatImage
            key={i}
            url={att.url}
            prompt={prompt || (att as any).prompt}
            truncated={(att as any).truncated}
          />
        ) : null
      )}
    </View>
  );
}

function MessageSteps({ entities }: { entities: unknown }) {
  const parsed = parseEntities(entities);
  const steps = parsed?.steps || [];
  if (!steps.length) return null;
  return (
    <View className="mt-2 gap-1">
      {steps.map((s: any, i: number) => (
        <Text key={i} className={`text-xs ${s.success ? 'text-emerald-600' : 'text-accent-rose'}`}>
          {s.summary}
        </Text>
      ))}
    </View>
  );
}

const agentColors: Record<string, string> = {
  task: 'bg-emerald-100 text-emerald-700',
  event: 'bg-blue-100 text-blue-700',
  place: 'bg-rose-100 text-rose-700',
  file: 'bg-slate-100 text-slate-700',
  memory: 'bg-amber-100 text-amber-700',
  project: 'bg-indigo-100 text-indigo-700',
  image: 'bg-fuchsia-100 text-fuchsia-700',
};

export default function ChatScreen() {
  const [draft, setDraft] = useState('');
  const keyboardVisible = useKeyboardVisible();
  const listRef = useRef<FlatList<ConversationMessage>>(null);
  const conversations = useConversations();
  const sendMessage = useSendMessage();
  const sendVoice = useSendVoice();
  const { isRecording, setRecording } = useAgentStore();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const level = useSharedValue(0.1);

  const messages = useMemo(() => [...(conversations.data ?? [])].reverse(), [conversations.data]);
  const pending = sendMessage.isPending || sendVoice.isPending;

  const submit = useCallback(() => {
    const message = draft.trim();
    if (!message || pending) return;
    setDraft('');
    hapticSuccess();
    sendMessage.mutate({ message });
  }, [draft, pending, sendMessage]);

  const startRec = useCallback(async () => {
    if (!(await ensureMicPermission())) return;
    hapticTap();
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
    level.value = withSpring(0.85, SPRING);
  }, [recorder, setRecording, level]);

  const stopRec = useCallback(async () => {
    hapticSuccess();
    setRecording(false);
    level.value = withSpring(0.12, SPRING_SOFT);
    await recorder.stop();
    await releaseAudioMode();
    if (recorder.uri) {
      sendVoice.mutate(recorder.uri);
    }
  }, [recorder, setRecording, level, sendVoice]);

  const clearChat = useCallback(async () => {
    try {
      hapticWarning();
      await api.delete('/api/agents/conversations');
      conversations.refetch();
      hapticTap();
    } catch {}
  }, [conversations]);

  const renderMessage = ({ item, index }: { item: ConversationMessage; index: number }) => {
    const isUser = item.role === 'user';
    const parsed = parseEntities(item.entities);
    const hasImage = parsed?.attachments?.some((a) => a.type === 'image');
    return (
      <Animated.View
        entering={FadeInDown.delay(Math.min(index * 18, 120))
          .duration(360)
          .springify()
          .damping(18)}
        layout={LinearTransition.springify().damping(18).stiffness(220)}
        className={`max-w-[85%] ${isUser ? 'self-end' : 'self-start'}`}
      >
        <View
          className={`rounded-3xl px-4 py-3 ${isUser ? 'rounded-br-md bg-accent border border-accent' : 'rounded-bl-md border border-glass-border bg-white'}`}
          style={
            isUser
              ? {
                  shadowColor: '#6366F1',
                  shadowOpacity: 0.16,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 2,
                }
              : {
                  shadowColor: '#0F172A',
                  shadowOpacity: 0.05,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 1,
                }
          }
        >
          {/* glass highlight on assistant bubbles */}
          {!isUser ? (
            <View
              pointerEvents="none"
              className="absolute inset-x-3 top-0 h-px bg-white/70 rounded-full"
            />
          ) : null}
          <Text className={`text-[15px] leading-5 ${isUser ? 'text-white' : 'text-ink'}`}>
            {item.content}
          </Text>
          {!isUser ? (
            <>
              <MessageSteps entities={item.entities} />
              <MessageAttachments entities={item.entities} content={item.content} />
            </>
          ) : null}
          {!isUser && hasImage ? (
            <View className="mt-1.5 flex-row items-center gap-1 opacity-60">
              <ImageIcon size={10} color="#6366F1" />
              <Text className="text-[10px] font-bold tracking-wide text-accent">
                Image generated
              </Text>
            </View>
          ) : null}
        </View>
        {!isUser && item.intent ? (
          <View className="mt-1 flex-row flex-wrap items-center gap-1 pl-1">
            <Sparkles size={10} color="#94A3B8" />
            {item.intent.split(',').map((a) => (
              <Text
                key={a}
                className="text-[10px] font-medium uppercase tracking-wide text-ink-faint"
              >
                {a.trim()}
              </Text>
            ))}
          </View>
        ) : null}
      </Animated.View>
    );
  };

  // pending live steps (from last orchestrator) — show when waiting for assistant
  const pendingSteps = useAgentStore((s) => s.steps);
  const isProcessing = useAgentStore((s) => s.isProcessing);

  // composer focus spring — subtle lift + glow
  const inputFocused = useSharedValue(0);
  const composerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(inputFocused.value ? 1.01 : 1, SPRING) }],
    borderColor: withTiming(
      inputFocused.value ? 'rgba(99,102,241,0.22)' : 'rgba(148,163,184,0.18)',
      { duration: 180 }
    ) as any,
  }));

  return (
    <SafeAreaView className="flex-1 bg-canvas-soft" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <Animated.View
          entering={FadeIn.duration(320)}
          className="flex-row flex-wrap items-end justify-between gap-3 px-4 pb-3 pt-3"
        >
          <View className="min-w-[160px] flex-1">
            <Text className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-faint">
              YounesAI
            </Text>
            <Text className="text-hero text-ink -mt-1">Assistant</Text>
            <Text className="text-xs font-medium text-ink-muted">Text · Voice · Image · Tasks</Text>
          </View>
          {messages.length > 0 ? (
            <PressableScale onPress={clearChat}>
              <View
                className="h-9 w-9 items-center justify-center rounded-full bg-white border border-glass-border"
                style={{
                  shadowColor: '#0F172A',
                  shadowOpacity: 0.06,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 2,
                }}
              >
                <Trash2 size={16} color="#94A3B8" />
              </View>
            </PressableScale>
          ) : null}
        </Animated.View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMessage as any}
          contentContainerClassName="gap-3 px-4 pb-6 pt-3"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <Animated.View
              entering={FadeInDown.delay(120).duration(420).springify().damping(18)}
              className="items-center pt-10 px-6"
            >
              <View className="h-14 w-14 items-center justify-center rounded-3xl bg-accent-soft border border-accent/10">
                <Sparkles size={26} color="#6366F1" />
              </View>
              <Text className="mt-4 text-center text-sm leading-5 text-ink-soft">
                Try one — I handle everything in one chat.{'\n'}Your voice, images, tasks & files
                are one thread.
              </Text>
              <View className="mt-5 flex-row flex-wrap justify-center gap-2">
                {[
                  'Generate an image of a neon forest at night',
                  'Create a task to review the project docs tomorrow 3pm',
                  'Remind me to buy groceries in 10 minutes',
                  'Find documents that mention budget',
                  'Schedule a meeting tomorrow at 10am with team',
                  'Remember that I prefer dark mode',
                ].map((s, i) => (
                  <Animated.View
                    key={s}
                    entering={FadeInDown.delay(180 + i * 40)
                      .duration(360)
                      .springify()
                      .damping(18)}
                  >
                    <PressableScale
                      onPress={() => {
                        hapticSelect();
                        setDraft(s);
                      }}
                    >
                      <View className="rounded-full border border-glass-border bg-white/90 px-3 py-2">
                        <Text className="text-xs font-medium text-ink-soft">{s}</Text>
                      </View>
                    </PressableScale>
                  </Animated.View>
                ))}
              </View>
              <View className="mt-6 w-full rounded-2xl bg-amber-50 border border-amber-200/60 p-3">
                <Text className="text-xs font-bold tracking-wide text-amber-700">
                  Voice + Image in one input
                </Text>
                <Text className="mt-1 text-xs leading-4 text-amber-700/80">
                  Hold mic to talk, type "generate an image of…" for FLUX, or ask to create
                  tasks/events/files — orchestrator routes automatically.
                </Text>
              </View>
            </Animated.View>
          }
          ListFooterComponent={
            pending || isProcessing ? (
              <Animated.View entering={FadeIn.duration(220)} className="gap-2 pt-2">
                {isRecording ? (
                  <View className="items-center py-2">
                    <SkiaWaveform level={level} width={260} />
                    <Text className="mt-2 text-xs font-bold tracking-wide text-accent-rose">
                      Listening…
                    </Text>
                  </View>
                ) : null}
                {pendingSteps.length > 0 ? (
                  <View
                    className="rounded-2xl border border-glass-border bg-white px-4 py-3"
                    style={{
                      shadowColor: '#0F172A',
                      shadowOpacity: 0.04,
                      shadowRadius: 12,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 1,
                    }}
                  >
                    <AgentStepTracker steps={pendingSteps} />
                  </View>
                ) : (
                  <TypingIndicator />
                )}
              </Animated.View>
            ) : null
          }
        />

        {/* Composer: glassmorphism with border glow + spring focus */}
        <View className={`px-3 pt-2 ${keyboardVisible ? 'pb-3' : 'pb-28'}`}>
          {isRecording ? (
            <Animated.View
              entering={FadeInDown.duration(260).springify().damping(18)}
              className="mb-2 items-center rounded-2xl bg-accent-roseSoft border border-rose-200 px-3 py-2"
            >
              <SkiaWaveform level={level} width={300} />
              <Text className="mt-1 text-[11px] font-bold tracking-widest text-accent-rose">
                Listening — tap square to stop
              </Text>
            </Animated.View>
          ) : null}
          <Animated.View
            style={[
              {
                shadowColor: '#0F172A',
                shadowOpacity: 0.08,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 8 },
                elevation: 4,
              } as any,
              composerStyle,
            ]}
            className="flex-row items-end gap-2 rounded-[28px] border bg-white px-2 py-2"
          >
            {/* top highlight */}
            <View
              pointerEvents="none"
              className="absolute inset-x-6 top-0 h-px bg-white/80 rounded-full"
            />
            <PressableScale
              onPress={isRecording ? stopRec : startRec}
              haptic={false}
              intensity="subtle"
              className={`h-10 w-10 items-center justify-center rounded-full ${isRecording ? 'bg-accent-rose' : 'bg-accent'} ${pending ? 'opacity-50' : ''}`}
            >
              <View
                className={`h-10 w-10 items-center justify-center rounded-full ${isRecording ? 'bg-accent-rose' : 'bg-accent'}`}
                style={
                  isRecording
                    ? undefined
                    : ({
                        shadowColor: '#6366F1',
                        shadowOpacity: 0.28,
                        shadowRadius: 10,
                        shadowOffset: { width: 0, height: 4 },
                      } as any)
                }
              >
                {isRecording ? (
                  <Square size={16} color="#FFFFFF" fill="#FFFFFF" />
                ) : (
                  <Mic size={18} color="#FFFFFF" />
                )}
              </View>
            </PressableScale>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onFocus={() => (inputFocused.value = 1)}
              onBlur={() => (inputFocused.value = 0)}
              placeholder={isRecording ? 'Listening…' : 'Message • "generate an image of…"'}
              placeholderTextColor="#94A3B8"
              className="max-h-28 flex-1 py-2 text-[15px] leading-5 text-ink"
              onSubmitEditing={submit}
              returnKeyType="send"
              multiline
              editable={!isRecording}
            />
            <PressableScale
              onPress={submit}
              haptic={false}
              className="h-10 w-10 items-center justify-center"
            >
              <View
                className={`h-10 w-10 items-center justify-center rounded-full ${draft.trim() && !pending ? 'bg-ink' : 'bg-slate-200'}`}
                style={
                  draft.trim() && !pending
                    ? {
                        shadowColor: '#0F172A',
                        shadowOpacity: 0.18,
                        shadowRadius: 8,
                        shadowOffset: { width: 0, height: 4 },
                      }
                    : undefined
                }
              >
                {pending ? (
                  <Loader size={16} color="#FFFFFF" />
                ) : (
                  <Send size={16} color="#FFFFFF" />
                )}
              </View>
            </PressableScale>
          </Animated.View>
          <Text className="pt-1.5 text-center text-[10px] font-medium tracking-wide text-ink-faint">
            Groq Whisper · NVIDIA FLUX · Swipe task to archive
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
