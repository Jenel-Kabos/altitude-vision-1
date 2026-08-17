import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function LoadingSpinner({ size = 'large', style }) {
  const { themeColors: c } = useTheme();
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={c.gold} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
