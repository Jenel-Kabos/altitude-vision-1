import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Checkbox from './Checkbox';
import { useTheme } from '../context/ThemeContext';
import { fonts, fontSize, spacing } from '../theme';
import { MARKETING_CHANNELS, OPERATIONAL_NOTICE } from '../constants/marketingConsent';

// MARKETING-CONSENT-1 — Cases de consentement marketing, jamais précochées.
// Les laisser décochées n'empêche ni l'inscription ni l'usage de l'app.
export default function MarketingConsentFields({ value, onChange, disabled = false }) {
  const { themeColors: c } = useTheme();
  return (
    <View style={styles.wrap} accessibilityLabel="Communications promotionnelles facultatives">
      {MARKETING_CHANNELS.map((channel) => (
        <Checkbox
          key={channel.key}
          checked={value?.[channel.key] === true}
          onPress={() => onChange({ ...value, [channel.key]: !(value?.[channel.key] === true) })}
          label={channel.consentLabel}
          disabled={disabled}
          style={styles.item}
        />
      ))}
      <Text style={[styles.notice, { color: c.textMuted }]}>
        {OPERATIONAL_NOTICE} Vous pouvez modifier ces choix à tout moment dans Profil › Communications.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  item: { marginBottom: spacing.sm },
  notice: { fontFamily: fonts.body, fontSize: fontSize.xs, lineHeight: 16, marginTop: spacing.xs },
});
