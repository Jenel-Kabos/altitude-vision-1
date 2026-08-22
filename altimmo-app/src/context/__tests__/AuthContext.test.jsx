import React from 'react';
import { Alert, Button, Text, View } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

// La totalité du mock est construite À L'INTÉRIEUR de la factory (jamais une
// variable externe capturée par référence) : `jest.mock(...)` est hoisté par
// Babel au-dessus des imports/déclarations du fichier, donc toute variable
// externe qu'elle référence risque d'être lue AVANT son initialisation
// réelle (bug constaté : un `const mockApi = {...}` déclaré juste avant ce
// bloc était encore `undefined` au moment de l'exécution de la factory,
// faisant silencieusement échouer `apiClient.get(...)` dans
// `restoreStoredSession` — masqué jusqu'ici car aucun test n'exerçait le
// chemin de succès par défaut). Le test récupère les mêmes espions via
// `import api from '../../services/api'` (le `default` exporté EST l'objet
// mocké), jamais une seconde variable séparée.
jest.mock('../../services/api', () => {
  const api = { deleteToken: jest.fn(), getToken: jest.fn(), get: jest.fn(), post: jest.fn() };
  let capturedSessionInvalidatedHandler = null;
  return {
    __esModule: true,
    default: api,
    saveToken: jest.fn(),
    getToken: (...args) => api.getToken(...args),
    deleteToken: (...args) => api.deleteToken(...args),
    setSessionInvalidatedHandler: jest.fn((handler) => { capturedSessionInvalidatedHandler = handler; }),
    clearValidatedPlatformTenant: jest.fn(),
    __getCapturedSessionInvalidatedHandler: () => capturedSessionInvalidatedHandler,
  };
});
jest.mock('../../services/socketService', () => ({
  disconnectSocket: jest.fn(),
}));
jest.mock('../../services/notificationsService', () => ({
  enregistrerNotifications: jest.fn(),
  dissocierNotifications: jest.fn(),
}));
jest.mock('../../services/cacheService', () => ({ cache: { clear: jest.fn() } }));

import { disconnectSocket as mockDisconnectSocket } from '../../services/socketService';
import {
  dissocierNotifications as mockUnregisterPush,
  enregistrerNotifications as mockRegisterPush,
} from '../../services/notificationsService';
import { AuthProvider, restoreStoredSession, useAuth } from '../AuthContext';
import { cache as mockCache } from '../../services/cacheService';
import mockApi, { clearValidatedPlatformTenant as mockClearValidatedPlatformTenant } from '../../services/api';

const mockDeleteToken = mockApi.deleteToken;
const mockGetToken = mockApi.getToken;
const getCapturedSessionInvalidatedHandler = () => require('../../services/api').__getCapturedSessionInvalidatedHandler();

