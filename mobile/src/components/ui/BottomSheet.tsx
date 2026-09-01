import React, { forwardRef, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { hapticSheetSnap, hapticTap } from '@/lib/haptics';

interface BottomSheetProps {
  snapPoints?: (string | number)[];
  onDismiss?: () => void;
  onChange?: (index: number) => void;
  children: React.ReactNode;
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#FCFCFF',
    borderRadius: 28,
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.7)',
    borderLeftColor: 'rgba(148,163,184,0.14)',
    borderRightColor: 'rgba(148,163,184,0.14)',
    borderBottomColor: 'rgba(241,245,249,1)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -8 },
  },
  handle: { backgroundColor: '#CBD5E1', width: 40, height: 4, borderRadius: 2 },
});

export const BottomSheet = forwardRef<BottomSheetModal, BottomSheetProps>(function BottomSheet(
  { snapPoints, onDismiss, onChange, children },
  ref
) {
  const points = useMemo(() => snapPoints ?? ['40%'], [snapPoints]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.42} />
    ),
    []
  );

  const handleChange = useCallback(
    (index: number) => {
      if (index >= 0) hapticSheetSnap();
      else hapticTap();
      onChange?.(index);
    },
    [onChange]
  );

  const handleAnimate = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex !== toIndex && toIndex >= 0) hapticSheetSnap();
  }, []);

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={points}
      onDismiss={onDismiss}
      onChange={handleChange}
      onAnimate={handleAnimate}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      enablePanDownToClose
      enableDynamicSizing={false}
    >
      {/* top-edge bevel */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 14,
          right: 14,
          height: 1,
          backgroundColor: 'rgba(255,255,255,0.8)',
          borderRadius: 999,
        }}
      />
      <BottomSheetView className="px-5 pb-8 pt-1">{children}</BottomSheetView>
    </BottomSheetModal>
  );
});
