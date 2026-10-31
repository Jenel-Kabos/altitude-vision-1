// ALTIMMO-AI-01 — accès visible à l’assistant depuis l’accueil (sans connexion). Affiché par
// ListeAnnoncesScreen uniquement si le serveur confirme l’activation (AI-INTEGRATION-02).
import React, { useMemo } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../theme';

export default function AssistantEntryCard({ onPress, refine = false }) {
  const title = refine ? 'Affiner avec l’assistant' : 'Trouver mon bien avec l’assistant';
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable onPress={onPress} style={styles.card} accessibilityRole="button" accessibilityLabel={title} testID="assistant-entry">
      <View style={styles.icon}><Ionicons name="sparkles-outline" size={22} color={c.gold} /></View>
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{refine ? 'L’assistant reprend vos filtres pour affiner la recherche.' : 'Achat, location ou hébergement : décrivez votre recherche.'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
    </Pressable>
  );
}

const makeStyles = (c) => StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.md, marginVertical: spacing.xs, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.gold },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.goldLight || c.goldMuted },
  texts: { flex: 1 },
  title: { fontFamily: fonts.bodyBold, fontSize: fontSize.md, color: c.text },
  subtitle: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.textMuted, marginTop: 2 },
});
