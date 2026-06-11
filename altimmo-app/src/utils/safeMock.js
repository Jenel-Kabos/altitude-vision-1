import React from 'react';
import { View } from 'react-native';

export const SafeAreaProvider = ({ children }) => (
  <View style={{ flex: 1 }}>{children}</View>
);

export const SafeAreaView = ({ children, style }) => (
  <View style={[{ flex: 1 }, style]}>{children}</View>
);

export const useSafeAreaInsets = () => ({
  top: 0, bottom: 0, left: 0, right: 0,
});
