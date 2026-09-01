import React from 'react';
import { Image, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';

cssInterop(LinearGradient, { className: 'style' });

const logo = require('../../../assets/images/icon.png');

interface AppLogoProps {
  size?: number;
  rounded?: number;
  style?: ViewStyle;
}

/** Branded app mark — dual shadow + bevel + specular highlight. */
export function AppLogo({ size = 64, rounded = 24, style }: AppLogoProps) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: rounded,
          shadowColor: '#0F172A',
          shadowOpacity: 0.09,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        },
        style,
      ]}
    >
      <View
        style={{
          flex: 1,
          borderRadius: rounded,
          shadowColor: '#6366F1',
          shadowOpacity: 0.08,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
          elevation: 8,
        }}
      >
        <View
          className="overflow-hidden border bg-black"
          style={{
            width: size,
            height: size,
            borderRadius: rounded,
            borderTopColor: 'rgba(255,255,255,0.5)',
            borderBottomColor: 'rgba(241,245,249,0.8)',
            borderLeftColor: 'rgba(255,255,255,0.2)',
            borderRightColor: 'rgba(255,255,255,0.2)',
          }}
        >
          {/* specular top */}
          <View
            pointerEvents="none"
            className="absolute inset-x-0 top-0 h-px bg-white/20"
            style={{ borderTopLeftRadius: rounded, borderTopRightRadius: rounded }}
          />
          <Image source={logo} style={{ width: size, height: size }} resizeMode="cover" />
          {/* inner glow */}
          <LinearGradient
            colors={['rgba(255,255,255,0.14)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 0.5 }}
            style={{ position: 'absolute', inset: 0, opacity: 0.7 }}
            pointerEvents="none"
          />
        </View>
      </View>
    </View>
  );
}
