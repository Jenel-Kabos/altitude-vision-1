import React from 'react';
import { render } from '@testing-library/react-native';
import CustomTabBar from '../CustomTabBar';
import { colors } from '../../theme/colors';

// UI-MOB-5 — verrou anti-régression : sur un Android à navigation 3 boutons
// (device réel testé : Samsung Galaxy, `insets.bottom` ≈ 135px), l'ancien
// `bottomPad` Android fixe (8px, ignorait `insets.bottom`) laissait la moitié
// basse de la tab bar dessinée SOUS la barre de navigation système — les taps
// dans cette zone étaient interceptés par la fenêtre système, jamais reçus par
// l'app (reproduit sur device réel : les onglets restaient inatteignables).

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

jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ themeColors: require('../../theme/colors').colors }),
}));

const mockUseSafeAreaInsets = jest.fn();
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockUseSafeAreaInsets(),
}));

const makeState = (index) => ({
  index,
  routes: [
    { key: 'annonces', name: 'Annonces' },
    { key: 'profil', name: 'Profil' },
  ],
});

const makeDescriptors = (state) => Object.fromEntries(
  state.routes.map((r) => [r.key, { options: { tabBarAccessibilityLabel: r.name } }]),
);

const navigation = { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() };

function flattenPaddingBottom(style) {
  const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
  return flat.paddingBottom;
}

describe('CustomTabBar — zone sûre Android (régression UI-MOB-5)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('sur un Android à navigation 3 boutons (insets.bottom > 8), la tab bar réserve le vrai inset au lieu d’un padding fixe de 8', () => {
    mockUseSafeAreaInsets.mockReturnValue({ top: 0, bottom: 135, left: 0, right: 0 });
    const state = makeState(0);
    const screen = render(
      <CustomTabBar state={state} descriptors={makeDescriptors(state)} navigation={navigation} />,
    );
    const bar = screen.getByTestId('custom-tab-bar');
    expect(flattenPaddingBottom(bar.props.style)).toBe(135);
  });

  test('sur un Android à navigation gestuelle (insets.bottom = 0), le plancher de 8px est conservé (pas de régression)', () => {
    mockUseSafeAreaInsets.mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 });
    const state = makeState(0);
    const screen = render(
      <CustomTabBar state={state} descriptors={makeDescriptors(state)} navigation={navigation} />,
    );
    const bar = screen.getByTestId('custom-tab-bar');
    expect(flattenPaddingBottom(bar.props.style)).toBe(8);
  });
});
