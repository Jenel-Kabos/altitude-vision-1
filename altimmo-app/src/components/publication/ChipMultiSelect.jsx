import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Chip from '../Chip';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing } from '../../theme';

// Sélecteur de chips (simple ou multiple), avec label et message d'erreur —
// partagé par les 3 parcours (type de bien, ville, arrondissement, commodités,
// profils/documents, catégorie hébergement…).
export default function ChipMultiSelect({
  label, options, value, onChange, multiple = false, error, getLabel = (o) => o.label ?? o,
  getValue = (o) => o.value ?? o,
}) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const isActive = (optValue) => (multiple
    ? Array.isArray(value) && value.includes(optValue)
    : value === optValue);

  const toggle = (optValue) => {
    if (multiple) {
      const current = Array.isArray(value) ? value : [];
      const next = current.includes(optValue)
        ? current.filter((v) => v !== optValue)
        : [...current, optValue];
      onChange(next);
    } else {
      onChange(optValue);
    }
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.chipsRow}>
        {options.map((opt) => {
          const optValue = getValue(opt);
          return (
            <Chip
              key={String(optValue)}
              label={getLabel(opt)}
              active={isActive(optValue)}
              onPress={() => toggle(optValue)}
            />
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: c.textSub,
    marginBottom: spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.error,
    marginTop: spacing.xs,
  },
});
