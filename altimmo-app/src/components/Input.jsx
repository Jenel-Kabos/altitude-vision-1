import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, radius, fonts, fontSize, spacing } from '../theme';

export default function Input({
  label,
  error,
  multiline = false,
  style,
  ...props
}) {
  return (
    <View style={style}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          multiline && styles.multiline,
          { borderColor: error ? colors.error : colors.border },
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: colors.textSub,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.bgCardAlt,
    borderRadius: radius.xs,
    borderWidth: 1.5,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: colors.text,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
