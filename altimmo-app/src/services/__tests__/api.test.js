import * as SecureStore from 'expo-secure-store';
import api, {
  clearValidatedPlatformTenant, deleteToken, getValidatedPlatformTenant, isAccountDisabledError,
  normalizeApiError, saveToken, setSessionInvalidatedHandler, setValidatedPlatformTenant,
} from '../api';

describe('normalizeApiError', () => {
  test('normalise une perte réseau sans exposer le message backend', () => {
    expect(normalizeApiError({ config: { method: 'get' } })).toEqual({
      code: 'NETWORK_ERROR',
      status: null,
      serverMessage: null,
      message: 'Connexion réseau indisponible.',
      isNetworkError: true,
      isTimeout: false,
      retryable: true,
    });
  });

  test('marque un timeout comme réessayable', () => {
    expect(normalizeApiError({ code: 'ECONNABORTED', config: { method: 'post' } }))
      .toMatchObject({ isTimeout: true, retryable: true });
  });

  test('ne propose pas de retry automatique pour un POST serveur en erreur', () => {
    expect(normalizeApiError({
      response: { status: 503, data: { code: 'UNAVAILABLE', message: 'internal details' } },
      config: { method: 'post' },
    })).toMatchObject({
      code: 'UNAVAILABLE',
      status: 503,
      message: 'Une erreur est survenue. Veuillez réessayer.',
      retryable: false,
    });
  });
});

describe('isAccountDisabledError', () => {
  test.each(['ACCOUNT_SUSPENDED', 'ACCOUNT_BANNED', 'ACCOUNT_INACTIVE'])('reconnaît %s comme un compte désactivé', (code) => {
    expect(isAccountDisabledError({ response: { data: { code } } })).toBe(true);
  });

  test('ne confond pas un 403 ordinaire (ownership/capability) avec un compte désactivé', () => {
    expect(isAccountDisabledError({ response: { data: { code: 'HOTEL_ACCESS_DENIED' } } })).toBe(false);
    expect(isAccountDisabledError({ response: { data: {} } })).toBe(false);
    expect(isAccountDisabledError(undefined)).toBe(false);
  });
});

describe('intercepteur de requête — en-tête tenant', () => {
  const requestFulfilled = () => api.interceptors.request.handlers[0].fulfilled;

  afterEach(() => clearValidatedPlatformTenant());

  test("n'injecte aucun en-tête tenant tant qu'aucun tenant n'est validé", async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce('some-token');
    const config = await requestFulfilled()({ headers: {} });
    expect(config.headers['X-Platform-Tenant-Id']).toBeUndefined();
  });

  test('injecte X-Platform-Tenant-Id uniquement après validation explicite', async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce('some-token');
    setValidatedPlatformTenant('tenant-a');
    const config = await requestFulfilled()({ headers: {} });
    expect(config.headers['X-Platform-Tenant-Id']).toBe('tenant-a');
  });

  test('clearValidatedPlatformTenant retire immédiatement le tenant du client', async () => {
    setValidatedPlatformTenant('tenant-a');
    expect(getValidatedPlatformTenant()).toBe('tenant-a');
    clearValidatedPlatformTenant();
    expect(getValidatedPlatformTenant()).toBeNull();
    SecureStore.getItemAsync.mockResolvedValueOnce('some-token');
    const config = await requestFulfilled()({ headers: {} });
    expect(config.headers['X-Platform-Tenant-Id']).toBeUndefined();
  });
});

describe('intercepteur de réponse — nettoyage de session', () => {
  const responseRejected = () => api.interceptors.response.handlers[0].rejected;

  beforeEach(() => {
    SecureStore.deleteItemAsync.mockClear();
    setSessionInvalidatedHandler(null);
  });
  afterEach(() => clearValidatedPlatformTenant());

  test('401 supprime le token, invalide le tenant et notifie le handler de session', async () => {
    const handler = jest.fn();
    setSessionInvalidatedHandler(handler);
    setValidatedPlatformTenant('tenant-a');
    await expect(responseRejected()({ response: { status: 401, data: { message: 'Session expirée' } } }))
      .rejects.toBeTruthy();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    expect(getValidatedPlatformTenant()).toBeNull();
    expect(handler).toHaveBeenCalledWith('Session expirée');
  });

  test.each(['ACCOUNT_SUSPENDED', 'ACCOUNT_BANNED', 'ACCOUNT_INACTIVE'])(
    '403 %s déclenche le même nettoyage central qu’un 401 (jamais un logout silencieux par écran)',
    async (code) => {
      const handler = jest.fn();
      setSessionInvalidatedHandler(handler);
      await expect(responseRejected()({ response: { status: 403, data: { code, message: 'Compte suspendu' } } }))
        .rejects.toBeTruthy();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
      expect(handler).toHaveBeenCalledWith('Compte suspendu');
    },
  );

  test('un 403 ordinaire (ownership/capability) ne déclenche JAMAIS de nettoyage de session', async () => {
    const handler = jest.fn();
    setSessionInvalidatedHandler(handler);
    await expect(responseRejected()({ response: { status: 403, data: { code: 'HOTEL_ACCESS_DENIED', message: 'Accès refusé' } } }))
      .rejects.toBeTruthy();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  test('une erreur réseau (pas de response) ne déclenche jamais de logout', async () => {
    const handler = jest.fn();
    setSessionInvalidatedHandler(handler);
    await expect(responseRejected()({ message: 'Network Error' })).rejects.toBeTruthy();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('saveToken/deleteToken — SecureStore, jamais AsyncStorage', () => {
  test('saveToken écrit dans SecureStore avec la bonne clé', async () => {
    await saveToken('jwt-value');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_token', 'jwt-value');
  });

  test('deleteToken supprime la même clé', async () => {
    await deleteToken();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
  });
});
