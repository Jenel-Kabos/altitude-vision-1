import React, { useMemo } from 'react';
import {
  Pressable, Text, ActivityIndicator, View, StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { typography, spacing } from '../../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  size = 'md',
  style,
}) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';
  const isSm = size === 'sm';

  const bgColor = isPrimary ? c.gold : 'transparent';
  const fgColor = isPrimary ? c.onAccent : c.gold;

  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(0.95, { damping: 10, stiffness: 400 });
  };

  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 400 });
  };

  const handlePress = () => {
    if (isPrimary) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading }}
      style={[
        animStyle,
        styles.btn,
        isSm && styles.btnSm,
        {
          backgroundColor: bgColor,
          borderColor: isOutline ? c.gold : 'transparent',
          borderWidth: isOutline ? 1.5 : 0,
        },
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        style,
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
    </AnimatedPressable>
  );
}

const makeStyles = () => StyleSheet.create({
  btn: {
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  btnSm: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 36,
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
