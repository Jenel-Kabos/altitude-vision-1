import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

export default function Card({ children, style, gold = false, selected = false }) {
  return (
    <View
      style={[
        styles.card,
        gold && styles.gold,
        selected && styles.selected,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  gold: {
    borderWidth: 1,
    borderColor: colors.borderGoldFull,
  },
  selected: {
    borderWidth: 1.5,
    borderColor: colors.borderGoldFull,
  },
});
