import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, radius, spacing } from '../../theme';

const formatMoney = (value, currency) => `${Number(value || 0).toLocaleString('fr-FR')} ${currency || 'XAF'}`;

// PHASE-H1 — même patron que la barre CTA fixe de DetailAnnonceScreen.jsx
// (SafeAreaView position absolute, bottom). N'affiche un prix que si une
// valeur réelle existe (jamais un prix inventé).
export default function HotelBookingStickyBar({ priceFrom, currency, onPress, label = 'Choisir une chambre', disabled = false }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.row}>
        <View style={styles.priceCol}>
          {priceFrom != null ? (
            <>
              <Text style={styles.priceLabel}>À partir de</Text>
              <Text style={styles.priceValue}>{formatMoney(priceFrom, currency)}<Text style={styles.priceUnit}> / nuit</Text></Text>
            </>
          ) : (
            <Text style={styles.priceLabel}>Tarifs sur demande</Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.cta, disabled && styles.ctaDisabled]}
          onPress={onPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          <Text style={styles.ctaText}>{label}</Text>
          <Ionicons name="arrow-forward" size={16} color={c.onAccent} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: c.bgCard, borderTopWidth: 1, borderTopColor: c.border },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  priceCol: { flexShrink: 1 },
  priceLabel: { fontFamily: fonts.body, fontSize: fontSize.xs, color: c.textMuted },
  priceValue: { fontFamily: fonts.bodyBold, fontSize: fontSize.lg, color: c.gold },
  priceUnit: { fontFamily: fonts.body, fontSize: fontSize.sm, color: c.textSub },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.primary,
    paddingVertical: 13, paddingHorizontal: spacing.md, borderRadius: radius.xs,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: fontSize.sm, color: c.onAccent },
});
