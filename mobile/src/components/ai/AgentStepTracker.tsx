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

const STATUS_BG: Record<AgentStep['status'], string> = {
  pending: 'bg-slate-100 border-slate-200',
  active: 'bg-accent-soft border-accent/15',
  done: 'bg-emerald-50 border-emerald-200/50',
  error: 'bg-rose-50 border-rose-200/50',
};

export function AgentStepTracker({ steps }: { steps: AgentStep[] }) {
  if (steps.length === 0) return null;

  return (
    <View className="gap-0">
      {/* vertical spine */}
      <View
        className="absolute left-[15px] top-3 bottom-3 w-px bg-slate-200/70"
        pointerEvents="none"
      />
      {steps.map((step, idx) => {
        const Icon = AGENT_ICONS[step.agent] ?? Sparkles;
        const color = STATUS_COLOR[step.status];
        const isLast = idx === steps.length - 1;
        const isActive = step.status === 'active';
        return (
          <Animated.View
            key={step.id}
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(150)}
            className={`flex-row items-center gap-2.5 py-1.5 ${isLast ? '' : ''}`}
          >
            {/* icon cell — glass with bevel */}
            <View
              className={`h-8 w-8 items-center justify-center rounded-full border ${STATUS_BG[step.status]}`}
              style={{
                shadowColor: isActive ? '#6366F1' : '#0F172A',
                shadowOpacity: isActive ? 0.12 : 0.04,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 1,
              }}
            >
              <View
                pointerEvents="none"
                className="absolute inset-x-1.5 top-0 h-px bg-white/70 rounded-full"
              />
              {step.status === 'active' ? (
                <Loader size={14} color={color} />
              ) : (
                <Icon size={14} color={color} />
              )}
            </View>
            <View className="flex-1">
              <Text
                className={`text-[13px] tracking-[-0.01em] ${
                  step.status === 'active'
                    ? 'font-semibold text-ink'
                    : step.status === 'done'
                      ? 'font-medium text-ink-soft'
                      : step.status === 'error'
                        ? 'font-medium text-accent-rose'
                        : 'font-medium text-ink-faint'
                }`}
                numberOfLines={1}
              >
                {step.label}
              </Text>
              {isActive ? (
                <Text className="text-[10px] font-bold uppercase tracking-[0.12em] text-accent/70">
                  Working
                </Text>
              ) : step.status === 'done' ? (
                <Text className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-600/70">
                  Done
                </Text>
              ) : null}
            </View>
            {/* status dot with halo */}
            <View
              className={`h-2 w-2 rounded-full ${step.status === 'done' ? 'bg-emerald-500' : step.status === 'active' ? 'bg-accent' : step.status === 'error' ? 'bg-accent-rose' : 'bg-slate-300'}`}
              style={
                isActive
                  ? {
                      shadowColor: '#6366F1',
                      shadowOpacity: 0.5,
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 0 },
                    }
                  : undefined
              }
            />
          </Animated.View>
        );
      })}
    </View>
  );
}
