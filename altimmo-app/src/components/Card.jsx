import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radius } from '../theme';

export default function Card({ children, style, gold = false, selected = false, disabled = false, error = false, accessibilityLabel }) {
  const { themeColors } = useTheme();

  return (
    <View style={[
      styles.shadow,
      { backgroundColor: themeColors.bgCard },
      Platform.select({
        ios: {
          shadowColor: themeColors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.07,
          shadowRadius: 8,
        },
        android: { elevation: 2 },
      }),
      style,
    ]}>
      <View accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled, selected }} style={[
        styles.card,
        { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
        gold && { borderWidth: 1, borderColor: themeColors.borderGoldFull },
        selected && { borderWidth: 1.5, borderColor: themeColors.borderGoldFull },
        error && { borderWidth: 1.5, borderColor: themeColors.error },
        disabled && { opacity: 0.55 },
      ]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: radius.md,
  },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
