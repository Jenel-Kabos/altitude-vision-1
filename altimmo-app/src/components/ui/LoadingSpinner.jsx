import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../../theme';

export default function LoadingSpinner({ size = 'large', style }) {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={colors.gold} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
