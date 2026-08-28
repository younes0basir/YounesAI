import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Keyboard,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';
import { GripHorizontal, Mic, Send, Sparkles, Square, X } from 'lucide-react-native';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { hapticSelect, hapticSuccess, hapticTap } from '@/lib/haptics';
import {
  clamp,
  hasSeenOrbTip,
  loadOrbPosition,
  markOrbTipSeen,
  saveOrbPosition,
} from '@/lib/orbPosition';

cssInterop(BlurView, { className: 'style' });
cssInterop(LinearGradient, { className: 'style' });

import { SkiaWaveform } from './SkiaWaveform';
import { AgentStepTracker } from './AgentStepTracker';
import { OrbPulseRing } from './OrbPulseRing';
import { OrbQuickRing } from './OrbQuickRing';
import { useAgentStore } from '@/stores/useAgentStore';
import {
  useAudioRecorder,
  RecordingPresets,
  ensureMicPermission,
  releaseAudioMode,
} from '@/services/voice';
import { useRouter } from 'expo-router';

const SPRING = { damping: 18, stiffness: 160, mass: 0.8 };
const FAB_SIZE = 64;
const SHEET_WIDTH = 328;
const SHEET_HEIGHT = 252;
const MARGIN = 12;

function clampWL(n: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(n, min), max);
}

