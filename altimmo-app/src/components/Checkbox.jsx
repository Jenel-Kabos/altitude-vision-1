import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSize, spacing, radius } from '../theme';

export default function Checkbox({ checked, onPress, label, style }) {
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
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: radius.xs,
          backgroundColor: checked ? colors.gold : colors.bgCardAlt,
          borderWidth: 1.5,
          borderColor: checked ? colors.gold : colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.sm,
        }}
      >
        {checked && (
          <Ionicons name="checkmark" size={14} color={colors.black} />
        )}
      </View>
      {label && (
        <Text
          style={{
            flex: 1,
            fontFamily: fonts.body,
            fontSize: fontSize.sm,
            color: colors.text,
          }}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}
