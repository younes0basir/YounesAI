import React from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import {
  Brain,
  Calendar,
  CheckSquare,
  FileText,
  Image as ImageIcon,
  Loader,
  Mail,
  MapPin,
  Sparkles,
} from 'lucide-react-native';
import type { AgentStep } from '@/lib/types';

const AGENT_ICONS: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  task: CheckSquare,
  event: Calendar,
  email: Mail,
  file: FileText,
  place: MapPin,
  memory: Brain,
  image: ImageIcon,
  general: Sparkles,
  gemma: Sparkles,
};

const STATUS_COLOR: Record<AgentStep['status'], string> = {
  pending: '#CBD5E1',
  active: '#6366F1',
  done: '#10B981',
  error: '#F43F5E',
};

export function AgentStepTracker({ steps }: { steps: AgentStep[] }) {
  if (steps.length === 0) return null;

  return (
    <View className="gap-2">
      {steps.map((step) => {
        const Icon = AGENT_ICONS[step.agent] ?? Sparkles;
        const color = STATUS_COLOR[step.status];
        return (
          <Animated.View
            key={step.id}
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            className="flex-row items-center gap-2.5"
          >
            {step.status === 'active' ? (
              <Loader size={16} color={color} />
            ) : (
              <Icon size={16} color={color} />
            )}
            <Text
              className={`text-[13px] ${
                step.status === 'active'
                  ? 'font-semibold text-ink'
                  : step.status === 'done'
                    ? 'text-ink-soft'
                    : step.status === 'error'
                      ? 'text-accent-rose'
                      : 'text-ink-faint'
              }`}
            >
              {step.label}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
}
