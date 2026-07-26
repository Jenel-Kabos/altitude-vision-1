import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../../theme';

export default function StepHeader({ title, stepIndex, stepCount, onBack, onClose }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const progress = stepCount > 0 ? (stepIndex + 1) / stepCount : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          style={styles.iconBtn}
        >
          <Ionicons name="arrow-back" size={20} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.stepCount}>Étape {stepIndex + 1} / {stepCount}</Text>
        {onClose ? (
          <TouchableOpacity
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            style={styles.iconBtn}
          >
            <Ionicons name="close" size={20} color={c.textMuted} />
          </TouchableOpacity>
        ) : <View style={styles.iconBtn} />}
      </View>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepCount: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
  title: {
    fontFamily: fonts.displaySemi,
    fontSize: fontSize.lg,
    color: c.text,
    marginBottom: spacing.sm,
  },
  progressTrack: {
    height: 4,
    borderRadius: radius.xs,
    backgroundColor: c.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: c.gold,
    borderRadius: radius.xs,
  },
});
