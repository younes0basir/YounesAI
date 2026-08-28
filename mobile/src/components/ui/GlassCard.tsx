import React from 'react';
import { View, type ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { cssInterop } from 'nativewind';

cssInterop(BlurView, { className: 'style' });

interface GlassCardProps extends ViewProps {
  intensity?: number;
  children: React.ReactNode;
}

/** Frosted-glass container: BlurView backdrop inside a rounded, bordered frame. */
export function GlassCard({ intensity = 40, children, className, ...props }: GlassCardProps) {
  return (
    <View
      className={`overflow-hidden rounded-card border border-glass-border bg-glass ${className ?? ''}`}
      {...props}
    >
      <BlurView intensity={intensity} tint="light" className="absolute inset-0" />
      {children}
    </View>
  );
}