function Harness({ probeCapability } = {}) {
  const auth = useAuth();
  return (
    <View>
      <Text testID="state">{auth.loading ? 'loading' : auth.user?._id || 'anonymous'}</Text>
      <Text testID="account-status">{auth.accountStatusMessage || ''}</Text>
      {probeCapability && <Text testID="can">{String(auth.can(probeCapability))}</Text>}
      <Button title="logout" onPress={auth.logout} />
      <Button title="login" onPress={() => auth.login('user@example.test', 'secret')} />
      <Button title="google-login" onPress={() => auth.loginWithGoogle({ idToken: 'opaque', intent: 'login' })} />
      <Button title="google-signup" onPress={() => auth.loginWithGoogle({ idToken: 'opaque', intent: 'signup' })} />
    </View>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteToken.mockResolvedValue();
    mockRegisterPush.mockResolvedValue();
    mockUnregisterPush.mockResolvedValue();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => Alert.alert.mockRestore());

  test('termine anonyme si aucun token ne doit être restauré', async () => {
    mockGetToken.mockResolvedValue(null);
    const screen = render(<AuthProvider><Harness /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('anonymous'));
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  test('restaure et valide la session depuis Secure Store', async () => {
    const getStoredToken = jest.fn().mockResolvedValue('stored-token');
    const removeStoredToken = jest.fn();
    const apiClient = {
      get: jest.fn().mockResolvedValue({
        data: { data: { user: { _id: 'user-a', role: 'Client' } } },
      }),
    };
    await expect(restoreStoredSession({
      getStoredToken,
      removeStoredToken,
      apiClient,
    })).resolves.toEqual({
      token: 'stored-token',
      user: { _id: 'user-a', role: 'Client' },
    });
    expect(apiClient.get).toHaveBeenCalledWith('/users/me', {
      headers: { Authorization: 'Bearer stored-token' },
    });
    expect(removeStoredToken).not.toHaveBeenCalled();
  });

  test('supprime un token invalide', async () => {
    mockGetToken.mockResolvedValue('invalid-token');
    mockApi.get.mockRejectedValue(new Error('unauthorized'));
    const screen = render(<AuthProvider><Harness /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('anonymous'));
    expect(mockDeleteToken).toHaveBeenCalled();
  });

  test('logout dissocie le push, supprime le token, coupe Socket et invalide le tenant', async () => {
    mockGetToken.mockResolvedValue(null);
    const screen = render(<AuthProvider><Harness /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('anonymous'));
    await act(async () => fireEvent.press(screen.getByText('logout')));
    expect(mockUnregisterPush).toHaveBeenCalled();
    expect(mockDeleteToken).toHaveBeenCalled();
    expect(mockDisconnectSocket).toHaveBeenCalled();
    expect(mockCache.clear).toHaveBeenCalled();
    expect(mockClearValidatedPlatformTenant).toHaveBeenCalled();
  });

  test('un compte suspendu/banni/inactif détecté en cours de session (403 structuré) nettoie tout et affiche le message serveur', async () => {
    mockGetToken.mockResolvedValue('stored-token');
    mockApi.get.mockResolvedValue({ data: { data: { user: { _id: 'user-a', role: 'Client' } } } });
    const screen = render(<AuthProvider><Harness /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('user-a'));
    expect(getCapturedSessionInvalidatedHandler()).toBeInstanceOf(Function);

    await act(async () => { await getCapturedSessionInvalidatedHandler()('Accès refusé : votre compte est suspendu.'); });

    expect(screen.getByTestId('state').props.children).toBe('anonymous');
    expect(screen.getByTestId('account-status').props.children).toBe('Accès refusé : votre compte est suspendu.');
    expect(mockDisconnectSocket).toHaveBeenCalled();
    expect(mockClearValidatedPlatformTenant).toHaveBeenCalled();
    expect(mockCache.clear).toHaveBeenCalled();
  });

  test('une session révoquée au redémarrage à froid (401/403) supprime le token et affiche le message serveur sans jamais authentifier', async () => {
    mockGetToken.mockResolvedValue('stale-token');
    mockApi.get.mockRejectedValue({ response: { status: 403, data: { code: 'ACCOUNT_BANNED', message: 'Accès refusé : votre compte est banni.' } } });
    const screen = render(<AuthProvider><Harness /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('anonymous'));
    expect(mockDeleteToken).toHaveBeenCalled();
    expect(screen.getByTestId('account-status').props.children).toBe('Accès refusé : votre compte est banni.');
  });

  test('une nouvelle connexion efface un message de statut de compte précédent', async () => {
    mockGetToken.mockResolvedValue(null);
    mockApi.post.mockResolvedValue({ data: { token: 'fresh-token', data: { user: { _id: 'user-b', role: 'Client' } } } });
    const screen = render(<AuthProvider><Harness /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('anonymous'));

    await act(async () => { await getCapturedSessionInvalidatedHandler()?.('message périmé'); });
    expect(screen.getByTestId('account-status').props.children).toBe('message périmé');

    await act(async () => fireEvent.press(screen.getByText('login')));
    expect(screen.getByTestId('state').props.children).toBe('user-b');
    expect(screen.getByTestId('account-status').props.children).toBe('');
  });

  test('ACCOUNT_NOT_FOUND reste sans session et affiche le message Login dédié', async () => {
    mockGetToken.mockResolvedValue(null);
    mockApi.post.mockRejectedValue({
      response: { status: 404, data: { code: 'ACCOUNT_NOT_FOUND' } },
    });
    const screen = render(<AuthProvider><Harness /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('anonymous'));

    await act(async () => fireEvent.press(screen.getByText('google-login')));

    expect(mockApi.post).toHaveBeenCalledWith('/auth/google', expect.objectContaining({ intent: 'login' }));
    expect(screen.getByTestId('state').props.children).toBe('anonymous');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Compte introuvable',
      "Aucun compte n'est associé à cette adresse Google. Créez d'abord votre compte."
    );
  });

  test('ACCOUNT_ALREADY_EXISTS reste sans session et affiche le message Signup dédié', async () => {
    mockGetToken.mockResolvedValue(null);
    mockApi.post.mockRejectedValue({
      response: { status: 409, data: { code: 'ACCOUNT_ALREADY_EXISTS' } },
    });
    const screen = render(<AuthProvider><Harness /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('anonymous'));

    await act(async () => fireEvent.press(screen.getByText('google-signup')));

    expect(mockApi.post).toHaveBeenCalledWith('/auth/google', expect.objectContaining({ intent: 'signup' }));
    expect(screen.getByTestId('state').props.children).toBe('anonymous');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Compte existant',
      'Un compte existe déjà avec cette adresse. Connectez-vous.'
    );
  });
});

