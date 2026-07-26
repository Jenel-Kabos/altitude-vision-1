import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../theme';

export default function Checkbox({ checked, onPress, label, style, disabled = false, error }) {
  const { themeColors: c } = useTheme();
  return (
    <View style={style}>
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}
        activeOpacity={0.8}
        accessibilityRole="checkbox"
        accessibilityLabel={label || 'Case à cocher'}
        accessibilityState={{ checked: !!checked, disabled, invalid: !!error }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: radius.xs,
            backgroundColor: checked ? c.gold : c.bgCardAlt,
            borderWidth: 1.5,
            borderColor: error ? c.error : checked ? c.gold : c.inputBorder,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing.sm,
          }}
        >
          {checked && <Ionicons name="checkmark" size={14} color={c.onAccent} />}
        </View>
        {label && (
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.body,
              fontSize: fontSize.sm,
              color: disabled ? c.disabledText : c.text,
            }}
          >
            {label}
          </Text>
        )}
      </TouchableOpacity>
      {error ? <Text accessibilityLiveRegion="polite" style={{ color: c.error, fontFamily: fonts.body, fontSize: fontSize.xs }}>{error}</Text> : null}
    </View>
  );
}
