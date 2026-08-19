import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import ProfilScreen from '../ProfilScreen';

// UI-MOB-6 — verrou anti-régression : sur device réel (Samsung SM_S918B), le
// hero Profil reposait uniquement sur le `LinearGradient` décoratif
// (`#0A0A0A → #1C1408 → #2D1E04`) comme source de fond sombre — exactement
// le même anti-pattern que le hero Home (UI-MOB-5). Sur ce device, le
// gradient ne se peint pas ; sans fond de secours, le nom (`#F0EDE8`, quasi
// blanc) et l'email (`rgba(240,237,232,0.75)`) atterrissaient sur le fond
// clair `c.bg` de l'écran — quasi invisibles (prouvé par capture réelle).
// Ce test verrouille la propriété réellement responsable (le fond de secours
// du style `hero`), pas seulement la présence du texte à l'écran — un simple
// `getByText(user.name)` passait déjà avant le correctif, alors que le texte
// était invisible sur device.

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) };
});

jest.mock('expo-image', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  return { Image: (props) => ReactActual.createElement(RN.View, props) };
});

jest.mock('expo-linear-gradient', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  return { LinearGradient: (props) => ReactActual.createElement(RN.View, props) };
});

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true })),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-safe-area-context', () => {
  const RN = require('react-native');
  return { SafeAreaView: RN.View };
});

jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  const chainable = () => new Proxy(() => chainable(), { get: () => chainable() });
  return {
    __esModule: true,
    default: { View: RN.View, Text: RN.Text, createAnimatedComponent: (Component) => Component },
    FadeInDown: chainable(),
    useSharedValue: (v) => ({ value: v }),
    useAnimatedStyle: (fn) => fn(),
    withSpring: (v) => v,
    withTiming: (v) => v,
  };
});

jest.mock('../../../services/api', () => ({ get: jest.fn(() => Promise.resolve({ data: {} })) }));
jest.mock('../../../navigation/navigationSdk', () => ({ resolveMobileDestination: jest.fn() }));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'Altitude Vision', email: 'altitudevis3n@gmail.com', role: 'Admin' },
    logout: jest.fn(),
    updateUser: jest.fn(),
    businessProfiles: null,
    isProprietaireImmobilier: false,
    isExploitantEtablissement: false,
  }),
}));

jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({
    themeColors: require('../../../theme/colors').colors,
    preference: 'light',
    setPreference: jest.fn(),
  }),
}));

const flatten = (style) => StyleSheet.flatten(style);

describe('ProfilScreen — hero identité (régression UI-MOB-6)', () => {
  test('le hero a un fond de secours opaque sous le LinearGradient (cause réelle du nom/email invisibles sur device)', () => {
    render(<ProfilScreen navigation={{}} />);
    const name = screen.getByText('Altitude Vision');
    // Le hero est le grand-parent direct du TouchableOpacity(avatar)/Text(nom) :
    // on remonte jusqu'au container dont le style porte `backgroundColor`.
    let node = name.parent;
    while (node && !flatten(node.props.style)?.backgroundColor) {
      node = node.parent;
    }
    expect(node).not.toBeNull();
    expect(flatten(node.props.style).backgroundColor).toBe('#0A0A0A');
  });

  test('le nom et l’email utilisent des couleurs quasi blanches, cohérentes avec un fond sombre garanti', () => {
    render(<ProfilScreen navigation={{}} />);
    const name = screen.getByText('Altitude Vision');
    const email = screen.getByText('altitudevis3n@gmail.com');
    expect(flatten(name.props.style).color).toBe('#F0EDE8');
    expect(flatten(email.props.style).color).toBe('rgba(240,237,232,0.75)');
  });
});