export function FloatingAIHub() {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const keyboardVisible = useKeyboardVisible();
  const router = useRouter();

  const open = useSharedValue(0);
  const micLevel = useSharedValue(0);

  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [showRing, setShowRing] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [hubImageFs, setHubImageFs] = useState(false);

  // ---- position state (top-left) ----
  const posX = useSharedValue(winW - FAB_SIZE - 16);
  const posY = useSharedValue(winH - FAB_SIZE - 110);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const isDragging = useSharedValue(0);
  // mirror JS isOpen for worklets
  const isOpenShared = useSharedValue(0);
  useEffect(() => {
    isOpenShared.value = isOpen ? 1 : 0;
  }, [isOpen, isOpenShared]);

  // keep dimensions in shared values so worklets stay fresh without re-creating gestures
  const winWShared = useSharedValue(winW);
  const winHShared = useSharedValue(winH);
  const insetTopShared = useSharedValue(insets.top);
  const insetBottomShared = useSharedValue(insets.bottom);
  useEffect(() => {
    winWShared.value = winW;
    winHShared.value = winH;
    insetTopShared.value = insets.top;
    insetBottomShared.value = insets.bottom;
  }, [
    winW,
    winH,
    insets.top,
    insets.bottom,
    winWShared,
    winHShared,
    insetTopShared,
    insetBottomShared,
  ]);

  // Load persisted position once
  useEffect(() => {
    const saved = loadOrbPosition();
    if (saved) {
      posX.value = clamp(saved.x, MARGIN, winW - FAB_SIZE - MARGIN);
      posY.value = clamp(saved.y, insets.top + MARGIN, winH - FAB_SIZE - insets.bottom - 96);
    } else {
      posX.value = winW - FAB_SIZE - 16;
      posY.value = winH - FAB_SIZE - insets.bottom - 96;
    }
    if (!hasSeenOrbTip()) {
      const t = setTimeout(() => setShowTip(true), 900);
      const hide = setTimeout(() => {
        setShowTip(false);
        markOrbTipSeen();
      }, 5000);
      return () => {
        clearTimeout(t);
        clearTimeout(hide);
      };
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep orb inside bounds when dimensions change
  useEffect(() => {
    const maxX = isOpen ? winW - SHEET_WIDTH - MARGIN : winW - FAB_SIZE - MARGIN;
    const maxY = winH - (isOpen ? SHEET_HEIGHT : FAB_SIZE) - insets.bottom - 16;
    posX.value = withSpring(clamp(posX.value, MARGIN, Math.max(MARGIN, maxX)), SPRING);
    posY.value = withSpring(
      clamp(posY.value, insets.top + MARGIN, Math.max(insets.top + MARGIN, maxY)),
      SPRING
    );
  }, [winW, winH, insets.top, insets.bottom, isOpen, posX, posY]);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const {
    isProcessing,
    isRecording,
    lastResponse,
    lastImage,
    lastTranscription,
    steps,
    sendMessage,
    sendVoice,
    setRecording,
  } = useAgentStore();

  const containerStyle = useAnimatedStyle(() => ({
    width: interpolate(open.value, [0, 1], [FAB_SIZE, SHEET_WIDTH]),
    height: interpolate(open.value, [0, 1], [FAB_SIZE, SHEET_HEIGHT]),
    borderRadius: interpolate(open.value, [0, 1], [FAB_SIZE / 2, 28]),
  }));
  const fabIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(open.value, [0, 0.45], [1, 0]),
    transform: [{ scale: interpolate(open.value, [0, 0.45], [1, 0.6]) }],
  }));
  const sheetContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(open.value, [0.5, 1], [0, 1]),
  }));
  const sheetTintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(open.value, [0, 1], [0, 1]),
  }));
  const fabGradientStyle = useAnimatedStyle(() => ({
    opacity: interpolate(open.value, [0, 0.5], [1, 0]),
  }));
  const positionStyle = useAnimatedStyle(() => {
    const keyboardLift = keyboardVisible && isOpen ? -260 : 0;
    const dragScale = isDragging.value ? 1.04 : 1;
    return {
      transform: [
        { translateX: posX.value },
        { translateY: posY.value + keyboardLift },
        { scale: dragScale },
      ],
    };
  });
  const recordingHaloStyle = useAnimatedStyle(() => ({
    opacity: isRecording ? 0.9 : 0,
    transform: [{ scale: isRecording ? 1 + micLevel.value * 0.18 : 1 }],
  }));

  const persistPos = useCallback((x: number, y: number) => {
    saveOrbPosition({ x, y });
  }, []);

  const toggleOpen = useCallback(() => {
    hapticTap();
    const next = !isOpen;
    setIsOpen(next);
    open.value = withSpring(next ? 1 : 0, SPRING);
    setShowRing(false);
    setShowTip(false);
    if (!next) {
      Keyboard.dismiss();
      markOrbTipSeen();
    } else {
      const maxX = winW - SHEET_WIDTH - MARGIN;
      const maxY = winH - SHEET_HEIGHT - insets.bottom - 16;
      const clampedX = clamp(posX.value, MARGIN, Math.max(MARGIN, maxX));
      const clampedY = clamp(posY.value, insets.top + MARGIN, Math.max(insets.top + MARGIN, maxY));
      if (clampedX !== posX.value || clampedY !== posY.value) {
        posX.value = withSpring(clampedX, SPRING);
        posY.value = withSpring(clampedY, SPRING);
        persistPos(clampedX, clampedY);
      }
    }
  }, [isOpen, open, winW, winH, insets.top, insets.bottom, posX, posY, persistPos]);

  const startRecording = async () => {
    if (!(await ensureMicPermission())) return;
    hapticTap();
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
    micLevel.value = withSpring(0.85, SPRING);
  };
  const stopRecording = async () => {
    hapticSuccess();
    setRecording(false);
    micLevel.value = withSpring(0.12, SPRING);
    await recorder.stop();
    await releaseAudioMode();
    if (recorder.uri) await sendVoice(recorder.uri);
  };
  const submitDraft = () => {
    const message = draft.trim();
    if (!message || isProcessing) return;
    hapticTap();
    setDraft('');
    void sendMessage(message);
  };

  // ---------- gestures ----------
  // Worklet snap helper — runs on UI thread, persists via runOnJS
  const doSnapAndPersist = (x: number, y: number) => {
    'worklet';
    // decide snap only when collapsed
    if (isOpenShared.value === 1) {
      runOnJS(persistPos)(x, y);
      return;
    }
    const snapLeft = x < winWShared.value / 2;
    const snapX = snapLeft ? MARGIN : winWShared.value - FAB_SIZE - MARGIN;
    const tabBarTop = winHShared.value - insetBottomShared.value - 90;
    const clampedY = y + FAB_SIZE > tabBarTop ? tabBarTop - FAB_SIZE - 8 : y;
    posX.value = withSpring(snapX, SPRING);
    posY.value = withSpring(clampedY, SPRING);
    runOnJS(hapticSelect)();
    runOnJS(persistPos)(snapX, clampedY);
  };

  // FAB drag — only when collapsed, whole orb draggable
  const fabPan = Gesture.Pan()
    .minDistance(4)
    .onBegin(() => {
      startX.value = posX.value;
      startY.value = posY.value;
      isDragging.value = 1;
    })
    .onUpdate((e) => {
      const maxX = winWShared.value - FAB_SIZE - MARGIN;
      const maxY = winHShared.value - FAB_SIZE - insetBottomShared.value - 16;
      const minY = insetTopShared.value + MARGIN;
      posX.value = clampWL(startX.value + e.translationX, MARGIN, Math.max(MARGIN, maxX));
      posY.value = clampWL(startY.value + e.translationY, minY, Math.max(minY, maxY));
    })
    .onEnd(() => {
      isDragging.value = 0;
      doSnapAndPersist(posX.value, posY.value);
    });

  // Sheet header drag — only when expanded, header is handle (avoids stealing TextInput)
  const sheetPan = Gesture.Pan()
    .minDistance(4)
    .onBegin(() => {
      startX.value = posX.value;
      startY.value = posY.value;
      isDragging.value = 1;
    })
    .onUpdate((e) => {
      const maxX = winWShared.value - SHEET_WIDTH - MARGIN;
      const maxY = winHShared.value - SHEET_HEIGHT - insetBottomShared.value - 16;
      const minY = insetTopShared.value + MARGIN;
      posX.value = clampWL(startX.value + e.translationX, MARGIN, Math.max(MARGIN, maxX));
      posY.value = clampWL(startY.value + e.translationY, minY, Math.max(minY, maxY));
    })
    .onEnd(() => {
      isDragging.value = 0;
      doSnapAndPersist(posX.value, posY.value);
    });

  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd(() => {
      runOnJS(toggleOpen)();
    });
  const longPress = Gesture.LongPress()
    .minDuration(480)
    .onStart(() => {
      runOnJS(hapticSelect)();
      runOnJS(setShowRing)(true);
    });

  // collapsed: allow tap / longPress / drag as exclusive set
  const fabComposed = Gesture.Exclusive(longPress, fabPan, tap);

  const handleQuickAction = useCallback(
    (id: 'voice' | 'task' | 'search' | 'chat') => {
      if (id === 'voice') {
        if (!isOpen) toggleOpen();
        setTimeout(() => void startRecording(), 320);
      } else if (id === 'task') router.push('/(tabs)/tasks');
      else if (id === 'search') router.push('/(tabs)/more');
      else router.push('/(tabs)/chat');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen, toggleOpen, router]
  );

  // ---------- render ----------
  // Expanded sheet — header is the only drag handle, so TextInput stays interactive
  if (isOpen) {
    return (
      <>
        {showRing ? (
          <View style={{ position: 'absolute', inset: 0, zIndex: 40 }} pointerEvents="box-none">
            <OrbQuickRing
              visible={showRing}
              onClose={() => setShowRing(false)}
              onAction={handleQuickAction}
            />
          </View>
        ) : null}
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              top: 0,
              zIndex: 30,
              shadowColor: '#6366F1',
              shadowOpacity: 0.18,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 12,
            },
            positionStyle,
          ]}
          pointerEvents="box-none"
        >
          <Animated.View
            style={containerStyle}
            className="overflow-hidden border border-glass-border"
          >
            <BlurView intensity={56} tint="light" className="absolute inset-0" />
            <Animated.View style={sheetTintStyle} className="absolute inset-0 bg-[#EEF2FF]" />
            <Animated.View style={fabGradientStyle} className="absolute inset-0">
              <LinearGradient
                colors={['#6366F1', '#8B5CF6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="absolute inset-0"
              />
            </Animated.View>

            {/* fab icon hidden when open */}
            <Animated.View
              style={fabIconStyle}
              className="absolute inset-0 items-center justify-center"
              pointerEvents="none"
            >
              <Mic size={26} color="#FFFFFF" />
            </Animated.View>

            <Animated.View style={sheetContentStyle} className="flex-1 p-3.5">
              <GestureDetector gesture={sheetPan}>
                <View className="flex-row items-center justify-between pb-2">
                  <View className="flex-row items-center gap-2">
                    <View className="h-7 w-7 items-center justify-center rounded-full bg-accent/10">
                      <Sparkles size={14} color="#6366F1" />
                    </View>
                    <Text className="text-sm font-bold text-ink">Younes AI</Text>
                    <View className="ml-1 rounded-full bg-emerald-50 px-2 py-0.5">
                      <Text className="text-[10px] font-bold text-emerald-600">
                        {isRecording ? '● Listening' : isProcessing ? '◐ Thinking' : 'Drag to move'}
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={toggleOpen} hitSlop={12} className="p-1">
                    <X size={18} color="#475569" />
                  </Pressable>
                </View>
              </GestureDetector>

              <View className="items-center pb-2">
                <View className="h-1 w-10 rounded-full bg-slate-200" />
                <GripHorizontal size={12} color="#CBD5E1" style={{ marginTop: 4 }} />
              </View>

              <View className="flex-1 justify-center rounded-2xl bg-white/70 px-3 py-2">
                {isRecording ? (
                  <SkiaWaveform level={micLevel} width={SHEET_WIDTH - 32} />
                ) : lastImage ? (
                  <View className="gap-2">
                    <Pressable
                      onPress={() => setHubImageFs(true)}
                      className="overflow-hidden rounded-xl border border-glass-border"
                    >
                      <Image
                        source={{ uri: lastImage }}
                        style={{ width: '100%', height: 120, backgroundColor: '#F1F5F9' }}
                        resizeMode="cover"
                      />
                      <View className="absolute bottom-1 right-1 rounded-full bg-black/60 px-2 py-1">
                        <Text className="text-[10px] font-bold text-white">Tap to expand</Text>
                      </View>
                    </Pressable>
                    <Text className="text-[12px] leading-4 text-ink-soft" numberOfLines={2}>
                      {lastResponse}
                    </Text>
                    <Modal
                      visible={hubImageFs}
                      transparent
                      animationType="fade"
                      onRequestClose={() => setHubImageFs(false)}
                    >
                      <View className="flex-1 bg-black/95 items-center justify-center p-4">
                        <Pressable
                          onPress={() => setHubImageFs(false)}
                          className="absolute right-4 top-12 z-10 h-9 w-9 items-center justify-center rounded-full bg-white/20"
                        >
                          <X size={18} color="#FFFFFF" />
                        </Pressable>
                        <Image
                          source={{ uri: lastImage }}
                          style={{ width: 340, height: 340, maxWidth: '90%', maxHeight: '70%' }}
                          resizeMode="contain"
                        />
                        <Pressable
                          onPress={() => setHubImageFs(false)}
                          className="mt-6 rounded-full bg-white px-6 py-3"
                        >
                          <Text className="font-semibold text-ink">Close</Text>
                        </Pressable>
                      </View>
                    </Modal>
                  </View>
                ) : lastResponse ? (
                  <View className="gap-1">
                    {lastTranscription ? (
                      <Text className="text-[11px] italic text-ink-faint">
                        Heard: "{lastTranscription}"
                      </Text>
                    ) : null}
                    <Text className="text-[13px] leading-5 text-ink-soft" numberOfLines={5}>
                      {lastResponse}
                    </Text>
                  </View>
                ) : steps.length > 0 ? (
                  <AgentStepTracker steps={steps} />
                ) : (
                  <View className="gap-1.5">
                    <Text className="text-[13px] font-semibold text-ink">Try asking…</Text>
                    <Text className="text-xs leading-4 text-ink-soft">
                      “Generate an image of…” · “Remind me at 6pm” · “Find my invoice PDF”
                    </Text>
                    <View className="mt-1 flex-row gap-1.5">
                      {['Plan', 'Remind', 'Find'].map((chip) => (
                        <Pressable
                          key={chip}
                          onPress={() =>
                            setDraft(
                              chip === 'Plan'
                                ? 'Plan my day for tomorrow'
                                : chip === 'Remind'
                                  ? 'Generate an image of '
                                  : 'Find '
                            )
                          }
                          className="rounded-full bg-accent-soft px-3 py-1"
                        >
                          <Text className="text-xs font-semibold text-accent">{chip}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              <View className="mt-3 flex-row items-center gap-2">
                <View className="flex-1 flex-row items-center rounded-full bg-white px-3 py-2 shadow-sm">
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Ask anything…"
                    placeholderTextColor="#94A3B8"
                    className="flex-1 text-[13px] text-ink"
                    onSubmitEditing={submitDraft}
                    returnKeyType="send"
                  />
                  <Pressable onPress={submitDraft} hitSlop={8} disabled={isProcessing}>
                    <Send size={16} color={isProcessing ? '#CBD5E1' : '#6366F1'} />
                  </Pressable>
                </View>
                <Pressable
                  onPress={isRecording ? stopRecording : startRecording}
                  hitSlop={8}
                  className={`h-10 w-10 items-center justify-center rounded-full ${isRecording ? 'bg-accent-rose' : 'bg-accent'}`}
                >
                  {isRecording ? (
                    <Square size={16} color="#FFFFFF" fill="#FFFFFF" />
                  ) : (
                    <Mic size={18} color="#FFFFFF" />
                  )}
                </Pressable>
              </View>
              <Text className="pt-2 text-center text-[10px] font-medium text-ink-faint">
                Drag the header to move
              </Text>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </>
    );
  }

  // Collapsed FAB — fully draggable + tap/longPress
  return (
    <>
      {showRing ? (
        <View style={{ position: 'absolute', inset: 0, zIndex: 40 }} pointerEvents="box-none">
          <OrbQuickRing
            visible={showRing}
            onClose={() => setShowRing(false)}
            onAction={handleQuickAction}
          />
        </View>
      ) : null}
      <GestureDetector gesture={fabComposed}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              top: 0,
              zIndex: 30,
              shadowColor: '#6366F1',
              shadowOpacity: 0.18,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 12,
            },
            positionStyle,
          ]}
          pointerEvents="box-none"
        >
          {/* breathing halos */}
          <View
            style={{
              position: 'absolute',
              width: FAB_SIZE,
              height: FAB_SIZE,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            pointerEvents="none"
          >
            <OrbPulseRing active={!isRecording && !isProcessing} size={FAB_SIZE} color="#6366F1" />
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  width: FAB_SIZE + 18,
                  height: FAB_SIZE + 18,
                  borderRadius: (FAB_SIZE + 18) / 2,
                  borderWidth: 2,
                  borderColor: '#EC4899',
                },
                recordingHaloStyle,
              ]}
              pointerEvents="none"
            />
          </View>

          {showTip && !showRing ? (
            <Animated.View
              style={{
                position: 'absolute',
                bottom: FAB_SIZE + 14,
                right: 0,
                backgroundColor: '#0F172A',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 14,
                maxWidth: 200,
              }}
              pointerEvents="none"
            >
              <Text className="text-xs font-semibold text-white">Drag me anywhere ✨</Text>
              <Text className="text-[11px] text-white/70">Hold for quick actions</Text>
              <View
                style={{
                  position: 'absolute',
                  bottom: -6,
                  right: 22,
                  width: 12,
                  height: 12,
                  backgroundColor: '#0F172A',
                  transform: [{ rotate: '45deg' }],
                }}
              />
            </Animated.View>
          ) : null}

          <Animated.View
            style={containerStyle}
            className="overflow-hidden border border-glass-border"
          >
            <BlurView intensity={56} tint="light" className="absolute inset-0" />
            <Animated.View style={fabGradientStyle} className="absolute inset-0">
              <LinearGradient
                colors={['#6366F1', '#8B5CF6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="absolute inset-0"
              />
            </Animated.View>

            <Animated.View
              style={fabIconStyle}
              className="absolute inset-0 items-center justify-center"
              pointerEvents="none"
            >
              <View className="items-center justify-center">
                <Mic size={26} color="#FFFFFF" />
                {isRecording ? (
                  <View className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-accent-rose border-2 border-white" />
                ) : isProcessing ? (
                  <View className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-amber-400 border-2 border-white" />
                ) : null}
              </View>
              {isRecording ? (
                <View className="absolute bottom-2 flex-row items-end gap-0.5" pointerEvents="none">
                  <View className="h-1 w-1 rounded-full bg-white/90" />
                  <View className="h-2 w-1 rounded-full bg-white/90" />
                  <View className="h-1.5 w-1 rounded-full bg-white/90" />
                </View>
              ) : null}
            </Animated.View>

            {/* expanded sheet hidden when collapsed */}
            <Animated.View style={sheetContentStyle} className="flex-1 p-3.5" pointerEvents="none">
              <Text className="text-sm font-bold text-ink">Younes AI</Text>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </>
  );
}
