import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, radius, fonts, fontSize, spacing } from '../theme';

export default function Chip({ label, active = false, onPress, small = false }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.chip,
        small && styles.chipSmall,
        {
          borderColor: active ? colors.borderGoldFull : colors.border,
          backgroundColor: active ? colors.goldMuted : 'transparent',
        },
      ]}
    >
      <Text
        style={{
          fontFamily: active ? fonts.bodyBold : fonts.body,
          fontSize: fontSize.sm,
          color: active ? colors.gold : colors.textMuted,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.xs,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipSmall: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
  },
});
