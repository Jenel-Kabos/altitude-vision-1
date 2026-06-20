import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

export default function Card({ children, style, gold = false, selected = false }) {
  return (
    <View
      style={[
        styles.card,
        gold && { borderColor: colors.borderGoldFull },
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
    borderRadius: radius.none,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  selected: {
    borderColor: colors.borderGoldFull,
    borderWidth: 1.5,
    borderBottomWidth: 1.5,
  },
});
