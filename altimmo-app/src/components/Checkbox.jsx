import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { fonts, fontSize, spacing, radius } from '../theme';

export default function Checkbox({ checked, onPress, label, style }) {
  const { themeColors: c } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.xs,
        },
        style,
      ]}
      activeOpacity={0.8}
      accessibilityRole="checkbox"
      accessibilityLabel={label || 'Case à cocher'}
      accessibilityState={{ checked: !!checked }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: radius.xs,
          backgroundColor: checked ? c.gold : c.bgCardAlt,
          borderWidth: 1.5,
          borderColor: checked ? c.gold : c.border,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.sm,
        }}
      >
        {checked && (
          <Ionicons name="checkmark" size={14} color="#0A0A0A" />
        )}
      </View>
      {label && (
        <Text
          style={{
            flex: 1,
            fontFamily: fonts.body,
            fontSize: fontSize.sm,
            color: c.text,
          }}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}
