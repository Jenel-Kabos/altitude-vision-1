import React, { useMemo } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radius, fonts, fontSize, spacing } from '../theme';

export default function Input({
  label,
  error,
  multiline = false,
  style,
  ...props
}) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={style}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        accessibilityLabel={label || props.placeholder}
        {...props}
        multiline={multiline}
        placeholderTextColor={c.textMuted}
        style={[
          styles.input,
          multiline && styles.multiline,
          { borderColor: error ? c.error : c.border },
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: c.textSub,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: c.bgCardAlt,
    borderRadius: radius.xs,
    borderWidth: 1.5,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: c.text,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.error,
    marginTop: spacing.xs,
  },
});
