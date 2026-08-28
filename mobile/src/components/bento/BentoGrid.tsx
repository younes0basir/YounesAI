import React from 'react';
import { View } from 'react-native';

interface BentoGridProps {
  children: React.ReactNode;
}

/**
 * Flexbox-wrap grid. Children opt into `flex-basis` via the exported
 * span classes: full-width cards use `w-full`, half cards use `w-[48%]`.
 */
export function BentoGrid({ children }: BentoGridProps) {
  return <View className="flex-row flex-wrap justify-between gap-y-3 px-4">{children}</View>;
}

export function BentoSlot({
  span = 'full',
  children,
}: {
  span?: 'full' | 'half';
  children: React.ReactNode;
}) {
  return <View className={span === 'half' ? 'w-[48%]' : 'w-full'}>{children}</View>;
}
