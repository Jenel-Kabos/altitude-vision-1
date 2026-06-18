import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../theme';

export default function Badge({ label, color = colors.primary, style }) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: color + '22', borderColor: color },
        style,
      ]}
    >
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  text: {
    ...typography.tiny,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
