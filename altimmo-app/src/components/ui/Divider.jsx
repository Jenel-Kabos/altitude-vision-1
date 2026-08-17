import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme';

export default function Divider({ style }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return <View style={[styles.divider, style]} />;
}

const makeStyles = (c) => StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: c.border,
    marginVertical: spacing.md,
  },
});
