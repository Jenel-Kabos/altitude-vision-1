import React, { useMemo } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../../theme';

export default function SelectableCard({ icon, title, description, selected, onPress, compact = false }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected: !!selected }}
      style={[
        styles.card,
        compact && styles.cardCompact,
        selected && styles.cardSelected,
      ]}
    >
      {icon ? (
        <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
          <Ionicons name={icon} size={compact ? 18 : 24} color={selected ? c.gold : c.textMuted} />
        </View>
      ) : null}
      <View style={styles.textWrap}>
        <Text style={[styles.title, selected && styles.titleSelected]} numberOfLines={compact ? 2 : 1}>
          {title}
        </Text>
        {description ? (
          <Text style={styles.description} numberOfLines={2}>{description}</Text>
        ) : null}
      </View>
      {selected ? (
        <Ionicons name="checkmark-circle" size={20} color={c.gold} />
      ) : null}
    </TouchableOpacity>
  );
}

const makeStyles = (c) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bgCard,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: c.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  cardCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  cardSelected: {
    borderColor: c.gold,
    backgroundColor: c.goldMuted,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.xs,
    backgroundColor: c.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSelected: {
    backgroundColor: 'transparent',
  },
  textWrap: { flex: 1 },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: c.text,
  },
  titleSelected: { color: c.gold },
  description: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textMuted,
    marginTop: 2,
  },
});
