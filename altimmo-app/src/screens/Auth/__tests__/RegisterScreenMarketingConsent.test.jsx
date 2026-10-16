// MARKETING-CONSENT-1 — l'inscription mobile envoie un consentement marketing
// uniquement si l'utilisateur coche explicitement une case (jamais précochée),
// et l'inscription reste possible sans aucune case cochée.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import RegisterScreen from '../RegisterScreen';

const mockRegister = jest.fn(() => Promise.resolve());

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  const Icon = (props) => ReactActual.createElement(RN.Text, props, props.name);
  return { Ionicons: Icon, AntDesign: Icon };
});
jest.mock('expo-linear-gradient', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  return { LinearGradient: (props) => ReactActual.createElement(RN.View, props) };
});
jest.mock('react-native-safe-area-context', () => {
  const RN = require('react-native');
  return { SafeAreaView: RN.View };
});
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  const chainable = () => new Proxy(() => chainable(), { get: () => chainable() });
  return {
    __esModule: true,
    default: { View: RN.View, Text: RN.Text, ScrollView: RN.ScrollView, createAnimatedComponent: (Component) => Component },
    FadeInDown: chainable(), FadeIn: chainable(), FadeInUp: chainable(),
    useSharedValue: (v) => ({ value: v }), useAnimatedStyle: (fn) => fn(), withSpring: (v) => v, withTiming: (v) => v,
  };
});
jest.mock('@miblanchard/react-native-slider', () => ({ Slider: () => null }));
jest.mock('../../../components/illustrations/ImmobilierHero', () => () => null);
jest.mock('../../../services/googleSignIn', () => ({
  configureGoogleSignIn: jest.fn(), getGoogleSignInDiagnostic: jest.fn(), getGoogleSignInErrorMessage: jest.fn(), signInWithGoogle: jest.fn(),
}));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ register: mockRegister, loginWithGoogle: jest.fn() }) }));
jest.mock('../../../context/ThemeContext', () => ({ useTheme: () => ({ themeColors: require('../../../theme/colors').colors, isDark: false }) }));

const fillStep1 = () => {
  fireEvent.changeText(screen.getByLabelText('Nom complet'), 'Awa Test');
  fireEvent.changeText(screen.getByLabelText('Adresse email'), 'Awa@Example.test');
  fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'Password123!');
  fireEvent.changeText(screen.getByLabelText('Confirmer le mot de passe'), 'Password123!');
  fireEvent.press(screen.getByText('Suivant'));
};

beforeEach(() => mockRegister.mockClear());

test('inscription sans case cochée : aucun consentement, inscription non bloquée', async () => {
  render(<RegisterScreen navigation={{ navigate: jest.fn(), goBack: jest.fn() }} />);
  fillStep1();
  const emailConsent = screen.getByLabelText(/recevoir par e-mail les offres/);
  expect(emailConsent.props.accessibilityState.checked).toBe(false);
  fireEvent.press(screen.getByText("S'inscrire"));
  await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
  expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining({
    name: 'Awa Test', email: 'awa@example.test', role: 'Client', marketingConsent: { email: false, push: false },
  }));
});

test('consentement explicite par canal : seule la case cochée est transmise à true', async () => {
  render(<RegisterScreen navigation={{ navigate: jest.fn(), goBack: jest.fn() }} />);
  fillStep1();
  fireEvent.press(screen.getByLabelText(/recevoir par e-mail les offres/));
  fireEvent.press(screen.getByText("S'inscrire"));
  await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
  expect(mockRegister.mock.calls[0][0].marketingConsent).toEqual({ email: true, push: false });
});
