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
  // UI-MOB-5.1 — pour un EmptyState utilisé comme ListEmptyComponent sous un
  // header déjà volumineux (ex: Home), l'empreinte verticale par défaut
  // (illustration 160 + paddings/gaps larges) pousse le titre/sous-titre
  // significativement sous le pli visible sur un device réel (mesuré : sur
  // Samsung SM_S918B, header 460.8dp + gap 20dp dans un viewport FlatList de
  // 589.9dp ne laisse que ~109dp — le texte n'était pas invisible (il est
  // bien monté, dimensionné, contrasté — prouvé par capture après scroll),
  // mais il fallait faire défiler pour l'atteindre. `compact` réduit
  // l'illustration et les espacements pour rapprocher le texte du pli, sans
  // toucher aux 10+ autres écrans qui utilisent EmptyState en plein écran
  // (défaut `compact=false` strictement identique au comportement historique).
  compact = false,
}) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c, compact), [c, compact]);

  const Illustration = illustration;
  const illustrationSize = compact ? 104 : 160;

  return (
    <View style={styles.container} testID="empty-state-container">
      {Illustration ? (
        <Illustration
          size={illustrationSize}
          gold={c.gold}
          muted={c.textMuted}
          bg={c.bgCardAlt}
        />
      ) : (
        <Ionicons name={icon} size={compact ? 48 : 64} color={c.textMuted} />
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

const makeStyles = (c, compact) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: compact ? spacing.md : spacing.xl,
  },
  title: {
    ...typography.h2,
    color: c.text,
    marginTop: compact ? spacing.md : spacing.lg,
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
