import * as SecureStore from 'expo-secure-store';
import api, {
  clearValidatedPlatformTenant, deleteToken, getTenantEpoch, getValidatedPlatformTenant, isAccountDisabledError,
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

// TENANT-SWITCH-HARDENING P2-1 — matrice TSH-01..TSH-05.
describe('P2-1 late-response protection — tenant epoch + stale rejection', () => {
  const requestFulfilled = () => api.interceptors.request.handlers[0].fulfilled;
  const responseFulfilled = () => api.interceptors.response.handlers[0].fulfilled;

  afterEach(() => clearValidatedPlatformTenant());

  test('TSH-01 setValidatedPlatformTenant incrémente l\'epoch sur changement effectif', () => {
    const initial = getTenantEpoch();
    setValidatedPlatformTenant('A');
    const afterA = getTenantEpoch();
    setValidatedPlatformTenant('B');
    const afterB = getTenantEpoch();
    expect(afterA).toBe(initial + 1);
    expect(afterB).toBe(afterA + 1);
  });

  test('TSH-04 re-set du même tenant ne bump PAS l\'epoch (pas de faux positif)', () => {
    setValidatedPlatformTenant('A');
    const beforeReset = getTenantEpoch();
    setValidatedPlatformTenant('A');
    expect(getTenantEpoch()).toBe(beforeReset);
  });

  test('clearValidatedPlatformTenant bump l\'epoch uniquement si un tenant était validé', () => {
    clearValidatedPlatformTenant();
    const idleEpoch = getTenantEpoch();
    clearValidatedPlatformTenant();
    expect(getTenantEpoch()).toBe(idleEpoch);
    setValidatedPlatformTenant('A');
    const withTenant = getTenantEpoch();
    clearValidatedPlatformTenant();
    expect(getTenantEpoch()).toBe(withTenant + 1);
  });

  test('TSH-02 réponse Tenant A tardive après switch B → rejetée STALE_TENANT_RESPONSE', async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce('some-token');
    setValidatedPlatformTenant('tenant-a');
    const config = await requestFulfilled()({ headers: {} });
    expect(config.__tenantEpochAtSend).toBeDefined();
    expect(config.__tenantAtSend).toBe('tenant-a');
    setValidatedPlatformTenant('tenant-b');
    const response = { status: 200, config, data: { leak: 'tenant-a data' } };
    await expect(responseFulfilled()(response)).rejects.toMatchObject({
      code: 'STALE_TENANT_RESPONSE',
      isStaleTenant: true,
    });
  });

  test('TSH-05 réponse Tenant A avant switch → livrée normalement', async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce('some-token');
    setValidatedPlatformTenant('tenant-a');
    const config = await requestFulfilled()({ headers: {} });
    const response = { status: 200, config, data: { ok: true } };
    // L'intercepteur retourne la réponse synchroniquement quand elle est
    // fresh (pas de stale) — pas une Promise. On l'invoque directement.
    expect(responseFulfilled()(response)).toBe(response);
  });

  test('TSH-03 requête sans tenant validé → aucun snapshot, réponse toujours livrée', async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce('some-token');
    clearValidatedPlatformTenant();
    const config = await requestFulfilled()({ headers: {} });
    expect(config.__tenantEpochAtSend).toBeUndefined();
    expect(config.__tenantAtSend).toBeUndefined();
    // Simuler un switch tenant survenu entre-temps : n'affecte pas les
    // requêtes hors contexte tenant (publics/globaux).
    setValidatedPlatformTenant('tenant-b');
    const response = { status: 200, config, data: { public: true } };
    expect(responseFulfilled()(response)).toBe(response);
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
