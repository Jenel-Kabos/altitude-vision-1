import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { typography, spacing } from '../../theme';
import Button from './Button';

export default function EmptyState({
  // Soit une illustration SVG (composant React), soit une icône Ionicons fallback
  illustration,
  icon = 'document-outline',
  title,
  subtitle,
  actionLabel,
  onAction,
}) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const Illustration = illustration;

  return (
    <View style={styles.container}>
      {Illustration ? (
        <Illustration
          size={160}
          gold={c.gold}
          muted={c.textMuted}
          bg={c.bgCardAlt}
        />
      ) : (
        <Ionicons name={icon} size={64} color={c.textMuted} />
      )}
      {title    ? <Text style={styles.title}>{title}</Text>       : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} variant="outline" />
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    ...typography.h2,
    color: c.text,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: c.textSub,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  action: {
    marginTop: spacing.xl,
  },
});
