import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radius } from '../theme';

export default function Card({ children, style, gold = false, selected = false }) {
  const { themeColors } = useTheme();

  return (
    <View style={[
      styles.shadow,
      { backgroundColor: themeColors.bgCard },
      Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.07,
          shadowRadius: 8,
        },
        android: { elevation: 2 },
      }),
      style,
    ]}>
      <View style={[
        styles.card,
        { backgroundColor: themeColors.bgCard },
        gold && { borderWidth: 1, borderColor: themeColors.borderGoldFull },
        selected && { borderWidth: 1.5, borderColor: themeColors.borderGoldFull },
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
    overflow: 'hidden',
  },
});
