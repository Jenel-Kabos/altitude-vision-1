// GOOGLE-PLAY-P0-1 — verrou du flow "Supprimer mon compte" du Profil.
// - présence du bouton dans la danger zone
// - double confirmation via Alert (Annuler / Continuer / Supprimer mon compte)
// - appel DELETE /users/me sur confirmation finale
// - logout après succès
// - LAST_TENANT_ADMIN_ACCOUNT_DELETION_BLOCKED montré à l'utilisateur

import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import ProfilScreen from '../ProfilScreen';

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

// jest.mock est hoisted au-dessus des imports ET des const. Pour partager
// une référence au mock avec les tests, on l'expose via un module de test
// interne au factory.
jest.mock('../../../services/api', () => {
  const api = { get: jest.fn(() => Promise.resolve({ data: {} })), delete: jest.fn() };
  return { __esModule: true, default: api };
});
const mockApi = require('../../../services/api').default;

jest.mock('../../../navigation/navigationSdk', () => ({ resolveMobileDestination: jest.fn() }));

const mockLogout = jest.fn();
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'Test User', email: 'test@example.com', role: 'Client' },
    logout: mockLogout,
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

describe('ProfilScreen — Supprimer mon compte (GOOGLE-PLAY-P0-1)', () => {
  let alertSpy;
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.delete.mockReset();
    mockApi.get.mockReset();
    mockApi.get.mockResolvedValue({ data: {} });
    alertSpy = jest.spyOn(Alert, 'alert');
  });
  afterEach(() => { alertSpy.mockRestore(); });

  test('le bouton "Supprimer mon compte" est présent dans la danger zone', () => {
    render(<ProfilScreen navigation={{}} />);
    expect(screen.getByText('Supprimer mon compte')).toBeTruthy();
  });

  test("la première Alert propose Annuler + Continuer (aucune suppression n'est déclenchée par un simple tap)", () => {
    render(<ProfilScreen navigation={{}} />);
    fireEvent.press(screen.getByText('Supprimer mon compte'));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = alertSpy.mock.calls[0];
    expect(title).toMatch(/supprimer mon compte/i);
    expect(message).toMatch(/anonymise/i);
    const labels = buttons.map((b) => b.text);
    expect(labels).toEqual(expect.arrayContaining(['Annuler', 'Continuer']));
    // Aucun appel réseau à ce stade.
    expect(mockApi.delete).not.toHaveBeenCalled();
  });

  test("Annuler à la première Alert n'appelle jamais DELETE /users/me", () => {
    render(<ProfilScreen navigation={{}} />);
    fireEvent.press(screen.getByText('Supprimer mon compte'));
    const buttons = alertSpy.mock.calls[0][2];
    const cancel = buttons.find((b) => b.style === 'cancel');
    cancel?.onPress?.();
    expect(mockApi.delete).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  test("Continuer déclenche une deuxième Alert (confirmation finale) mais pas encore de DELETE", () => {
    render(<ProfilScreen navigation={{}} />);
    fireEvent.press(screen.getByText('Supprimer mon compte'));
    const firstButtons = alertSpy.mock.calls[0][2];
    firstButtons.find((b) => b.text === 'Continuer').onPress();

    expect(alertSpy).toHaveBeenCalledTimes(2);
    const [title2, , buttons2] = alertSpy.mock.calls[1];
    expect(title2).toMatch(/confirmation finale/i);
    expect(buttons2.map((b) => b.text)).toEqual(expect.arrayContaining(['Annuler', 'Supprimer mon compte']));
    expect(mockApi.delete).not.toHaveBeenCalled();
  });

  test('confirmation finale appelle DELETE /users/me puis logout()', async () => {
    mockApi.delete.mockImplementation(() => Promise.resolve({ data: { status: 'success' } }));
    render(<ProfilScreen navigation={{}} />);
    fireEvent.press(screen.getByText('Supprimer mon compte'));
    alertSpy.mock.calls[0][2].find((b) => b.text === 'Continuer').onPress();
    await act(async () => {
      alertSpy.mock.calls[1][2].find((b) => b.text === 'Supprimer mon compte').onPress();
    });

    await waitFor(() => expect(mockApi.delete).toHaveBeenCalledWith('/users/me'));

    // Le succès déclenche une Alert "Compte supprimé" avec un bouton OK -> logout.
    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(3));
    const successCall = alertSpy.mock.calls[2];
    expect(successCall[0]).toMatch(/compte supprimé/i);
    successCall[2].find((b) => b.text === 'OK').onPress();
    expect(mockLogout).toHaveBeenCalled();
  });

  test('LAST_TENANT_ADMIN_ACCOUNT_DELETION_BLOCKED affiche une Alert spécifique et ne logout PAS', async () => {
    mockApi.delete.mockImplementation(() => Promise.reject({
      response: { data: { code: 'LAST_TENANT_ADMIN_ACCOUNT_DELETION_BLOCKED', message: 'Vous êtes seul admin.' } },
    }));
    render(<ProfilScreen navigation={{}} />);
    fireEvent.press(screen.getByText('Supprimer mon compte'));
    alertSpy.mock.calls[0][2].find((b) => b.text === 'Continuer').onPress();
    await act(async () => {
      alertSpy.mock.calls[1][2].find((b) => b.text === 'Supprimer mon compte').onPress();
    });

    await waitFor(() => expect(mockApi.delete).toHaveBeenCalledWith('/users/me'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(3));
    const errCall = alertSpy.mock.calls[2];
    expect(errCall[0]).toMatch(/bloqu/i);
    expect(errCall[1]).toMatch(/seul admin/i);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  test('erreur serveur générique affiche un message d\'erreur et ne logout PAS', async () => {
    mockApi.delete.mockImplementation(() => Promise.reject({ response: { data: { message: 'boom' } } }));
    render(<ProfilScreen navigation={{}} />);
    fireEvent.press(screen.getByText('Supprimer mon compte'));
    alertSpy.mock.calls[0][2].find((b) => b.text === 'Continuer').onPress();
    await act(async () => {
      alertSpy.mock.calls[1][2].find((b) => b.text === 'Supprimer mon compte').onPress();
    });

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(3));
    expect(alertSpy.mock.calls[2][0]).toMatch(/erreur/i);
    expect(mockLogout).not.toHaveBeenCalled();
  });
});
