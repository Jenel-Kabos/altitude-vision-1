import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import * as RN from 'react-native';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useTheme } from '../ThemeContext';
import { colors } from '../../theme/colors';
import { colorsDark } from '../../theme/colorsDark';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

let mockSystemScheme = 'light';
jest.spyOn(RN, 'useColorScheme').mockImplementation(() => mockSystemScheme);

function Probe() {
  const { isDark, themeColors, preference, setPreference } = useTheme();
  return (
    <>
      <Text testID="preference">{preference}</Text>
      <Text testID="isDark">{String(isDark)}</Text>
      <Text testID="bg">{themeColors.bg}</Text>
      <TouchableOpacity accessibilityLabel="Mode Sombre" onPress={() => setPreference('dark')} />
      <TouchableOpacity accessibilityLabel="Mode Clair" onPress={() => setPreference('light')} />
      <TouchableOpacity accessibilityLabel="Mode Système" onPress={() => setPreference('system')} />
    </>
  );
}

describe('ThemeContext — System/Light/Dark (mandat UI-MOB-1 §8, non régressé UI-MOB-2)', () => {
  beforeEach(async () => {
    mockSystemScheme = 'light';
    await AsyncStorage.clear();
  });

  test('par défaut, suit le thème système (aucune préférence enregistrée)', async () => {
    mockSystemScheme = 'dark';
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('preference').props.children).toBe('system'));
    expect(screen.getByTestId('isDark').props.children).toBe('true');
    expect(screen.getByTestId('bg').props.children).toBe(colorsDark.bg);
  });

  test('un choix explicite "dark" est appliqué et persisté, indépendamment du système', async () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('preference').props.children).toBe('system'));

    fireEvent.press(screen.getByLabelText('Mode Sombre'));
    await waitFor(() => expect(screen.getByTestId('isDark').props.children).toBe('true'));
    expect(screen.getByTestId('bg').props.children).toBe(colorsDark.bg);
    expect(await AsyncStorage.getItem('theme_preference')).toBe('dark');
  });

  test('un choix explicite "light" reste clair même si le système est sombre', async () => {
    mockSystemScheme = 'dark';
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('preference').props.children).toBe('system'));

    fireEvent.press(screen.getByLabelText('Mode Clair'));
    await waitFor(() => expect(screen.getByTestId('isDark').props.children).toBe('false'));
    expect(screen.getByTestId('bg').props.children).toBe(colors.bg);
  });

  test('une préférence enregistrée est restaurée au montage', async () => {
    await AsyncStorage.setItem('theme_preference', 'dark');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId('preference').props.children).toBe('dark'));
    expect(screen.getByTestId('isDark').props.children).toBe('true');
  });
});
