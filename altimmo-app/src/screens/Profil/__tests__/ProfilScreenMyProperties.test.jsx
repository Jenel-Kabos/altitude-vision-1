import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import ProfilScreen from '../ProfilScreen';

// HOTFIX-MOB-PROFILE-MY-PROPERTIES-LINK-1 — la section "Mes biens" (avec sa
// ligne "Mes annonces" → route existante `MesAnnonces`) existait déjà dans
// ProfilScreen.jsx mais restait invisible pour un compte de rôle
// `Proprietaire` n'ayant pas encore de bien publié (businessProfiles chargé
// à [], isProprietaireImmobilier=false) — voir
// server/docs/HOTFIX_MOB_PROFILE_MY_PROPERTIES_LINK1_ETAT_INITIAL.md. Ce
// test reproduit exactement ce scénario réel (pas une fixture inventée).

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

jest.mock('../../../services/api', () => ({ get: jest.fn(() => Promise.resolve({ data: { data: { properties: [] } } })) }));
jest.mock('../../../navigation/navigationSdk', () => ({ resolveMobileDestination: jest.fn() }));

jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({
    themeColors: require('../../../theme/colors').colors,
    preference: 'light',
    setPreference: jest.fn(),
  }),
}));

let mockAuth;
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const baseAuth = (overrides = {}) => ({
  user: { name: 'Jean Moukala', email: 'jean@example.test', role: 'Proprietaire' },
  logout: jest.fn(),
  updateUser: jest.fn(),
  businessProfiles: [],
  isProprietaireImmobilier: false,
  isExploitantEtablissement: false,
  ...overrides,
});

describe('ProfilScreen — "Mes biens" (régression HOTFIX-MOB-PROFILE-MY-PROPERTIES-LINK-1)', () => {
  const navigation = { navigate: jest.fn() };

  beforeEach(() => {
    navigation.navigate.mockClear();
  });

  test('un compte Proprietaire sans bien encore publié (businessProfiles=[], isProprietaireImmobilier=false) voit "Mes biens"', () => {
    mockAuth = baseAuth();
    render(<ProfilScreen navigation={navigation} />);
    expect(screen.getByText('Mes biens')).toBeTruthy();
    expect(screen.getByText('Mes annonces')).toBeTruthy();
  });

  test('appuyer sur "Mes annonces" navigue vers la vraie route existante MesAnnonces', () => {
    mockAuth = baseAuth();
    render(<ProfilScreen navigation={navigation} />);
    fireEvent.press(screen.getByText('Mes annonces'));
    expect(navigation.navigate).toHaveBeenCalledWith('MesAnnonces');
  });

  test('un compte Proprietaire avec profil métier dérivé (bien déjà publié) voit aussi "Mes biens" (non régressé)', () => {
    mockAuth = baseAuth({ businessProfiles: ['proprietaire_immobilier'], isProprietaireImmobilier: true });
    render(<ProfilScreen navigation={navigation} />);
    expect(screen.getByText('Mes biens')).toBeTruthy();
  });

  test('un compte Client sans profil métier dérivé ne voit pas "Mes biens" (comportement existant préservé)', () => {
    mockAuth = baseAuth({
      user: { name: 'Client Test', email: 'client@example.test', role: 'Client' },
    });
    render(<ProfilScreen navigation={navigation} />);
    expect(screen.queryByText('Mes biens')).toBeNull();
  });

  test('Admin voit toujours "Mes biens" (bypass existant préservé)', () => {
    mockAuth = baseAuth({ user: { name: 'Admin Test', email: 'admin@example.test', role: 'Admin' } });
    render(<ProfilScreen navigation={navigation} />);
    expect(screen.getByText('Mes biens')).toBeTruthy();
  });

  test('la section Activité et ses entrées ne sont pas régressées', () => {
    mockAuth = baseAuth();
    render(<ProfilScreen navigation={navigation} />);
    expect(screen.getByText('Activité')).toBeTruthy();
    expect(screen.getByText('Espace locataire')).toBeTruthy();
    expect(screen.getByText('Mes documents')).toBeTruthy();
    expect(screen.getByText('Mes favoris')).toBeTruthy();
    expect(screen.getByText('Mes transactions')).toBeTruthy();
    expect(screen.getByText('Mes offres et candidatures')).toBeTruthy();
    expect(screen.getByText('Mes réservations hôtel')).toBeTruthy();
    expect(screen.getByText('Mes hébergements')).toBeTruthy();
  });

  test('aucune entrée "Mes biens" dupliquée : une seule occurrence du titre de section', () => {
    mockAuth = baseAuth();
    render(<ProfilScreen navigation={navigation} />);
    expect(screen.getAllByText('Mes biens')).toHaveLength(1);
    expect(screen.getAllByText('Mes annonces')).toHaveLength(1);
  });
});
