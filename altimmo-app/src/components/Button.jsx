import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { colors, radius, fonts, fontSize, spacing } from '../theme';

export default function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}) {
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';
  const isGhost   = variant === 'ghost';

  const containerStyle = [
    styles.base,
    isPrimary && styles.primary,
    isOutline && styles.outline,
    isGhost   && styles.ghost,
    (disabled || loading) && styles.disabled,
    style,
  ];

  const textStyle = [
    styles.label,
    isPrimary && styles.labelPrimary,
    (isOutline || isGhost) && styles.labelGold,
  ];

  const spinnerColor = isPrimary ? '#000' : colors.gold;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={containerStyle}
    >
      {loading
        ? <ActivityIndicator color={spinnerColor} />
        : <Text style={textStyle}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  primary: {
    backgroundColor: colors.gold,
  },
  outline: {
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'transparent',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
  },
  labelPrimary: {
    color: colors.black,
  },
  labelGold: {
    color: colors.gold,
  },
});
