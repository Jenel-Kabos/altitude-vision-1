import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

export default function Card({ children, style, gold = false }) {
  return (
    <View
      style={[
        styles.card,
        gold && { borderColor: colors.borderGoldFull },
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
});
