import React, { useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radius, fonts, fontSize, spacing } from '../theme';

export default function Chip({ label, active = false, onPress, small = false, disabled = false }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      style={[
        styles.chip,
        small && styles.chipSmall,
        active && styles.chipActive,
        disabled && styles.chipDisabled,
      ]}
    >
      <Text style={[styles.label, active && styles.labelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const makeStyles = (c) => StyleSheet.create({
  chip: {
    borderRadius: radius.xs,
    borderWidth: 1.5,
    borderColor: c.inputBorder,
    backgroundColor: c.bgCardAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipSmall: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
  },
  chipActive: {
    borderColor: c.borderGoldFull,
    backgroundColor: c.goldMuted,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.text,
  },
  labelActive: {
    fontFamily: fonts.bodyBold,
    color: c.gold,
  },
});
