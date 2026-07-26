import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radius, fonts, fontSize, spacing } from '../theme';

export default function Input({
  label,
  error,
  helperText,
  multiline = false,
  disabled = false,
  readOnly = false,
  style,
  inputStyle,
  onFocus,
  onBlur,
  ...props
}) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [focused, setFocused] = useState(false);
  const isDisabled = disabled || props.editable === false;

  return (
    <View style={style}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        accessibilityLabel={label || props.placeholder}
        accessibilityState={{ disabled: isDisabled, invalid: !!error }}
        {...props}
        editable={!disabled && props.editable !== false}
        readOnly={readOnly}
        multiline={multiline}
        placeholderTextColor={c.placeholder}
        cursorColor={c.gold}
        selectionColor={c.borderGold}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          multiline && styles.multiline,
          focused && styles.focused,
          isDisabled && styles.disabled,
          readOnly && styles.readOnly,
          error && styles.invalid,
          inputStyle,
        ]}
      />
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      {!error && helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
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
    borderWidth: 1,
    borderColor: c.inputBorder,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: c.text,
    minHeight: 48,
  },
  focused: { borderWidth: 2, borderColor: c.focusRing },
  invalid: { borderWidth: 2, borderColor: c.error },
  disabled: { backgroundColor: c.bgCardAlt, color: c.disabledText, opacity: 0.72 },
  readOnly: { backgroundColor: c.bgCard, color: c.textSub },
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
  helper: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textSub,
    marginTop: spacing.xs,
  },
});
