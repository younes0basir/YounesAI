import React from 'react';
import { Image, View, type ViewStyle } from 'react-native';

const logo = require('../../../assets/images/icon.png');

interface AppLogoProps {
  size?: number;
  rounded?: number;
  style?: ViewStyle;
}

/** Branded app mark — same artwork as the launcher icon. */
export function AppLogo({ size = 64, rounded = 24, style }: AppLogoProps) {
  return (
    <View
      className="overflow-hidden bg-black"
      style={[{ width: size, height: size, borderRadius: rounded }, style]}
    >
      <Image source={logo} style={{ width: size, height: size }} resizeMode="cover" />
    </View>
  );
}
