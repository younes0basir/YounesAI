import React from 'react';
import { Platform, View, type ViewProps } from 'react-native';

type GlassVariant = 'regular' | 'elevated' | 'subtle' | 'accent';

interface GlassCardProps extends ViewProps {
  variant?: GlassVariant;
  /** Adds specular highlight — defaults per-variant. */
  glow?: boolean;
  /** Disable outer ambient shadows (e.g. when parent already provides depth). */
  noShadow?: boolean;
  children: React.ReactNode;
}

/**
 * GlassCard — premium spatial surface.
 *
 * Depth: diffused dual-layer ambient shadows
 *   0 4px 24px -4px rgba(15,23,42,0.04)
 *   0 12px 32px -4px rgba(99,102,241,0.06)
 *   — emulated via two stacked shadow wrappers (iOS) + elevation (Android)
 *
 * Bevel: translucent top border (border-white/50) + subtle dark bottom border (slate-100)
 * Light: inner top-edge white inset (1px rgba 255,255,255,0.6) to catch light
 *
 * Android-safe: no BlurView, no overflow-hidden clipping issues.
 * Layered opacities + hairline borders + tight shadows ensure 60fps.
 */
export function GlassCard({
  variant = 'regular',
  glow,
  noShadow = false,
  children,
  className,
  style,
  ...props
}: GlassCardProps) {
  const variantStyles: Record<GlassVariant, string> = {
    regular: 'bg-white border-glass-border',
    elevated: 'bg-white border-glass-borderStrong',
    subtle: 'bg-white/80 border-glass-border',
    accent: 'bg-accent-soft border-accent/15',
  };

  const showGlow = glow ?? (variant === 'elevated' || variant === 'regular');

  // Outer ambient shadows — dual layer
  // Layer 1: slate diffuse (15,23,42 @ 0.04)
  // Layer 2: indigo diffuse (99,102,241 @ 0.06)
  const shadowLayer1: object =
    variant === 'elevated'
      ? {
          shadowColor: '#0F172A',
          shadowOpacity: 0.06,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }
      : variant === 'accent'
        ? {
            shadowColor: '#6366F1',
            shadowOpacity: 0.12,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 10 },
            elevation: 4,
          }
        : variant === 'subtle'
          ? {
              shadowColor: '#0F172A',
              shadowOpacity: 0.03,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 4 },
              elevation: 1,
            }
          : {
              // regular — balanced dual
              shadowColor: '#0F172A',
              shadowOpacity: 0.05,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 6 },
              elevation: 3,
            };

  const shadowLayer2: object =
    variant === 'elevated'
      ? {
          shadowColor: '#6366F1',
          shadowOpacity: 0.08,
          shadowRadius: 32,
          shadowOffset: { width: 0, height: 14 },
          elevation: 8,
        }
      : variant === 'accent'
        ? {
            shadowColor: '#8B5CF6',
            shadowOpacity: 0.08,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 8 },
            elevation: 3,
          }
        : variant === 'subtle'
          ? {
              shadowColor: '#6366F1',
              shadowOpacity: 0.04,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 },
              elevation: 1,
            }
          : {
              shadowColor: '#6366F1',
              shadowOpacity: 0.06,
              shadowRadius: 28,
              shadowOffset: { width: 0, height: 12 },
              elevation: 4,
            };

  // If shadows disabled, render single layer
  if (noShadow) {
    return (
      <View
        className={`rounded-card border ${variantStyles[variant]} ${className ?? ''}`}
        style={[
          {
            borderTopColor: 'rgba(255,255,255,0.5)',
            borderBottomColor: 'rgba(241,245,249,1)',
            borderLeftColor:
              variant === 'accent' ? 'rgba(99,102,241,0.15)' : 'rgba(148,163,184,0.18)',
            borderRightColor:
              variant === 'accent' ? 'rgba(99,102,241,0.15)' : 'rgba(148,163,184,0.18)',
          } as any,
          style as any,
        ]}
        {...props}
      >
        {showGlow ? (
          <View
            pointerEvents="none"
            className="absolute inset-x-0 top-0 h-px bg-white/60"
            style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
          />
        ) : null}
        {/* subtle inner bottom veil for bevel depth */}
        <View
          pointerEvents="none"
          className="absolute inset-x-0 bottom-0 h-px bg-slate-100/70"
          style={{ borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }}
        />
        {children}
      </View>
    );
  }

  return (
    <View style={[shadowLayer1 as any, { borderRadius: 20 }]}>
      <View style={[shadowLayer2 as any, { borderRadius: 20 }]}>
        <View
          className={`rounded-card border ${variantStyles[variant]} ${className ?? ''}`}
          style={[
            {
              // micro-borders: 3D bevel — top translucent white, bottom hairline slate-100
              borderTopColor: 'rgba(255,255,255,0.55)',
              borderBottomColor: 'rgba(241,245,249,1)',
              borderLeftColor:
                variant === 'accent' ? 'rgba(99,102,241,0.15)' : 'rgba(148,163,184,0.18)',
              borderRightColor:
                variant === 'accent' ? 'rgba(99,102,241,0.15)' : 'rgba(148,163,184,0.18)',
              // inset top-edge light catch — RN can't do inset shadow, emulate via border + overlay
              ...(Platform.OS === 'ios'
                ? {
                    shadowColor: 'rgba(255,255,255,0.9)',
                    shadowOpacity: 0,
                  }
                : {}),
            } as any,
            style as any,
          ]}
          {...props}
        >
          {/* Inner top-edge white inset: 0 1px 0 rgba(255,255,255,0.6) */}
          {showGlow ? (
            <View
              pointerEvents="none"
              className="absolute inset-x-0 top-0 h-px bg-white/80"
              style={{
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                // extra glow diffusion — second pixel with lower opacity
                shadowColor: '#FFFFFF',
                shadowOpacity: 0,
              }}
            />
          ) : null}
          {/* Second highlight line for premium catch-light (sub-pixel) */}
          {showGlow ? (
            <View
              pointerEvents="none"
              className="absolute inset-x-[1px] top-px h-px bg-white/40"
              style={{ borderRadius: 20 }}
            />
          ) : null}
          {/* Bottom bevel veil — subtle warm slate inner line */}
          <View
            pointerEvents="none"
            className="absolute inset-x-0 bottom-0 h-px bg-slate-100/60"
            style={{ borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }}
          />
          {children}
        </View>
      </View>
    </View>
  );
}
