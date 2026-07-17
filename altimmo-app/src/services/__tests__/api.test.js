import { normalizeApiError } from '../api';

describe('normalizeApiError', () => {
  test('normalise une perte réseau sans exposer le message backend', () => {
    expect(normalizeApiError({ config: { method: 'get' } })).toEqual({
      code: 'NETWORK_ERROR',
      status: null,
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
