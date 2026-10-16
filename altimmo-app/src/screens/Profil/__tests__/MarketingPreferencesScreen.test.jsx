// MARKETING-CONSENT-1 — écran Profil › Communications : état réel chargé du
// serveur, bascule par canal enregistrée immédiatement, retrait global,
// rappel que les communications opérationnelles ne sont pas affectées.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import MarketingPreferencesScreen from '../MarketingPreferencesScreen';
import { getMarketingPreferences, updateMarketingPreferences } from '../../../services/marketingPreferencesService';

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const RN = require('react-native');
  return { Ionicons: (props) => ReactActual.createElement(RN.Text, props, props.name) };
});
jest.mock('@miblanchard/react-native-slider', () => ({ Slider: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const RN = require('react-native');
  return { SafeAreaView: RN.View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('../../../context/ThemeContext', () => ({ useTheme: () => ({ themeColors: require('../../../theme/colors').colors, isDark: false }) }));
jest.mock('../../../services/marketingPreferencesService', () => ({ getMarketingPreferences: jest.fn(), updateMarketingPreferences: jest.fn() }));

const prefs = (email, push) => ({ channels: { email: { status: email ? 'granted' : 'unknown', granted: email }, push: { status: push ? 'granted' : 'withdrawn', granted: push } } });

beforeEach(() => jest.clearAllMocks());

test('affiche l\'état serveur (aucun consentement par défaut) et le rappel opérationnel', async () => {
  getMarketingPreferences.mockResolvedValue(prefs(false, false));
  render(<MarketingPreferencesScreen navigation={{ goBack: jest.fn() }} />);
  const emailSwitch = await screen.findByLabelText('Offres par e-mail');
  expect(emailSwitch.props.value).toBe(false);
  expect(screen.getByLabelText('Notifications promotionnelles').props.value).toBe(false);
  expect(screen.getByText(/restent toujours envoyés/)).toBeTruthy();
  expect(screen.queryByText('Retirer tous mes consentements')).toBeNull();
});

test('accepter un canal l\'enregistre immédiatement, sans toucher l\'autre canal', async () => {
  getMarketingPreferences.mockResolvedValue(prefs(false, false));
  updateMarketingPreferences.mockResolvedValue(prefs(true, false));
  render(<MarketingPreferencesScreen navigation={{ goBack: jest.fn() }} />);
  fireEvent(await screen.findByLabelText('Offres par e-mail'), 'valueChange', true);
  await waitFor(() => expect(updateMarketingPreferences).toHaveBeenCalledWith({ email: true }));
  await waitFor(() => expect(screen.getByLabelText('Offres par e-mail').props.value).toBe(true));
});

test('retirer tous les consentements envoie un refus pour chaque canal', async () => {
  getMarketingPreferences.mockResolvedValue(prefs(true, true));
  updateMarketingPreferences.mockResolvedValue(prefs(false, false));
  render(<MarketingPreferencesScreen navigation={{ goBack: jest.fn() }} />);
  fireEvent.press(await screen.findByText('Retirer tous mes consentements'));
  await waitFor(() => expect(updateMarketingPreferences).toHaveBeenCalledWith({ email: false, push: false }));
});

test('un échec d\'enregistrement est signalé et l\'interrupteur reste sur l\'état confirmé', async () => {
  getMarketingPreferences.mockResolvedValue(prefs(false, false));
  updateMarketingPreferences.mockRejectedValue(new Error('offline'));
  render(<MarketingPreferencesScreen navigation={{ goBack: jest.fn() }} />);
  fireEvent(await screen.findByLabelText('Offres par e-mail'), 'valueChange', true);
  expect(await screen.findByText(/n’a pas pu être enregistré/)).toBeTruthy();
  expect(screen.getByLabelText('Offres par e-mail').props.value).toBe(false);
});
