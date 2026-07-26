import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../../theme';

export default function Counter({ label, value, onChange, min = 0, max = 99, error }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const current = Number(value) || 0;

  const dec = () => onChange(Math.max(min, current - 1));
  const inc = () => onChange(Math.min(max, current + 1));

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TouchableOpacity
          onPress={dec}
          style={styles.btn}
          accessibilityRole="button"
          accessibilityLabel={`Diminuer ${label}`}
        >
          <Ionicons name="remove" size={16} color={c.gold} />
        </TouchableOpacity>
        <Text style={styles.value}>{current}</Text>
        <TouchableOpacity
          onPress={inc}
          style={styles.btn}
          accessibilityRole="button"
          accessibilityLabel={`Augmenter ${label}`}
        >
          <Ionicons name="add" size={16} color={c.gold} />
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  label: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.text, flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  btn: {
    width: 30, height: 30, borderRadius: radius.xs, borderWidth: 1, borderColor: c.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgCardAlt,
  },
  value: { fontFamily: fonts.bodyBold, fontSize: fontSize.md, color: c.text, minWidth: 24, textAlign: 'center' },
  error: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.error },
});
