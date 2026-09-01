import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Keyboard,
  Modal,
  Platform,
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
  withRepeat,
  Easing,
  cancelAnimation,
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

// Premium physics — directive stiffness 260 damping 20
const SPRING = { damping: 20, stiffness: 260, mass: 0.8 };
const FAB_SIZE = 64;
const SHEET_WIDTH = 328;
const SHEET_HEIGHT = 268;
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
  // conical hue rotation — slow during inference
  const hueRotation = useSharedValue(0);

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
  const isOpenShared = useSharedValue(0);
  useEffect(() => {
    isOpenShared.value = isOpen ? 1 : 0;
  }, [isOpen, isOpenShared]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // hue rotation lifecycle — slow conical spin during inference/recording
  useEffect(() => {
    if (isProcessing || isRecording) {
      hueRotation.value = withRepeat(
        withTiming(360, { duration: 4200, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      cancelAnimation(hueRotation);
      hueRotation.value = withTiming(0, { duration: 600 });
    }
  }, [isProcessing, isRecording, hueRotation]);

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
  const conicalStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${hueRotation.value}deg` }],
    opacity: isProcessing || isRecording ? 0.95 : 0,
  }));
  const conicalSheetStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${hueRotation.value * 0.5}deg` }],
    opacity: isProcessing ? 0.55 : 0,
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

  const doSnapAndPersist = (x: number, y: number) => {
    'worklet';
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

  // Shared premium container decoration
  const useHighOpacityFallback = Platform.OS === 'android';

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
              // dual ambient shadow: slate + indigo
              shadowColor: '#0F172A',
              shadowOpacity: 0.07,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 12 },
              elevation: 14,
            },
            positionStyle,
          ]}
          pointerEvents="box-none"
        >
          {/* second shadow layer wrapper */}
          <View
            style={{
              shadowColor: '#6366F1',
              shadowOpacity: 0.1,
              shadowRadius: 32,
              shadowOffset: { width: 0, height: 16 },
              elevation: 16,
              borderRadius: 28,
            }}
          >
            <Animated.View
              style={containerStyle}
              className="overflow-hidden border border-white/50"
            >
              {/* Android fallback: high-opacity layered canvas instead of BlurView */}
              {useHighOpacityFallback ? (
                <View className="absolute inset-0 bg-white/92" />
              ) : (
                <BlurView intensity={64} tint="light" className="absolute inset-0" />
              )}
              {/* Mesh canvas: accent-soft + indigo wash */}
              <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
                <LinearGradient
                  colors={['rgba(238,242,255,0.9)', 'rgba(224,231,255,0.0)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ position: 'absolute', inset: 0, opacity: 0.7 }}
                />
                <LinearGradient
                  colors={['rgba(224,242,254,0.35)', 'rgba(255,255,255,0)']}
                  start={{ x: 1, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: 220,
                    height: 220,
                    borderRadius: 110,
                    opacity: 0.5,
                  }}
                />
              </View>

              {/* Conical hue rotation during inference — slow 4.2s spin */}
              <Animated.View
                style={[conicalSheetStyle, { position: 'absolute', inset: -60, borderRadius: 60 }]}
                pointerEvents="none"
              >
                <LinearGradient
                  colors={['#6366F1', '#8B5CF6', '#EC4899', '#06B6D4', '#6366F1']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{ flex: 1, borderRadius: 60, opacity: 0.18 }}
                />
              </Animated.View>

              <Animated.View style={sheetTintStyle} className="absolute inset-0 bg-white/40" />
              {/* top-edge bevel highlight */}
              <View
                pointerEvents="none"
                className="absolute inset-x-0 top-0 h-px bg-white/70"
                style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
              />
              <View
                pointerEvents="none"
                className="absolute inset-x-0 bottom-0 h-px bg-slate-100/60"
                style={{ borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
              />

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
                      <View className="h-7 w-7 items-center justify-center rounded-full bg-white border border-accent/10">
                        <Sparkles size={14} color="#6366F1" />
                      </View>
                      <Text className="text-[13px] font-bold tracking-[-0.01em] text-ink">
                        Younes AI
                      </Text>
                      <View className="ml-1 rounded-full bg-white border border-slate-200 px-2 py-0.5">
                        <Text className="text-[10px] font-bold tracking-[0.08em] text-ink-muted">
                          {isRecording
                            ? '● LISTENING'
                            : isProcessing
                              ? '◐ THINKING'
                              : 'DRAG TO MOVE'}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={toggleOpen}
                      hitSlop={12}
                      className="h-7 w-7 items-center justify-center rounded-full bg-white border border-slate-200"
                    >
                      <X size={14} color="#475569" />
                    </Pressable>
                  </View>
                </GestureDetector>

                <View className="items-center pb-2" pointerEvents="none">
                  <View className="h-1 w-10 rounded-full bg-slate-200" />
                  <GripHorizontal size={12} color="#CBD5E1" style={{ marginTop: 4 }} />
                </View>

                <View
                  className="flex-1 justify-center rounded-2xl border border-white/60 bg-white/75 px-3 py-2.5"
                  style={{
                    shadowColor: '#0F172A',
                    shadowOpacity: 0.04,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 4 },
                  }}
                >
                  <View
                    pointerEvents="none"
                    className="absolute inset-x-0 top-0 h-px bg-white/70 rounded-t-2xl"
                  />
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
                    <View className="gap-1" style={{ minHeight: 56 }}>
                      {lastTranscription ? (
                        <Text className="text-[11px] italic tracking-[-0.01em] text-ink-faint">
                          Heard: "{lastTranscription}"
                        </Text>
                      ) : null}
                      <Text
                        className="text-[13px] leading-5 tracking-[-0.01em] text-ink-soft"
                        numberOfLines={5}
                      >
                        {lastResponse}
                      </Text>
                    </View>
                  ) : steps.length > 0 ? (
                    <AgentStepTracker steps={steps} />
                  ) : (
                    <View className="gap-1.5" style={{ minHeight: 56 }}>
                      <Text className="text-[13px] font-semibold tracking-[-0.01em] text-ink">
                        Try asking…
                      </Text>
                      <Text className="text-[12px] leading-4 tracking-[-0.01em] text-ink-soft">
                        “Generate an image of…” · “Remind me at 6pm” · “Find my invoice PDF”
                      </Text>
                      <View className="mt-1.5 flex-row gap-1.5">
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
                            className="rounded-full border border-accent/10 bg-accent-soft px-3 py-1"
                          >
                            <Text className="text-[12px] font-semibold tracking-[-0.01em] text-accent">
                              {chip}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                <View className="mt-3 flex-row items-center gap-2">
                  <View className="flex-1 flex-row items-center rounded-full border border-white/60 bg-white px-3 py-2">
                    <View
                      pointerEvents="none"
                      className="absolute inset-x-3 top-0 h-px bg-white/80 rounded-full"
                    />
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      placeholder="Ask anything…"
                      placeholderTextColor="#94A3B8"
                      className="flex-1 text-[13px] tracking-[-0.01em] text-ink"
                      onSubmitEditing={submitDraft}
                      returnKeyType="send"
                    />
                    <Pressable
                      onPress={submitDraft}
                      hitSlop={8}
                      disabled={isProcessing}
                      className="h-7 w-7 items-center justify-center rounded-full bg-accent-soft"
                    >
                      <Send size={14} color={isProcessing ? '#CBD5E1' : '#6366F1'} />
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={isRecording ? stopRecording : startRecording}
                    hitSlop={8}
                    className={`h-10 w-10 items-center justify-center rounded-full border ${isRecording ? 'bg-accent-rose border-rose-200' : 'bg-accent border-accent/20'}`}
                    style={{
                      shadowColor: isRecording ? '#F43F5E' : '#6366F1',
                      shadowOpacity: 0.22,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 4 },
                    }}
                  >
                    {isRecording ? (
                      <Square size={14} color="#FFFFFF" fill="#FFFFFF" />
                    ) : (
                      <Mic size={18} color="#FFFFFF" />
                    )}
                  </Pressable>
                </View>
                <Text className="pt-2 text-center text-[10px] font-medium tracking-wide text-ink-faint">
                  Drag the header to move
                </Text>
              </Animated.View>
            </Animated.View>
          </View>
        </Animated.View>
      </>
    );
  }

  // Collapsed FAB — fully draggable + tap/longPress with conical inference halo
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
              shadowColor: '#0F172A',
              shadowOpacity: 0.06,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 10,
            },
            positionStyle,
          ]}
          pointerEvents="box-none"
        >
          <View
            style={{
              shadowColor: '#6366F1',
              shadowOpacity: 0.14,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 },
              elevation: 12,
              borderRadius: FAB_SIZE / 2,
            }}
          >
            {/* breathing halos + conical rotation */}
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
              <OrbPulseRing
                active={!isRecording && !isProcessing}
                size={FAB_SIZE}
                color="#6366F1"
              />
              {/* Conical inference halo — replaces basic opacity pulse */}
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    width: FAB_SIZE + 10,
                    height: FAB_SIZE + 10,
                    borderRadius: (FAB_SIZE + 10) / 2,
                    overflow: 'hidden',
                    opacity: 0.9,
                  },
                  conicalStyle,
                ]}
                pointerEvents="none"
              >
                <LinearGradient
                  colors={['#6366F1', '#8B5CF6', '#EC4899', '#06B6D4', '#6366F1']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{ flex: 1, opacity: 0.85 }}
                />
                <View
                  style={{
                    position: 'absolute',
                    inset: 2,
                    borderRadius: 999,
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </Animated.View>
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
                <Text className="text-xs font-semibold tracking-[-0.01em] text-white">
                  Drag me anywhere ✨
                </Text>
                <Text className="text-[11px] tracking-[-0.01em] text-white/70">
                  Hold for quick actions
                </Text>
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
              className="overflow-hidden border border-white/50"
            >
              {/* Android high-opacity fallback */}
              {useHighOpacityFallback ? (
                <View className="absolute inset-0 bg-white" />
              ) : (
                <BlurView intensity={56} tint="light" className="absolute inset-0" />
              )}
              {/* Mesh wash */}
              <View className="absolute inset-0" pointerEvents="none">
                <LinearGradient
                  colors={['#6366F1', '#8B5CF6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ position: 'absolute', inset: 0 }}
                />
                {/* conical overlay for FAB face during processing */}
                {isProcessing || isRecording ? (
                  <Animated.View
                    style={[{ position: 'absolute', inset: -20 }, conicalStyle]}
                    pointerEvents="none"
                  >
                    <LinearGradient
                      colors={['#6366F1', '#EC4899', '#8B5CF6', '#06B6D4', '#6366F1']}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={{ flex: 1, opacity: 0.55 }}
                    />
                  </Animated.View>
                ) : null}
              </View>
              {/* specular highlight */}
              <View
                pointerEvents="none"
                className="absolute inset-x-0 top-0 h-px bg-white/70"
                style={{ borderTopLeftRadius: 32, borderTopRightRadius: 32 }}
              />
              <Animated.View
                style={fabGradientStyle}
                className="absolute inset-0"
                pointerEvents="none"
              >
                <LinearGradient
                  colors={['#6366F1', '#8B5CF6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ position: 'absolute', inset: 0 }}
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
                  <View
                    className="absolute bottom-2 flex-row items-end gap-0.5"
                    pointerEvents="none"
                  >
                    <View className="h-1 w-1 rounded-full bg-white/90" />
                    <View className="h-2 w-1 rounded-full bg-white/90" />
                    <View className="h-1.5 w-1 rounded-full bg-white/90" />
                  </View>
                ) : null}
              </Animated.View>

              <Animated.View
                style={sheetContentStyle}
                className="flex-1 p-3.5"
                pointerEvents="none"
              >
                <Text className="text-sm font-bold tracking-[-0.01em] text-ink">Younes AI</Text>
              </Animated.View>
            </Animated.View>
          </View>
        </Animated.View>
      </GestureDetector>
    </>
  );
}