// RBAC-4 — le mobile réutilise les mêmes payloads d'identité que RBAC-3
// (login, /auth/google, /users/me), déjà enrichis de `capabilities` côté
// backend. `can()` doit lire ce champ tel quel, jamais recalculer un
// mapping rôle→capacités localement (voir server/docs/RBAC4_SECURITY_MATRIX.md).
describe('AuthProvider.can()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteToken.mockResolvedValue();
    mockRegisterPush.mockResolvedValue();
    mockUnregisterPush.mockResolvedValue();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => Alert.alert.mockRestore());

  test('login email — capacité présente dans user.capabilities → true', async () => {
    mockGetToken.mockResolvedValue(null);
    mockApi.post.mockResolvedValue({
      data: { token: 'fresh-token', data: { user: { _id: 'user-c', role: 'GestionnaireImmobilier', capabilities: ['properties.update'] } } },
    });
    const screen = render(<AuthProvider><Harness probeCapability="properties.update" /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('anonymous'));

    await act(async () => fireEvent.press(screen.getByText('login')));

    expect(screen.getByTestId('state').props.children).toBe('user-c');
    expect(screen.getByTestId('can').props.children).toBe('true');
  });

  test('login email — capacité absente de user.capabilities → false (fail closed)', async () => {
    mockGetToken.mockResolvedValue(null);
    mockApi.post.mockResolvedValue({
      data: { token: 'fresh-token', data: { user: { _id: 'user-d', role: 'GestionnaireImmobilier', capabilities: ['properties.update'] } } },
    });
    const screen = render(<AuthProvider><Harness probeCapability="payments.reverse" /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('anonymous'));

    await act(async () => fireEvent.press(screen.getByText('login')));

    expect(screen.getByTestId('can').props.children).toBe('false');
  });

  test('login Google — capacités projetées depuis la réponse /auth/google', async () => {
    mockGetToken.mockResolvedValue(null);
    mockApi.post.mockResolvedValue({
      data: { token: 'jwt-google', data: { user: { _id: 'user-e', role: 'Admin', capabilities: ['properties.update', 'payments.reverse'] } }, isNewUser: false },
    });
    const screen = render(<AuthProvider><Harness probeCapability="payments.reverse" /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('anonymous'));

    await act(async () => fireEvent.press(screen.getByText('google-login')));

    expect(screen.getByTestId('state').props.children).toBe('user-e');
    expect(screen.getByTestId('can').props.children).toBe('true');
  });

  test('restauration de session (cold start via /users/me) — capacités disponibles immédiatement, jamais de fallback rôle', async () => {
    mockGetToken.mockResolvedValue('stored-token');
    mockApi.get.mockResolvedValue({
      data: { data: { user: { _id: 'user-f', role: 'Secretaire', capabilities: ['documents.read'] } } },
    });
    const screen = render(<AuthProvider><Harness probeCapability="documents.read" /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('user-f'));
    expect(screen.getByTestId('can').props.children).toBe('true');
  });

  test('session ancienne restaurée sans capabilities (backend non déployé/ancien cache) → fail closed, jamais un mapping local', async () => {
    mockGetToken.mockResolvedValue('stored-token');
    mockApi.get.mockResolvedValue({
      data: { data: { user: { _id: 'user-g', role: 'Admin' } } },
    });
    const screen = render(<AuthProvider><Harness probeCapability="properties.update" /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('user-g'));
    expect(screen.getByTestId('can').props.children).toBe('false');
  });

  test('capacité inconnue jamais enregistrée backend → false', async () => {
    mockGetToken.mockResolvedValue('stored-token');
    mockApi.get.mockResolvedValue({
      data: { data: { user: { _id: 'user-h', role: 'Admin', capabilities: ['properties.update'] } } },
    });
    const screen = render(<AuthProvider><Harness probeCapability="not.registered" /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('user-h'));
    expect(screen.getByTestId('can').props.children).toBe('false');
  });

  test('aucun utilisateur connecté → false', async () => {
    mockGetToken.mockResolvedValue(null);
    const screen = render(<AuthProvider><Harness probeCapability="properties.update" /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('anonymous'));
    expect(screen.getByTestId('can').props.children).toBe('false');
  });

  test('logout efface les capacités — plus aucune capacité accessible après déconnexion', async () => {
    mockGetToken.mockResolvedValue('stored-token');
    mockApi.get.mockResolvedValue({
      data: { data: { user: { _id: 'user-i', role: 'Admin', capabilities: ['properties.update'] } } },
    });
    const screen = render(<AuthProvider><Harness probeCapability="properties.update" /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('can').props.children).toBe('true'));

    await act(async () => fireEvent.press(screen.getByText('logout')));

    expect(screen.getByTestId('state').props.children).toBe('anonymous');
    expect(screen.getByTestId('can').props.children).toBe('false');
  });

  test('changement d\'utilisateur (Admin déconnecté → Client reconnecté) ne laisse aucune capacité résiduelle', async () => {
    mockGetToken.mockResolvedValue('stored-token');
    mockApi.get.mockResolvedValue({
      data: { data: { user: { _id: 'user-admin', role: 'Admin', capabilities: ['properties.update', 'payments.reverse'] } } },
    });
    const screen = render(<AuthProvider><Harness probeCapability="payments.reverse" /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('can').props.children).toBe('true'));

    await act(async () => fireEvent.press(screen.getByText('logout')));
    expect(screen.getByTestId('can').props.children).toBe('false');

    mockApi.post.mockResolvedValue({
      data: { token: 'jwt-client', data: { user: { _id: 'user-client', role: 'Client', capabilities: ['client.self'] } } },
    });
    await act(async () => fireEvent.press(screen.getByText('login')));

    expect(screen.getByTestId('state').props.children).toBe('user-client');
    expect(screen.getByTestId('can').props.children).toBe('false');
  });
});
