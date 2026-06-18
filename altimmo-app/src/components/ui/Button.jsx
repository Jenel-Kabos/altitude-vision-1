import React from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator, View, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../../theme';

export default function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  size = 'md',
}) {
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';
  const isSm = size === 'sm';

  const bgColor = isPrimary ? colors.primary : 'transparent';
  const fgColor = isPrimary ? '#000' : colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.btn,
        isSm && styles.btnSm,
        {
          backgroundColor: bgColor,
          borderColor: isOutline ? colors.primary : 'transparent',
          borderWidth: isOutline ? 1.5 : 0,
        },
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fgColor} size="small" />
      ) : (
        <View style={styles.content}>
          {icon ? (
            typeof icon === 'string'
              ? <Ionicons name={icon} size={isSm ? 14 : 18} color={fgColor} />
              : icon
          ) : null}
          <Text style={[
            styles.label,
            isSm && styles.labelSm,
            { color: fgColor },
          ]}>
            {label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSm: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
  },
  labelSm: {
    fontSize: 13,
  },
});
