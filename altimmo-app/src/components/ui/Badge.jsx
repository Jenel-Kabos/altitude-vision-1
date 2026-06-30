import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { typography, spacing } from '../../theme';

export default function Badge({ label, color, style }) {
  const { themeColors: c } = useTheme();
  const effectiveColor = color ?? c.gold;
  const styles = useMemo(() => makeStyles(), []);

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: effectiveColor + '22', borderColor: effectiveColor },
        style,
      ]}
    >
      <Text style={[styles.text, { color: effectiveColor }]}>{label}</Text>
    </View>
  );
}

const makeStyles = () => StyleSheet.create({
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
