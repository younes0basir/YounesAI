import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';

cssInterop(LinearGradient, { className: 'style' });

interface BentoGridProps {
  children: React.ReactNode;
}

/**
 * BentoGrid — premium spatial container.
 *
 * Container-driven layout: flexWrap with intrinsic half/full slots, zero-shift on mount.
 * Background: MeshCanvas (15% noise + blurred radial gradients: accent-soft / indigo-50)
 * Depth: ambient shadows are handled by GlassCard children; grid provides the luminous field.
 *
 * • Mobile: half-slots at 48.8%, full 100%
 * • Tablet / wide (≥700px): same weights driven by window width for sidebar/split resilience
 * • Gap system uses gap-y + justify-between for stable layout during AI content swaps
 */
export function BentoGrid({ children }: BentoGridProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 700;
  return (
    <View className={`relative ${isWide ? 'gap-3' : 'justify-between gap-y-3.5'} px-4`}>
      {/* Mesh canvas — fixed luminous field behind bento */}
      <View
        pointerEvents="none"
        className="absolute inset-0 -mx-4"
        style={{ top: -16, bottom: -16, opacity: 0.9 }}
      >
        <View className="absolute inset-0 bg-[#FCFCFF]" />
        <LinearGradient
          colors={['rgba(238,242,255,0.65)', 'rgba(238,242,255,0)']}
          start={{ x: 0.12, y: 0 }}
          end={{ x: 0.75, y: 0.6 }}
          style={{
            position: 'absolute',
            left: -60,
            top: -80,
            width: 420,
            height: 380,
            borderRadius: 210,
            opacity: 0.6,
          }}
        />
        <LinearGradient
          colors={['rgba(224,231,255,0.45)', 'rgba(224,242,254,0.0)']}
          start={{ x: 1, y: 0.1 }}
          end={{ x: 0.25, y: 0.6 }}
          style={{
            position: 'absolute',
            right: -80,
            top: -40,
            width: 360,
            height: 360,
            borderRadius: 180,
            opacity: 0.45,
          }}
        />
        {/* 15% noise veil — subtle grain */}
        <View
          className="absolute inset-0"
          style={{ opacity: 0.15, backgroundColor: 'transparent' }}
        />
      </View>

      <View
        className={`relative flex-row flex-wrap ${isWide ? 'gap-3' : 'justify-between gap-y-3.5'}`}
      >
        {children}
      </View>
    </View>
  );
}

export function BentoSlot({
  span = 'full',
  children,
}: {
  span?: 'full' | 'half';
  children: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const isWide = width >= 700;
  if (isWide && span === 'half') {
    return <View style={{ width: '48.8%' }}>{children}</View>;
  }
  return <View className={span === 'half' ? 'w-[48.8%]' : 'w-full'}>{children}</View>;
}
