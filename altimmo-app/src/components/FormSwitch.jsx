import React from 'react';
import { Switch } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function FormSwitch({ value, disabled = false, accessibilityLabel, ...props }) {
  const { themeColors: c } = useTheme();

  return (
    <Switch
      {...props}
      value={value}
      disabled={disabled}
      trackColor={{ false: c.inputBorder, true: c.gold }}
      thumbColor={value ? c.onAccent : c.bgCard}
      ios_backgroundColor={c.inputBorder}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: !!value, disabled }}
    />
  );
}
