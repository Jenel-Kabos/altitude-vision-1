import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import { colorsDark } from '../theme/colorsDark';

const STORAGE_KEY = 'theme_preference';

const ThemeContext = createContext({
  isDark: false,
  themeColors: colors,
  preference: 'system',
  setPreference: () => {},
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === 'dark' || val === 'light' || val === 'system') {
        setPreferenceState(val);
      }
    });
  }, []);

  const setPreference = async (value) => {
    setPreferenceState(value);
    await AsyncStorage.setItem(STORAGE_KEY, value);
  };

  const isDark =
    preference === 'dark' ||
    (preference === 'system' && systemScheme === 'dark');

  const themeColors = isDark ? colorsDark : colors;

  return (
    <ThemeContext.Provider value={{ isDark, themeColors, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
