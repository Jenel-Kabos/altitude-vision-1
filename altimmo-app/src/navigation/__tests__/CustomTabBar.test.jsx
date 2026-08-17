import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import CustomTabBar from '../CustomTabBar';
import { colors } from '../../theme/colors';
import { colorsDark } from '../../theme/colorsDark';

let mockActiveTheme = colors;

jest.mock('../../components', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  return { HouseIcon: (props) => ReactActual.createElement(RN.Text, props, 'house-icon') };
});

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) };
});

jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  const useSharedValue = (initial) => ({ value: initial });
  const useAnimatedStyle = (fn) => fn();
  const withSpring = (toValue) => toValue;
  const withTiming = (toValue) => toValue;
  return {
    __esModule: true,
    default: { View: RN.View, Text: RN.Text },
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ themeColors: mockActiveTheme }),
}));

const makeState = (index) => ({
  index,
  routes: [
    { key: 'annonces', name: 'Annonces' },
    { key: 'publier', name: 'Publier' },
    { key: 'carte', name: 'Carte' },
    { key: 'profil', name: 'Profil' },
  ],
});

const makeDescriptors = (state) => Object.fromEntries(
  state.routes.map((r) => [r.key, { options: { tabBarAccessibilityLabel: r.name } }]),
);

const navigation = { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() };

describe.each([
  ['clair', colors],
  ['sombre', colorsDark],
])('CustomTabBar — bottom navigation (mandat UI-MOB-2 §12-19), thème %s', (_name, theme) => {
  beforeEach(() => {
    mockActiveTheme = theme;
    jest.clearAllMocks();
  });

  test('rend un item par route, avec accessibilityLabel dédié', () => {
    const state = makeState(0);
    const screen = render(
      <CustomTabBar state={state} descriptors={makeDescriptors(state)} navigation={navigation} />,
    );
    expect(screen.getByLabelText('Annonces')).toBeTruthy();
    expect(screen.getByLabelText('Publier')).toBeTruthy();
    expect(screen.getByLabelText('Carte')).toBeTruthy();
    expect(screen.getByLabelText('Profil')).toBeTruthy();
  });

  test('la tab active est marquée selected, les autres non (règle unique, mandat §15)', () => {
    const state = makeState(2);
    const screen = render(
      <CustomTabBar state={state} descriptors={makeDescriptors(state)} navigation={navigation} />,
    );
    expect(screen.getByLabelText('Carte').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByLabelText('Annonces').props.accessibilityState).toEqual({ selected: false });
    expect(screen.getByLabelText('Profil').props.accessibilityState).toEqual({ selected: false });
  });

  test('le FAB central "Publier" utilise le token onAccent (pas de blanc figé) pour le contraste sur fond primary', () => {
    const state = makeState(0);
    const screen = render(
      <CustomTabBar state={state} descriptors={makeDescriptors(state)} navigation={navigation} />,
    );
    const fabIcon = screen.getByText('add');
    expect(fabIcon.props.color).toBe(theme.onAccent);
  });

  test('appuyer sur une tab inactive déclenche la navigation', () => {
    const state = makeState(0);
    const screen = render(
      <CustomTabBar state={state} descriptors={makeDescriptors(state)} navigation={navigation} />,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Carte' }));
    expect(navigation.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'tabPress', target: 'carte' }));
    expect(navigation.navigate).toHaveBeenCalledWith({ name: 'Carte', merge: true });
  });
});
