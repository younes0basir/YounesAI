import React, { forwardRef, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

interface BottomSheetProps {
  snapPoints?: (string | number)[];
  onDismiss?: () => void;
  children: React.ReactNode;
}

const styles = StyleSheet.create({
  background: { backgroundColor: '#FFFFFF', borderRadius: 28 },
  handle: { backgroundColor: '#94A3B8' },
});

export const BottomSheet = forwardRef<BottomSheetModal, BottomSheetProps>(function BottomSheet(
  { snapPoints, onDismiss, children },
  ref
) {
  const points = useMemo(() => snapPoints ?? ['40%'], [snapPoints]);

  const renderBackdrop = (props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.35} />
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={points}
      onDismiss={onDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <BottomSheetView className="px-5 pb-8">{children}</BottomSheetView>
    </BottomSheetModal>
  );
});
