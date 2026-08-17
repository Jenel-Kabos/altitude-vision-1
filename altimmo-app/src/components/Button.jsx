import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { radius, fonts, fontSize, spacing } from '../theme';

export default function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
  testID,
}) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';
  const isGhost   = variant === 'ghost';
  const isSecondary = variant === 'secondary';
  const isDanger = variant === 'danger';
  const isSuccess = variant === 'success';

  const containerStyle = [
    styles.base,
    isPrimary && styles.primary,
    isOutline && styles.outline,
    isGhost   && styles.ghost,
    isSecondary && styles.secondary,
    isDanger && styles.danger,
    isSuccess && styles.success,
    (disabled || loading) && styles.disabled,
    style,
  ];

  const textStyle = [
    styles.label,
    isPrimary && styles.labelPrimary,
    (isOutline || isGhost) && styles.labelGold,
    isSecondary && styles.labelSecondary,
    (isDanger || isSuccess) && styles.labelStatus,
  ];

  const spinnerColor = isPrimary ? c.onAccent : isDanger || isSuccess ? c.bg : c.gold;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      testID={testID}
      style={containerStyle}
    >
      {loading
        ? <ActivityIndicator color={spinnerColor} />
        : <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={18} color={StyleSheet.flatten(textStyle).color} /> : null}
          <Text style={textStyle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{label}</Text>
        </View>}
    </TouchableOpacity>
  );
}

const makeStyles = (c) => StyleSheet.create({
  base: {
    borderRadius: radius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 88,
  },
  primary: {
    backgroundColor: c.gold,
  },
  outline: {
    borderWidth: 1,
    borderColor: c.gold,
    backgroundColor: 'transparent',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  secondary: { backgroundColor: c.bgCardAlt, borderWidth: 1, borderColor: c.inputBorder },
  danger: { backgroundColor: c.error },
  success: { backgroundColor: c.success },
  disabled: {
    opacity: 0.5,
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
  },
  labelPrimary: {
    color: c.onAccent,
  },
  labelGold: {
    color: c.gold,
  },
  labelSecondary: { color: c.text },
  labelStatus: { color: c.bg },
});
